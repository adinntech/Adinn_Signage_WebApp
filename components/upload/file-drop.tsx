"use client";

import { useRef, useState } from "react";
import { AlertTriangle, X, FileSpreadsheet, FileText, Image as ImageIcon, File as FileIcon, UploadCloud } from "lucide-react";
import { useFileLimits } from "@/lib/api/pipeline";
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

export const kindOfName = (name: string): FileKind => {
  const n = name.toLowerCase();
  if (/\.(xlsx|csv)$/.test(n)) return "sheet";
  if (/\.(png|jpe?g|webp)$/.test(n)) return "image";
  if (n.endsWith(".mp4")) return "video";
  return "document";
};

export const releasePicked = (p: PickedFile) => p.previewUrl && URL.revokeObjectURL(p.previewUrl);

const EXT_STYLE: Record<string, { label: string; tone: string; icon: typeof FileText }> = {
  pdf: { label: "PDF", tone: "bg-[#ffe8e8] text-loss", icon: FileText },
  xlsx: { label: "XLSX", tone: "bg-[#e2f8ea] text-finance", icon: FileSpreadsheet },
  xls: { label: "XLS", tone: "bg-[#e2f8ea] text-finance", icon: FileSpreadsheet },
  csv: { label: "CSV", tone: "bg-[#dcf7f3] text-recce", icon: FileSpreadsheet },
  docx: { label: "DOC", tone: "bg-[#e8f0ff] text-royal", icon: FileText },
  pptx: { label: "PPT", tone: "bg-[#fff0e0] text-approval", icon: FileText },
  mp4: { label: "MP4", tone: "bg-[#f1e6ff] text-vendor", icon: FileIcon },
};

/** File-type tile: a distinct colour and label per type (PDF, XLSX, CSV, DOC, PPT), or a picture icon for images. */
export function FileTypeIcon({ kind, name, className }: { kind: FileKind; name?: string; className?: string }) {
  const ext = name?.split(".").pop()?.toLowerCase() ?? "";
  const s = EXT_STYLE[ext] ?? (kind === "image" ? { label: "IMG", tone: "bg-[#e8f0ff] text-royal", icon: ImageIcon } : { label: ext.slice(0, 4).toUpperCase() || "FILE", tone: "bg-muted text-muted-foreground", icon: FileIcon });
  const Icon = kind === "image" ? ImageIcon : s.icon;
  return (
    <span className={cn("flex size-10 shrink-0 flex-col items-center justify-center rounded-lg", s.tone, className)} data-filetype={ext || kind}>
      <Icon className="size-4" aria-hidden />
      <span className="mt-0.5 text-[8px] font-bold leading-none tracking-wide">{s.label}</span>
    </span>
  );
}

/**
 * Drag-and-drop picker. Files are only collected here; the caller uploads them to the server
 * (so nothing is half-saved while a form is still being filled in).
 */
export function FileDrop({ onFiles, onError, variant = "zone", label = "Add Document" }: { onFiles: (files: PickedFile[]) => void; onError?: (msg: string) => void; /** "button" shows only a compact button (the picker and the same file checks), no drop zone. */ variant?: "zone" | "button"; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  /** Files turned away at selection time, shown under the drop zone until the next pick. */
  const [rejected, setRejected] = useState<string[]>([]);
  // Limits and allowed types come only from the server settings (.env); nothing is hard-coded here.
  const limits = useFileLimits().data;
  const maxImage = limits?.maxImageBytes ?? 0;
  const maxOther = limits?.maxFileBytes ?? 0;
  const accept = limits?.extensions.join(",") ?? "";

  function handle(list: FileList | null) {
    if (!list?.length || !limits) return;
    const out: PickedFile[] = [];
    const turnedAway: string[] = [];
    const reject = (msg: string) => {
      turnedAway.push(msg);
      onError?.(msg);
    };
    for (const file of Array.from(list)) {
      const kind = kindOfName(file.name);
      if (!accept.split(",").some((e) => file.name.toLowerCase().endsWith(e))) {
        reject(`${file.name}: this file type is not allowed`);
        continue;
      }
      const limit = kind === "image" ? maxImage : maxOther;
      if (file.size > limit) {
        reject(`${file.name} is ${formatBytes(file.size)}, but ${kind === "image" ? "images" : "files"} can be at most ${formatBytes(limit)}. It was not added.`);
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
    setRejected(turnedAway);
    if (out.length) onFiles(out);
    if (input.current) input.current.value = "";
  }

  if (variant === "button") {
    return (
      <div className="space-y-2">
        <button type="button" disabled={!limits} onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-royal px-3.5 py-2 text-sm font-medium text-white hover:bg-royal/90 disabled:opacity-60">
          <UploadCloud className="size-4" aria-hidden /> {label}
        </button>
        <input ref={input} type="file" multiple accept={accept} className="sr-only" onChange={(e) => handle(e.target.files)} aria-label="Upload documents" />
        {rejected.length > 0 && (
          <div role="alert" data-testid="rejected-files" className="rounded-lg border border-[#ffc9c9] bg-[#fff5f5] p-3 text-sm text-loss">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" aria-hidden /> Not added</p>
              <button type="button" onClick={() => setRejected([])} aria-label="Dismiss" className="rounded p-0.5 hover:bg-loss/10"><X className="size-4" aria-hidden /></button>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{rejected.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
      <p className="text-xs text-muted-foreground">.xlsx .csv .pdf .docx .pptx .png .jpg &middot; {limits ? <>images up to {formatBytes(maxImage)}, others up to {formatBytes(maxOther)}</> : "loading limits…"}</p>
      <button type="button" disabled={!limits} onClick={() => input.current?.click()} className="mt-1 disabled:opacity-60 rounded-lg bg-royal px-4 py-2 text-sm font-medium text-white hover:bg-royal/90">
        Browse files
      </button>
      <input ref={input} type="file" multiple accept={accept} className="sr-only" onChange={(e) => handle(e.target.files)} aria-label="Upload documents" />
    </div>
    {rejected.length > 0 && (
      <div role="alert" data-testid="rejected-files" className="rounded-lg border border-[#ffc9c9] bg-[#fff5f5] p-3 text-sm text-loss">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" aria-hidden /> Not added</p>
          <button type="button" onClick={() => setRejected([])} aria-label="Dismiss" className="rounded p-0.5 hover:bg-loss/10"><X className="size-4" aria-hidden /></button>
        </div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">{rejected.map((m) => <li key={m}>{m}</li>)}</ul>
      </div>
    )}
    </div>
  );
}
