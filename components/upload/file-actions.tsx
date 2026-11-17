"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FilePreviewDialog } from "@/components/upload/file-preview-dialog";
import { errorMessage } from "@/lib/api";
import { downloadFile, type FileRef, type FileSource } from "@/lib/api/files";
import type { StoredFile } from "@/lib/api/pipeline";

/** Icon-only View and Download buttons for one stored file (the preview opens in a dialog). */
export function FileActions({ file, source }: { file: FileRef; source: FileSource }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const name = file.name ?? "file";
  const stored = { id: file.fileId, originalName: name, size: file.size ?? 0, kind: /\.(png|jpe?g|webp|gif)$/i.test(name) ? "image" : "document" } as StoredFile;
  return (
    <>
      <span className="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="outline" aria-label={`View ${name}`} title="View" onClick={() => setOpen(true)}><Eye className="size-4" aria-hidden /></Button>
        <Button size="icon" variant="outline" aria-label={`Download ${name}`} title="Download" onClick={() => downloadFile(file.fileId, source, name).catch((e) => toast(errorMessage(e), "error"))}><Download className="size-4" aria-hidden /></Button>
      </span>
      {open && <FilePreviewDialog file={stored} source={source} onClose={() => setOpen(false)} />}
    </>
  );
}
