"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { RATE_UNITS, useRateItems, type QuotationLine, type RateItem } from "@/lib/api/ratecards";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Copy From Master Rate Card: pick master items; each becomes a quotation line with the master rate as a snapshot. */
export function CopyFromMasterDialog({ open, onOpenChange, existingIds, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; existingIds: string[]; onAdd: (items: RateItem[]) => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, RateItem>>({});
  const dq = useDebounced(q);
  const list = useRateItems({ q: dq, limit: 100, sort: "particulars" }, open);
  const rows = list.data?.data ?? [];
  const count = Object.keys(picked).length;
  const toggle = (r: RateItem) => setPicked((p) => (p[r._id] ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== r._id)) : { ...p, [r._id]: r }));

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked({});
        onOpenChange(o);
      }}
      title="Copy From Master Rate Card"
      description="Selected items are copied with their current master rate. Changing quoted rates here never changes the master rate card."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={!count}
            onClick={() => {
              onAdd(Object.values(picked));
              setPicked({});
              onOpenChange(false);
            }}
          >
            Add {count || ""} Item{count === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search master items" placeholder="Search particulars or specifications" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.isPending ? (
        <RowsSkeleton rows={4} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No master items found" description="Add items in Rate Card Management." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => {
            const already = existingIds.includes(r._id);
            const on = !!picked[r._id];
            return (
              <li key={r._id}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => toggle(r)}
                  aria-pressed={on}
                  className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50", on && "bg-brand-soft/60")}
                >
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border-2", on ? "border-brand bg-brand text-white" : "border-border")}>{on && <Check className="size-3.5" aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.particulars}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.specifications || "-"}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{RATE_UNITS[r.unit]}</span>
                  <span className="w-24 text-right font-semibold">{formatCurrency(r.rate)}</span>
                  {already && <Badge>Added</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Compare Rates: quoted rate vs the master rate copied into the quote vs today's master rate. */
export function CompareRatesDialog({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: QuotationLine[] }) {
  const list = useRateItems({ limit: 500 }, open);
  const master = useMemo(() => new Map((list.data?.data ?? []).map((r) => [r._id, r])), [list.data]);
  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Compare Rates" description="Quoted rate against the master rate captured in this quote and the current master rate." className="max-w-4xl">
      {list.isPending ? (
        <RowsSkeleton rows={4} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Signage Particulars</th>
                <th className="px-3 py-2.5 text-right">Master (in quote)</th>
                <th className="px-3 py-2.5 text-right">Master (today)</th>
                <th className="px-3 py-2.5 text-right">Quoted</th>
                <th className="px-3 py-2.5 text-right">Difference</th>
                <th className="px-3 py-2.5">Override Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, i) => {
                const now = it.masterItemId ? master.get(it.masterItemId) : undefined;
                const base = it.masterRate ?? null;
                const diff = base != null ? Number(it.quotedRate) - base : null;
                return (
                  <tr key={i}>
                    <td className="px-3 py-2.5">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">
                      {it.particulars}
                      {!it.masterItemId && <span className="ml-1 text-xs text-muted-foreground">(custom)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{base != null ? formatCurrency(base) : "-"}</td>
                    <td className="px-3 py-2.5 text-right">
                      {now ? formatCurrency(now.rate) : it.masterItemId ? <span className="text-xs text-muted-foreground">Archived</span> : "-"}
                      {now && base != null && now.rate !== base && <span className="block text-xs text-warning">Master changed</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(Number(it.quotedRate) || 0)}</td>
                    <td className={cn("px-3 py-2.5 text-right font-medium", diff == null ? "" : diff < 0 ? "text-danger" : diff > 0 ? "text-success" : "text-muted-foreground")}>
                      {diff == null ? "-" : diff === 0 ? "Same" : `${diff > 0 ? "+" : ""}${formatCurrency(diff)} (${pct(Number(it.quotedRate), base!).toFixed(1)}%)`}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{it.overrideReason || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
