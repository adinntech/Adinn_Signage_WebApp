"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, errorMessage } from "@/lib/api";
import { checkFileDuplicates, uploadFileWithProgress, type FileCategory } from "@/lib/api/pipeline";
import { sha256Hex } from "@/lib/file-hash";
import { releasePicked, type PickedFile } from "@/components/upload/file-drop";

export type UploadStatus = "checking" | "ready" | "uploading" | "done" | "duplicate" | "failed" | "cancelled";

export interface UploadItem extends PickedFile {
  status: UploadStatus;
  /** 0-100 while uploading. */
  progress: number;
  /** Why a file is a duplicate or failed. */
  message?: string;
  sha: string | null;
}

export interface UploadSummary {
  done: number;
  failed: number;
  duplicates: number;
}

/**
 * Upload queue with instant feedback:
 *  - each file is fingerprinted (SHA-256) as soon as it is picked and compared with the other picked files and,
 *    when the project already exists, with what is stored on the server, so duplicates are flagged immediately;
 *  - files upload one at a time with a live progress bar; a rejected file never blocks the others.
 */
export function useFileUploader({ projectId, category, autoStart = false }: { projectId?: string | undefined; category: FileCategory; autoStart?: boolean }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const ref = useRef<UploadItem[]>([]);
  const running = useRef(false);
  /** One abort handle per file being uploaded, so a slow upload can be cancelled. */
  const aborts = useRef(new Map<string, AbortController>());
  const projectRef = useRef(projectId);
  useEffect(() => {
    projectRef.current = projectId;
  }, [projectId]);

  const commit = useCallback((next: UploadItem[]) => {
    ref.current = next;
    setItems(next);
  }, []);
  const patch = useCallback(
    (id: string, p: Partial<UploadItem>) => commit(ref.current.map((i) => (i.id === id ? { ...i, ...p } : i))),
    [commit],
  );

  const start = useCallback(
    async (pidOverride?: string): Promise<UploadSummary> => {
      const pid = pidOverride ?? projectRef.current;
      const summary: UploadSummary = { done: 0, failed: 0, duplicates: 0 };
      if (!pid || running.current) return summary;
      running.current = true;
      try {
        for (const item of ref.current.filter((i) => i.status === "ready" || i.status === "failed")) {
          const now = ref.current.find((i) => i.id === item.id)?.status;
          if (now !== "ready" && now !== "failed") continue; // removed or cancelled while waiting its turn
          const ctl = new AbortController();
          aborts.current.set(item.id, ctl);
          patch(item.id, { status: "uploading", progress: 0, message: undefined });
          try {
            await uploadFileWithProgress(pid, category, item.file, (p) => patch(item.id, { progress: p }), ctl.signal);
            patch(item.id, { status: "done", progress: 100 });
            summary.done++;
          } catch (e) {
            if (e instanceof ApiError && e.code === "ABORTED") {
              patch(item.id, { status: "cancelled", progress: 0, message: "Upload cancelled. Nothing was saved." });
            } else if (e instanceof ApiError && e.status === 409) {
              patch(item.id, { status: "duplicate", progress: 0, message: e.message });
              summary.duplicates++;
            } else {
              patch(item.id, { status: "failed", progress: 0, message: errorMessage(e) });
              summary.failed++;
            }
          } finally {
            aborts.current.delete(item.id);
          }
        }
      } finally {
        running.current = false;
        qc.invalidateQueries({ queryKey: ["files", pid] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
      return summary;
    },
    [category, patch, qc],
  );

  const addFiles = useCallback(
    async (picked: PickedFile[]) => {
      const added: UploadItem[] = picked.map((p) => ({ ...p, status: "checking", progress: 0, sha: null }));
      commit([...ref.current, ...added]);

      // 1. fingerprint each file and compare with the files picked before it
      for (const it of added) {
        const sha = await sha256Hex(it.file);
        const idx = ref.current.findIndex((x) => x.id === it.id);
        const sameFile = (x: UploadItem) => (sha && x.sha ? x.sha === sha : x.name === it.name && x.size === it.size);
        const earlier = ref.current.slice(0, idx).find((x) => x.status !== "duplicate" && sameFile(x));
        if (earlier) patch(it.id, { sha, status: "duplicate", message: `Same file as "${earlier.name}" in this selection` });
        else patch(it.id, { sha });
      }

      // 2. one request asks the server which of the rest it already has
      const pid = projectRef.current;
      const toCheck = ref.current.filter((i) => added.some((a) => a.id === i.id) && i.status === "checking" && i.sha);
      if (pid && toCheck.length) {
        try {
          const rows = await checkFileDuplicates(pid, category, [...new Set(toCheck.map((i) => i.sha!))]);
          const known = new Map(rows.filter((r) => r.duplicate).map((r) => [r.sha256, r.existingName]));
          for (const i of toCheck) {
            if (known.has(i.sha!)) patch(i.id, { status: "duplicate", message: `Already uploaded to this project as "${known.get(i.sha!)}"` });
          }
        } catch {
          /* the server rejects duplicates at upload time anyway */
        }
      }

      // 3. everything not flagged is ready to go
      commit(ref.current.map((i) => (added.some((a) => a.id === i.id) && i.status === "checking" ? { ...i, status: "ready" } : i)));
      if (autoStart) await start();
    },
    [autoStart, category, commit, patch, start],
  );

  /** Stops an upload in progress. The file stays in the list (marked cancelled) so it can be retried or removed. */
  const cancel = useCallback((id: string) => aborts.current.get(id)?.abort(), []);

  const remove = useCallback(
    (id: string) => {
      const it = ref.current.find((i) => i.id === id);
      if (!it) return;
      if (it.status === "uploading") return cancel(id);
      releasePicked(it);
      commit(ref.current.filter((i) => i.id !== id));
    },
    [cancel, commit],
  );

  const retry = useCallback(
    async (id: string) => {
      patch(id, { status: "ready", message: undefined, progress: 0 });
      await start();
    },
    [patch, start],
  );

  /** Resolves once no file is still being fingerprinted / checked. */
  const settled = useCallback(async () => {
    while (ref.current.some((i) => i.status === "checking")) await new Promise((r) => setTimeout(r, 40));
  }, []);

  /** Drops finished files from the list (the stored copy now appears in the documents list). */
  const clearDone = useCallback(() => {
    ref.current.filter((i) => i.status === "done").forEach(releasePicked);
    commit(ref.current.filter((i) => i.status !== "done"));
  }, [commit]);

  useEffect(() => () => {
    aborts.current.forEach((c) => c.abort()); // leaving the page stops uploads in progress
    ref.current.forEach(releasePicked);
  }, []);

  return {
    items,
    addFiles,
    start,
    remove,
    cancel,
    retry,
    clearDone,
    settled,
    busy: items.some((i) => i.status === "checking" || i.status === "uploading"),
    pendingCount: items.filter((i) => i.status === "ready" || i.status === "failed").length,
  };
}
