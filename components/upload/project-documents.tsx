"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { openFile, useDeleteFile, useProjectFiles, useUploadFiles, type FileCategory, type StoredFile } from "@/lib/api/pipeline";
import { formatDateTime } from "@/lib/format";
import { FileDrop, FileRow, releasePicked, type PickedFile } from "./file-drop";

/** Documents stored on the server for one project and category, with upload, open and delete. */
export function ProjectDocuments({
  projectId,
  category,
  canEdit,
  uploader = canEdit,
  emptyText = "No documents uploaded.",
}: {
  projectId: string;
  category: FileCategory;
  canEdit: boolean;
  /** Show the drop zone (defaults to on when editable). */
  uploader?: boolean;
  emptyText?: string;
}) {
  const toast = useToast();
  const files = useProjectFiles(projectId, category);
  const upload = useUploadFiles(projectId, category);
  const del = useDeleteFile(projectId);
  const [toDelete, setToDelete] = useState<StoredFile | null>(null);

  async function onFiles(picked: PickedFile[]) {
    const res = await upload.mutateAsync(picked.map((p) => p.file));
    picked.forEach(releasePicked);
    const ok = res.filter((r) => r.ok).length;
    if (ok) toast(`${ok} file${ok > 1 ? "s" : ""} uploaded`);
    for (const r of res.filter((x) => !x.ok)) toast(`${r.file.name}: ${r.error}`, "error");
  }

  if (files.isError) return <ErrorState error={files.error} onRetry={() => files.refetch()} title="Could not load documents" />;

  return (
    <div className="space-y-3">
      {uploader && <FileDrop onError={(m) => toast(m, "error")} onFiles={(p) => void onFiles(p)} />}
      {upload.isPending && <p role="status" className="text-sm text-muted-foreground">Uploading…</p>}
      {files.isPending ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : files.data.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.data.map((f) => (
            <FileRow
              key={f.id}
              name={f.originalName}
              size={f.size}
              kind={f.kind}
              note={formatDateTime(f.createdAt)}
              onOpen={() => openFile(f.id).catch((e) => toast(errorMessage(e), "error"))}
              onRemove={canEdit ? () => setToDelete(f) : undefined}
              removing={del.isPending}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
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
