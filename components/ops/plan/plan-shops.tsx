"use client";

import Link from "next/link";
import { CalendarClock, FileSearch, Flag, LayoutList, MapPin, RefreshCw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import type { CostView } from "@/lib/api/costing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Store; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl p-3", tone)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/70"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0"><p className="text-xs font-medium opacity-80">{label}</p><p className="truncate text-lg font-bold tabular-nums">{value}</p></div>
    </div>
  );
}

/** Step 1: what is in the client's shop list: how many shops, in which districts, how far, and by when. */
export function PlanShops({ projectId, view, canEdit, syncing, onSync }: { projectId: string; view: CostView; canEdit: boolean; syncing: boolean; onSync: () => void }) {
  const inPlan = new Set(view.plan.legs.map((l) => l.key));
  const total = view.districts.reduce((a, d) => a + d.shops, 0);
  const located = view.districts.reduce((a, d) => a + d.located, 0);
  const behind = view.districts.some((d) => !inPlan.has(d.key)) || view.plan.legs.some((l) => !view.districts.some((d) => d.key === l.key));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Store} label="Shops in the client's list" value={total} tone="bg-[#e8f0ff] text-royal" />
        <Stat icon={LayoutList} label="Districts" value={view.districts.length} tone="bg-[#f1e6ff] text-vendor" />
        <Stat icon={CalendarClock} label="Recce deadline" value={view.project.deadline ? formatDate(view.project.deadline) : "Not set"} tone="bg-[#fff0e0] text-approval" />
        <Stat icon={Flag} label="Start point" value={view.project.origin ? view.project.origin.name : "Not set"} tone={view.project.origin ? "bg-[#e2f8ea] text-finance" : "bg-[#fdecec] text-loss"} />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No shops yet"
          description="Open the file BD attached and extract its shops. The districts and shop counts then appear here."
          action={<Button asChild className="bg-royal hover:bg-royal/90"><Link href={`/operations/projects/${projectId}?tab=work`}>Open BD attachments</Link></Button>}
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-navy">Shops by district</h3>
              <p className="text-xs text-muted-foreground">Each district becomes one area in the plan, so it can go to the in-house team or to a vendor on its own.</p>
            </div>
            {canEdit && <Button className="bg-royal hover:bg-royal/90" loading={syncing} onClick={onSync}><RefreshCw className="size-4" aria-hidden /> {view.saved && view.plan.legs.length ? "Refresh areas from shops" : "Create plan from shops"}</Button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr><th className="px-4 py-2.5">District</th><th className="px-4 py-2.5 text-right">Shops</th><th className="px-4 py-2.5">On the map</th><th className="px-4 py-2.5 text-right">From start point</th><th className="px-4 py-2.5">In the plan</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.districts.map((d) => {
                  const pct = d.shops ? Math.round((d.located / d.shops) * 100) : 0;
                  return (
                    <tr key={d.key}>
                      <td className="px-4 py-2.5 font-semibold text-navy">{d.name ?? <span className="font-normal text-muted-foreground">No district</span>}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{d.shops}</td>
                      <td className="w-56 px-4 py-2.5">
                        <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${d.name ?? "No district"} shops on the map`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className={cn("h-full rounded-full", pct === 100 ? "bg-finance" : "bg-approval")} style={{ width: `${pct}%` }} /></div><span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{d.located}/{d.shops}</span></div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{d.distanceKm != null ? `${d.distanceKm} km` : <span className="text-xs text-muted-foreground">Locate shops</span>}</td>
                      <td className="px-4 py-2.5">{inPlan.has(d.key) ? <span className="rounded-full bg-[#e2f8ea] px-2.5 py-0.5 text-xs font-semibold text-finance">Yes</span> : <span className="rounded-full bg-[#fff0e0] px-2.5 py-0.5 text-xs font-semibold text-approval">Not yet</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold"><tr><td className="px-4 py-2.5 text-navy">Total</td><td className="px-4 py-2.5 text-right tabular-nums">{total}</td><td className="px-4 py-2.5 text-xs font-normal text-muted-foreground">{located} of {total} on the map</td><td /><td /></tr></tfoot>
            </table>
          </div>
          {located < total && (
            <p className="flex flex-wrap items-center gap-2 border-t border-border bg-[#fff7ed] px-4 py-2.5 text-xs text-approval"><MapPin className="size-3.5" aria-hidden /> Distances need each shop on the map. <Link href={`/operations/allocation/${projectId}`} className="font-semibold underline">Open Shop Allocation → Map view → Locate shops</Link></p>
          )}
          {behind && view.plan.legs.length > 0 && <p className="border-t border-border bg-[#fff7ed] px-4 py-2.5 text-xs text-approval">The shops changed since the plan was made. Refresh the areas to match them.</p>}
        </section>
      )}
    </div>
  );
}
