"use client";

import { AlertTriangle, Ban, CheckCircle2, Copy, Loader2, RotateCw, Trash2, X } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UploadItem } from "@/hooks/use-file-uploader";
import { FileTypeIcon } from "./file-drop";

/** Every picked file with its live state: checking, ready, uploading (with a progress bar), done, duplicate or failed. */
export function UploadQueue({ items, onRemove, onRetry, onCancel }: { items: UploadItem[]; onRemove: (id: string) => void; onRetry: (id: string) => void; onCancel: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2" aria-label="Files being uploaded">
      {items.map((i) => (
        <li
          key={i.id}
          data-testid="upload-item"
          data-status={i.status}
          className={cn(
            "rounded-lg border bg-surface p-2.5",
            i.status === "duplicate" ? "border-[#ffd9b0] bg-[#fff7ed]" : i.status === "failed" ? "border-[#ffc9c9] bg-[#fff5f5]" : i.status === "cancelled" ? "border-border bg-muted/40" : i.status === "done" ? "border-[#bdebcc]" : "border-border",
          )}
        >
          <div className="flex items-center gap-3">
            {i.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.previewUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <FileTypeIcon kind={i.kind} name={i.name} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{formatBytes(i.size)}</span>
                {i.status === "checking" && (
                  <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" aria-hidden /> Checking for duplicates…</span>
                )}
                {i.status === "ready" && <span>Ready to upload</span>}
                {i.status === "uploading" && <span className="font-medium text-royal">Uploading {i.progress}%</span>}
                {i.status === "done" && (
                  <span className="inline-flex items-center gap-1 font-medium text-finance"><CheckCircle2 className="size-3.5" aria-hidden /> Uploaded</span>
                )}
                {i.status === "duplicate" && (
                  <span className="inline-flex items-center gap-1 font-medium text-approval"><Copy className="size-3.5" aria-hidden /> Duplicate, not uploaded</span>
                )}
                {i.status === "cancelled" && (
                  <span className="inline-flex items-center gap-1 font-medium text-muted-foreground"><Ban className="size-3.5" aria-hidden /> Cancelled</span>
                )}
                {i.status === "failed" && (
                  <span className="inline-flex items-center gap-1 font-medium text-loss"><AlertTriangle className="size-3.5" aria-hidden /> Upload failed</span>
                )}
              </p>
            </div>
            {(i.status === "failed" || i.status === "cancelled") && (
              <button type="button" onClick={() => onRetry(i.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-royal hover:bg-royal/10">
                <RotateCw className="size-3.5" aria-hidden /> Retry
              </button>
            )}
            {i.status === "uploading" ? (
              <button
                type="button"
                onClick={() => onCancel(i.id)}
                aria-label={`Cancel uploading ${i.name}`}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-loss hover:bg-danger-soft"
              >
                <X className="size-3.5" aria-hidden /> Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRemove(i.id)}
                aria-label={`Remove ${i.name}`}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {i.status === "uploading" && (
            <div
              role="progressbar"
              aria-label={`Uploading ${i.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={i.progress}
              className="mt-2 h-2 overflow-hidden rounded-full bg-border"
            >
              <div className="h-full rounded-full bg-royal transition-[width] duration-150" style={{ width: `${i.progress}%` }} />
            </div>
          )}
          {(i.status === "duplicate" || i.status === "failed" || i.status === "cancelled") && i.message && (
            <p className={cn("mt-1.5 text-xs", i.status === "duplicate" ? "text-approval" : i.status === "cancelled" ? "text-muted-foreground" : "text-loss")}>{i.message}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
