import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/api";
import { formatNumber } from "@/lib/format";

/** Page sizes offered by lists that let the user choose how many rows to see. */
export const PAGE_SIZES = [10, 40, 50, 100] as const;

/** Pass `onLimit` to add the "rows per page" choice (10, 40, 50, 100); the caller resets to page 1 and refetches. */
export function Pagination({ meta, onPage, onLimit }: { meta?: PageMeta; onPage: (p: number) => void; onLimit?: (limit: number) => void }) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground" aria-live="polite">
          {formatNumber(from)}-{formatNumber(to)} of {formatNumber(meta.total)}
        </p>
        {onLimit && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Rows per page
            <select value={meta.limit} onChange={(e) => onLimit(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          <ChevronLeft className="size-4" aria-hidden /> Prev
        </Button>
        <span className="px-2 text-muted-foreground">
          Page {meta.page} / {meta.totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
