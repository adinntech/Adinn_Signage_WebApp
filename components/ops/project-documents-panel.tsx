"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { FileDrop } from "@/components/upload/file-drop";
import { FilePreviewDialog } from "@/components/upload/file-preview-dialog";
import { StoredFileRow } from "@/components/upload/stored-file-row";
import { UploadQueue } from "@/components/upload/upload-queue";
import { useFileUploader } from "@/hooks/use-file-uploader";
import { errorMessage } from "@/lib/api";
import { useDeleteFile, useProjectFiles, type StoredFile } from "@/lib/api/pipeline";
import { cn } from "@/lib/utils";

type Source = "all" | "bd" | "ops";
const TAG: Record<"bd" | "ops", { label: string; cls: string }> = {
  bd: { label: "From BD", cls: "bg-[#e8f0ff] text-royal" },
  ops: { label: "Operations", cls: "bg-[#fff0e0] text-approval" },
};

/**
 * One list for everything attached to the project: BD's files and Operations' own, each tagged with its source.
 * Operations adds files with the Add Document button (checked and uploaded like everywhere else); BD's files are read-only here.
 */
export function ProjectDocumentsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast();
  const bd = useProjectFiles(projectId, "BD_CLIENT_DETAILS");
  const ops = useProjectFiles(projectId, "OPS_SURVEY_PROOF");
  const queue = useFileUploader({ projectId, category: "OPS_SURVEY_PROOF", autoStart: true });
  const del = useDeleteFile(projectId);
  const [source, setSource] = useState<Source>("all");
  const [preview, setPreview] = useState<StoredFile | null>(null);
  const [toDelete, setToDelete] = useState<StoredFile | null>(null);

  // Uploaded files show in the list, so the finished upload rows go away after a moment.
  const hasDone = queue.items.some((i) => i.status === "done");
  useEffect(() => {
    if (!hasDone || queue.busy) return;
    const t = setTimeout(queue.clearDone, 2500);
    return () => clearTimeout(t);
  }, [hasDone, queue.busy, queue.clearDone]);

  const rows = useMemo(() => {
    const all = [...(bd.data ?? []).map((f) => ({ f, src: "bd" as const })), ...(ops.data ?? []).map((f) => ({ f, src: "ops" as const }))];
    return all.filter((r) => source === "all" || r.src === source).sort((a, b) => b.f.createdAt.localeCompare(a.f.createdAt));
  }, [bd.data, ops.data, source]);

  const error = bd.error ?? ops.error;
  if (error) return <ErrorState error={error} onRetry={() => { void bd.refetch(); void ops.refetch(); }} title="Could not load documents" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          label="Document source"
          value={source}
          onChange={(k) => setSource(k as Source)}
          tabs={[
            { key: "all", label: "All", count: (bd.data?.length ?? 0) + (ops.data?.length ?? 0) },
            { key: "bd", label: "From BD", count: bd.data?.length ?? 0 },
            { key: "ops", label: "Operations", count: ops.data?.length ?? 0 },
          ]}
        />
        {canEdit && <FileDrop variant="button" onError={(m) => toast(m, "error")} onFiles={(p) => void queue.addFiles(p)} />}
      </div>
      <UploadQueue items={queue.items} onRemove={queue.remove} onCancel={queue.cancel} onRetry={(id) => void queue.retry(id)} />
      {bd.isPending || ops.isPending ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : rows.length === 0 ? (
        queue.items.length === 0 && <EmptyState title="No documents yet" description={canEdit ? "Use Add Document to attach survey data, measurements or proofs." : undefined} />
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {rows.map(({ f, src }) => (
            <StoredFileRow
              key={f.id}
              file={f}
              onPreview={setPreview}
              onDelete={canEdit && src === "ops" ? setToDelete : undefined}
              deleting={del.isPending}
              tag={<span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", TAG[src].cls)}>{TAG[src].label}</span>}
            />
          ))}
        </ul>
      )}
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        autoClose
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete document?"
        description={toDelete ? `${toDelete.originalName} will be removed from this project.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          del.mutate(toDelete.id, { onSuccess: () => toast("Document deleted"), onError: (e) => toast(errorMessage(e), "error") });
        }}
      />
    </div>
  );
}
