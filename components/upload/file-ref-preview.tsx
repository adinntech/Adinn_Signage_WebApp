"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, fileUrl, openFile, type FileRef, type FileSource } from "@/lib/api/files";
import { formatBytes } from "@/lib/format";

/** What can be previewed: a saved file (signed link from its owner record) or a file picked but not uploaded yet. */
export type PreviewTarget = { saved: FileRef; source: FileSource } | { local: File };

const isImage = (name: string, mime?: string) => (mime ? mime.startsWith("image/") : /\.(jpe?g|png|webp|gif)$/i.test(name));
const isPdfFile = (name: string, mime?: string) => (mime ? mime === "application/pdf" : /\.pdf$/i.test(name));

/**
 * Preview window for an order / client / handover file (FileRef) or a picked file. Images and PDFs show here; other
 * types offer a download. Saved files use the owner's short-lived signed link, so access rules stay on the backend.
 */
export function FileRefPreview({ target, onClose }: { target: PreviewTarget | null; onClose: () => void }) {
  const toast = useToast();
  const name = !target ? "" : "local" in target ? target.local.name : (target.saved.name ?? "File");
  const mime = !target ? undefined : "local" in target ? target.local.type || undefined : target.saved.mimeType;
  const size = !target ? undefined : "local" in target ? target.local.size : target.saved.size;
  const image = isImage(name, mime);
  const viewable = image || isPdfFile(name, mime);

  const signed = useQuery({
    queryKey: ["file-url", target && "saved" in target ? target.saved.fileId : null],
    queryFn: () => fileUrl((target as { saved: FileRef; source: FileSource }).saved.fileId, (target as { source: FileSource }).source),
    enabled: !!target && "saved" in target && viewable,
    staleTime: 60_000,
  });
  // A picked file is shown from a local object URL, released when the window closes or the file changes.
  const localFile = target && "local" in target ? target.local : null;
  const localUrl = useMemo(() => (localFile ? URL.createObjectURL(localFile) : null), [localFile]);
  useEffect(() => () => void (localUrl && URL.revokeObjectURL(localUrl)), [localUrl]);

  const url = target && "local" in target ? localUrl : (signed.data?.url ?? null);
  const fail = (e: unknown) => toast(errorMessage(e), "error");
  const download = () => {
    if (!target) return;
    if ("saved" in target) return void downloadFile(target.saved.fileId, target.source, name).catch(fail);
    if (!localUrl) return;
    const a = document.createElement("a");
    a.href = localUrl;
    a.download = name;
    a.click();
  };

  return (
    <Modal
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={name || "Preview"}
      description={size ? formatBytes(size) : undefined}
      className="max-w-4xl"
      footer={
        target && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {"saved" in target && viewable && (
              <Button variant="outline" onClick={() => openFile(target.saved.fileId, target.source).catch(fail)}>
                <ExternalLink className="size-4" aria-hidden /> Open in new tab
              </Button>
            )}
            <Button variant="brand" onClick={download}>
              <Download className="size-4" aria-hidden /> Download
            </Button>
          </div>
        )
      }
    >
      {!viewable ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <FileText className="size-14 text-brand" aria-hidden />
          <p className="max-w-md break-words text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">This file type cannot be shown in the browser. Download it to open.</p>
        </div>
      ) : signed.isError ? (
        <p role="alert" className="py-10 text-center text-sm text-danger">{errorMessage(signed.error)}</p>
      ) : !url ? (
        <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading preview…
        </p>
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} data-testid="preview-image" className="mx-auto max-h-[68vh] w-auto rounded-lg object-contain" />
      ) : (
        <iframe src={url} title={name} data-testid="preview-pdf" className="h-[68vh] w-full rounded-lg border border-border" />
      )}
    </Modal>
  );
}
