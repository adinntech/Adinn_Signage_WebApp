"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useFileUploader } from "@/hooks/use-file-uploader";
import { errorMessage } from "@/lib/api";
import { useDeleteFile, useProjectFiles, type FileCategory, type StoredFile } from "@/lib/api/pipeline";
import { FileDrop } from "./file-drop";
import { FilePreviewDialog } from "./file-preview-dialog";
import { StoredFileRow } from "./stored-file-row";
import { UploadQueue } from "./upload-queue";

/**
 * Documents stored on the server for one project and category, with upload, preview, download and delete.
 * New files are checked for duplicates the moment they are picked and upload with a live progress bar.
 * Download saves the file under its original name.
 */
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
  const queue = useFileUploader({ projectId, category, autoStart: true });
  const del = useDeleteFile(projectId);
  const [toDelete, setToDelete] = useState<StoredFile | null>(null);
  const [preview, setPreview] = useState<StoredFile | null>(null);

  // Once a file is uploaded it appears in the stored list below, so drop it from the queue after a moment.
  const hasDone = queue.items.some((i) => i.status === "done");
  useEffect(() => {
    if (!hasDone || queue.busy) return;
    const t = setTimeout(queue.clearDone, 2500);
    return () => clearTimeout(t);
  }, [hasDone, queue.busy, queue.clearDone]);

  if (files.isError) return <ErrorState error={files.error} onRetry={() => files.refetch()} title="Could not load documents" />;

  return (
    <div className="space-y-3">
      {uploader && <FileDrop onError={(m) => toast(m, "error")} onFiles={(p) => void queue.addFiles(p)} />}
      <UploadQueue items={queue.items} onRemove={queue.remove} onCancel={queue.cancel} onRetry={(id) => void queue.retry(id)} />
      {files.isPending ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : files.data.length === 0 ? (
        queue.items.length === 0 && <EmptyState title={emptyText} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.data.map((f) => (
            <StoredFileRow key={f.id} file={f} onPreview={setPreview} onDelete={canEdit ? setToDelete : undefined} deleting={del.isPending} />
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
