"use client";

import { Paperclip, X } from "lucide-react";
import type { Attachment } from "@/lib/api/common";
import { formatBytes } from "@/lib/format";

export function AttachmentList({ items }: { items?: Attachment[] }) {
  if (!items?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((a, i) => (
        <li
          key={`${a.name}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="max-w-48 truncate">{a.name}</span>
          {a.size !== undefined && <span className="text-muted-foreground">{formatBytes(a.size)}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Records name/size/type only. Real upload storage comes in a later phase. */
export function AttachmentInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Attachment[];
  onChange: (v: Attachment[]) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        id={id}
        type="file"
        multiple
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary-hover"
        onChange={(e) => {
          const added = Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size, mimeType: f.type || undefined }));
          onChange([...value, ...added].slice(0, 50));
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">Only file name, size and type are recorded for now; files are not uploaded yet.</p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((a, i) => (
            <li key={`${a.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs">
              <span className="max-w-48 truncate">{a.name}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="hover:text-danger"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
