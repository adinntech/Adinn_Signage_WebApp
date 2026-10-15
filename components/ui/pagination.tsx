import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/api";
import { formatNumber } from "@/lib/format";

export function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (p: number) => void }) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        {formatNumber(from)}-{formatNumber(to)} of {formatNumber(meta.total)}
      </p>
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
