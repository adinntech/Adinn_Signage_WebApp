"use client";

import { useState } from "react";
import { Download, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile, useFileUrl, type StoredFile } from "@/lib/api/pipeline";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileTypeIcon } from "./file-drop";

/**
 * One file already stored on the server: a picture thumbnail for images, a typed icon for everything else,
 * and Preview, Download (original name) and optional Delete buttons.
 */
export function StoredFileRow({
  file,
  onPreview,
  onDelete,
  deleting,
}: {
  file: StoredFile;
  onPreview: (f: StoredFile) => void;
  onDelete?: (f: StoredFile) => void;
  deleting?: boolean;
}) {
  const toast = useToast();
  const thumb = useFileUrl(file.id, file.kind === "image");
  const [broken, setBroken] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await downloadFile(file.id);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  const btn = "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";

  return (
    <li data-testid="stored-file" data-name={file.originalName} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2 transition-shadow hover:shadow-soft">
      <button type="button" onClick={() => onPreview(file)} aria-label={`Preview ${file.originalName}`} className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
        {file.kind === "image" && thumb.data && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.data.url} alt="" onError={() => setBroken(true)} className="size-10 rounded-lg object-cover" />
        ) : (
          <FileTypeIcon kind={file.kind} name={file.originalName} />
        )}
      </button>
      <button type="button" onClick={() => onPreview(file)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-foreground hover:underline">{file.originalName}</span>
        <span className="block text-xs text-muted-foreground">{formatBytes(file.size)} · {formatDateTime(file.createdAt)}</span>
      </button>
      <div className="flex shrink-0 items-center">
        <button type="button" onClick={() => onPreview(file)} aria-label={`View ${file.originalName}`} title="View" className={btn}>
          <Eye className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={() => void save()} disabled={saving} aria-label={`Download ${file.originalName}`} title="Download" className={cn(btn, saving && "animate-pulse")}>
          <Download className="size-4" aria-hidden />
        </button>
        {onDelete && (
          <button type="button" onClick={() => onDelete(file)} disabled={deleting} aria-label={`Delete ${file.originalName}`} title="Delete" className={cn(btn, "hover:bg-danger-soft hover:text-danger")}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}
