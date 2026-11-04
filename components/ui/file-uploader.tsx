"use client";

import * as React from "react";
import { Eye, FileText, UploadCloud, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useFileLimits } from "@/lib/api/pipeline";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i;
const mb = (bytes: number) => `${Math.round((bytes / 1048576) * 10) / 10} MB`;

/** Drag-and-drop or click-to-browse picker. Only selects files; the caller uploads them. */
export function FileUploader({
  id,
  files,
  onChange,
  accept = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx",
  multiple = false,
  maxSizeMb,
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
  /** Document limit override in MB; by default the server's MAX_FILE_SIZE (images: MAX_IMAGE_SIZE). */
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
  const toast = useToast();
  const exts = accept.split(",").map((s) => s.trim().toLowerCase());
  // Size limits from the server settings (.env MAX_FILE_SIZE / MAX_IMAGE_SIZE), the same numbers the upload checks.
  const limits = useFileLimits().data;
  const maxDoc = maxSizeMb ? maxSizeMb * 1048576 : (limits?.maxFileBytes ?? 50 * 1048576);
  const maxImage = Math.min(limits?.maxImageBytes ?? 3 * 1048576, maxDoc);
  const takesImages = exts.some((x) => IMAGE_RE.test(`f${x}`));
  const limitHint = takesImages ? `Documents up to ${mb(maxDoc)} · Images up to ${mb(maxImage)}` : `Up to ${mb(maxDoc)} per file`;

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    const bad = picked.find((f) => !exts.some((x) => f.name.toLowerCase().endsWith(x)));
    if (bad) return setError(typeError ?? `${bad.name}: this file type is not allowed`);
    // Too large: that file is left out with a toast (images and documents have their own limit); the others are added.
    const tooBig: string[] = [];
    const ok = picked.filter((f) => {
      const image = IMAGE_RE.test(f.name);
      const limit = image ? maxImage : maxDoc;
      if (f.size <= limit) return true;
      const msg = `${f.name} is ${mb(f.size)}: ${image ? "images" : "documents"} can be up to ${mb(limit)}.`;
      tooBig.push(msg);
      toast(msg, "error");
      return false;
    });
    setError(tooBig.length ? tooBig.join(" ") : null);
    if (!ok.length) return;
    onChange(multiple ? [...files, ...ok].slice(0, 10) : ok.slice(0, 1));
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
        <span className="text-xs text-muted-foreground">{limitHint}</span>
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
