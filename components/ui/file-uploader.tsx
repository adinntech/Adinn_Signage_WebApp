"use client";

import * as React from "react";
import { Eye, FileText, UploadCloud, X } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Drag-and-drop or click-to-browse picker. Only selects files; the caller uploads them. */
export function FileUploader({
  id,
  files,
  onChange,
  accept = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx",
  multiple = false,
  maxSizeMb = 50,
  hint,
  disabled,
  invalid,
  compact,
  onPreview,
  typeError,
}: {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  hint?: string;
  disabled?: boolean;
  invalid?: boolean;
  compact?: boolean;
  /** Shows a View button on each picked file (e.g. to check a certificate before saving). */
  onPreview?: (file: File) => void;
  /** Message for a file of another type (default: "<name>: this file type is not allowed"). */
  typeError?: string;
}) {
  const [drag, setDrag] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const exts = accept.split(",").map((s) => s.trim().toLowerCase());

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    const bad = picked.find((f) => !exts.some((x) => f.name.toLowerCase().endsWith(x)));
    if (bad) return setError(typeError ?? `${bad.name}: this file type is not allowed`);
    const big = picked.find((f) => f.size > maxSizeMb * 1048576);
    if (big) return setError(`${big.name} is larger than ${maxSizeMb} MB`);
    setError(null);
    onChange(multiple ? [...files, ...picked].slice(0, 10) : picked.slice(0, 1));
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={cn(
          // relative: keeps the visually hidden (absolute) file input inside this box. Without it the input is placed
          // against the page, below the bounded app shell, and clicking it scrolls the whole window to a blank area.
          "relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-background text-center transition-colors hover:border-brand/50 hover:bg-brand-soft/40",
          compact ? "px-3 py-3" : "px-4 py-6",
          drag && "border-brand bg-brand-soft/60",
          (invalid || error) && "border-danger",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloud className={cn("text-brand", compact ? "size-5" : "size-7")} aria-hidden />
        <span className="text-sm font-medium">
          Click to upload <span className="font-normal text-muted-foreground">or drag and drop</span>
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              {onPreview && (
                <button type="button" aria-label={`View ${f.name}`} title="View" onClick={() => onPreview(f)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-brand">
                  <Eye className="size-4" aria-hidden />
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-danger"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
