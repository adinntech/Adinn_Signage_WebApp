"use client";

import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, openFile, useFileUrl, type StoredFile } from "@/lib/api/pipeline";
import { formatBytes } from "@/lib/format";
import { FileTypeIcon } from "./file-drop";
import { SheetPreview, isSheet } from "./sheet-preview";

export const isPdf = (name: string) => /\.pdf$/i.test(name);

/**
 * Preview window for a stored file. Images and PDFs show right here; other types (Excel, Word, PowerPoint, CSV)
 * cannot be shown by a browser, so the window offers a download that keeps the original file name.
 */
export function FilePreviewDialog({ file, onClose }: { file: StoredFile | null; onClose: () => void }) {
  const toast = useToast();
  const sheet = !!file && isSheet(file.originalName);
  const previewable = !!file && (file.kind === "image" || isPdf(file.originalName));
  // Word / PowerPoint / old Excel can be shown by Office Online, but only from a public address (Spaces), never from localhost.
  const office = !!file && /\.(docx?|pptx?|xls)$/i.test(file.originalName) && !!file.url && !/^https?:\/\/(localhost|127\.)/.test(file.url);
  const url = useFileUrl(file?.id, previewable);

  const save = () => file && downloadFile(file.id).catch((e) => toast(errorMessage(e), "error"));

  return (
    <Modal
      open={!!file}
      onOpenChange={(o) => !o && onClose()}
      title={file?.originalName ?? "Preview"}
      description={file ? `${formatBytes(file.size)}` : undefined}
      className="max-w-4xl"
      footer={
        file && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {previewable && (
              <Button variant="outline" onClick={() => openFile(file.id).catch((e) => toast(errorMessage(e), "error"))}>
                <ExternalLink className="size-4" aria-hidden /> Open in new tab
              </Button>
            )}
            <Button className="bg-royal hover:bg-royal/90" onClick={save}>
              <Download className="size-4" aria-hidden /> Download
            </Button>
          </div>
        )
      }
    >
      {file && sheet ? (
        <SheetPreview fileId={file.id} name={file.originalName} />
      ) : file && office ? (
        <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url!)}`} title={file.originalName} data-testid="preview-office" className="h-[68vh] w-full rounded-lg border border-border" />
      ) : file && previewable ? (
        url.isPending ? (
          <p role="status" className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading preview…</p>
        ) : url.isError ? (
          <p role="alert" className="py-10 text-center text-sm text-danger">{errorMessage(url.error)}</p>
        ) : file.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url.data.url} alt={file.originalName} data-testid="preview-image" className="mx-auto max-h-[68vh] w-auto rounded-lg object-contain" />
        ) : (
          <iframe src={url.data.url} title={file.originalName} data-testid="preview-pdf" className="h-[68vh] w-full rounded-lg border border-border" />
        )
      ) : (
        file && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <FileTypeIcon kind={file.kind} name={file.originalName} className="size-16" />
            <p className="max-w-md break-words text-sm font-medium text-foreground">{file.originalName}</p>
          </div>
        )
      )}
    </Modal>
  );
}
