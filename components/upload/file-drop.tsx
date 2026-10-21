"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Image as ImageIcon, File as FileIcon, Trash2, UploadCloud } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FileKind = "image" | "video" | "document" | "sheet";

/** A file the user picked but that has not been uploaded yet. */
export interface PickedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  kind: FileKind;
  /** Object URL for an image thumbnail; revoke with `releasePicked` when the file is dropped. */
  previewUrl?: string;
}

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ACCEPT = ".xlsx,.csv,.pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp";

export const kindOfName = (name: string): FileKind => {
  const n = name.toLowerCase();
  if (/\.(xlsx|csv)$/.test(n)) return "sheet";
  if (/\.(png|jpe?g|webp)$/.test(n)) return "image";
  if (n.endsWith(".mp4")) return "video";
  return "document";
};

export const releasePicked = (p: PickedFile) => p.previewUrl && URL.revokeObjectURL(p.previewUrl);

export function FileTypeIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const map = {
    sheet: [FileSpreadsheet, "bg-[#e2f8ea] text-finance"],
    document: [FileText, "bg-[#ffe8e8] text-loss"],
    image: [ImageIcon, "bg-[#e8f0ff] text-royal"],
    video: [FileIcon, "bg-muted text-muted-foreground"],
  } as const;
  const [Icon, tone] = map[kind];
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone, className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

/**
 * Drag-and-drop picker. Files are only collected here; the caller uploads them to the server
 * (so nothing is half-saved while a form is still being filled in).
 */
export function FileDrop({ onFiles, onError }: { onFiles: (files: PickedFile[]) => void; onError?: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handle(list: FileList | null) {
    if (!list?.length) return;
    const out: PickedFile[] = [];
    for (const file of Array.from(list)) {
      const kind = kindOfName(file.name);
      if (!ACCEPT.split(",").some((e) => file.name.toLowerCase().endsWith(e))) {
        onError?.(`${file.name}: this file type is not allowed`);
        continue;
      }
      if (file.size > (kind === "image" ? MAX_IMAGE_BYTES : MAX_BYTES)) {
        onError?.(`${file.name} is larger than ${kind === "image" ? "3 MB (images)" : "50 MB"}`);
        continue;
      }
      out.push({
        id: Math.random().toString(36).slice(2, 10),
        file,
        name: file.name,
        size: file.size,
        kind,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
      });
    }
    if (out.length) onFiles(out);
    if (input.current) input.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
        over ? "border-royal bg-royal/5" : "border-border bg-muted/40",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-royal">
        <UploadCloud className="size-6" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">Drag &amp; drop Excel, PDF or images here</p>
      <p className="text-xs text-muted-foreground">.xlsx .csv .pdf .docx .pptx .png .jpg &middot; images up to 3 MB, others up to 50 MB</p>
      <button type="button" onClick={() => input.current?.click()} className="mt-1 rounded-lg bg-royal px-4 py-2 text-sm font-medium text-white hover:bg-royal/90">
        Browse files
      </button>
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => handle(e.target.files)} aria-label="Upload documents" />
    </div>
  );
}

/** One file line, for both not-yet-uploaded files and files already stored on the server. */
export function FileRow({
  name,
  size,
  kind,
  previewUrl,
  note,
  onOpen,
  onRemove,
  removing,
}: {
  name: string;
  size: number;
  kind: FileKind;
  previewUrl?: string;
  note?: string;
  onOpen?: () => void;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const label = (
    <>
      <span className="block truncate text-sm font-medium text-foreground">{name}</span>
      <span className="block text-xs text-muted-foreground">
        {formatBytes(size)}
        {note ? ` · ${note}` : ""}
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <FileTypeIcon kind={kind} />
      )}
      {onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:underline">
          {label}
        </button>
      ) : (
        <span className="min-w-0 flex-1">{label}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remove ${name}`}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}
