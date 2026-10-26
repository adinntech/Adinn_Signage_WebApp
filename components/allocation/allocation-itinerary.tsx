"use client";

import { useMemo, useState } from "react";
import { Calculator, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useApplyItinerary, useItinerary } from "@/lib/api/allocation";
import { AllocationMap } from "./map-loader";

const DAY_COLORS = ["#2563eb", "#dc2626", "#059669", "#9333ea", "#f97316", "#0d9488", "#db2777", "#ca8a04"];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Day-wise travel plan for the in-house team's shops, with the km and cost it implies. */
export function AllocationItinerary({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [per, setPer] = useState("12");
  const n = /^[1-9]\d*$/.test(per) && Number(per) <= 60 ? Number(per) : 12;
  const q = useItinerary(projectId, n);
  const apply = useApplyItinerary(projectId);
  const it = q.data;
  const pins = useMemo(() => (it?.days ?? []).flatMap((d) => d.stops.map((s, i) => ({ id: s.id, name: s.name, sub: `Day ${d.day} · stop ${i + 1} · ${s.legKm} km`, lat: s.lat, lng: s.lng, color: DAY_COLORS[(d.day - 1) % DAY_COLORS.length]!, label: String(d.day) }))), [it]);
  const routes = useMemo(() => (it?.days ?? []).map((d) => ({ color: DAY_COLORS[(d.day - 1) % DAY_COLORS.length]!, coords: [[it!.origin.lat, it!.origin.lng] as [number, number], ...d.stops.map((s) => [s.lat, s.lng] as [number, number])] })), [it]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} title="Travel plan not ready" /> : <AllocationMap pins={pins} origin={it?.origin ?? null} routes={routes} height={520} />}
      </div>
      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-surface p-4 shadow-soft">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><Route className="size-4 text-royal" aria-hidden /> In-house recce travel plan</h3>
          <Field label="Shops per day" htmlFor="per-day" hint="The route is cut into days of this many shops"><Input id="per-day" inputMode="numeric" value={per} onChange={(e) => setPer(e.target.value)} /></Field>
          {it && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-[#e8f0ff] p-2"><dt className="text-xs text-muted-foreground">Shops</dt><dd className="font-bold tabular-nums">{it.totalShops}</dd></div>
              <div className="rounded-lg bg-[#e8f0ff] p-2"><dt className="text-xs text-muted-foreground">Total distance</dt><dd className="font-bold tabular-nums">{it.totalKm} km</dd></div>
              <div className="rounded-lg bg-[#e2f8ea] p-2"><dt className="text-xs text-muted-foreground">Days / nights</dt><dd className="font-bold tabular-nums">{it.estimate.days} / {it.estimate.nights}</dd></div>
              <div className="rounded-lg bg-[#e2f8ea] p-2"><dt className="text-xs text-muted-foreground">Est. cost</dt><dd className="font-bold tabular-nums">{inr(it.estimate.total)}</dd></div>
            </dl>
          )}
          {it && it.withoutCoords > 0 && <p className="mt-2 text-xs text-approval">{it.withoutCoords} in-house shop(s) have no map position and are not in the plan.</p>}
          {it && <p className="mt-2 text-xs text-muted-foreground">Food {inr(it.estimate.food)} · stay {inr(it.estimate.stay)} · travel {inr(it.estimate.travel)}</p>}
          <Button className="mt-3 w-full bg-royal hover:bg-royal/90" disabled={!it || it.totalShops === 0} loading={apply.isPending} onClick={() => apply.mutate(n, { onSuccess: () => toast("Days, nights and km added to the cost comparison"), onError: (e) => toast(errorMessage(e), "error") })}><Calculator className="size-4" aria-hidden /> Use in cost comparison</Button>
        </section>
        {it && it.days.length > 0 && (
          <ol className="max-h-80 space-y-2 overflow-y-auto">
            {it.days.map((d) => (
              <li key={d.day} className="rounded-xl border border-border bg-surface p-3 text-sm shadow-soft" style={{ borderLeft: `4px solid ${DAY_COLORS[(d.day - 1) % DAY_COLORS.length]}` }}>
                <p className="font-semibold text-navy">Day {d.day} — {d.stops.length} shops · {d.km} km</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{d.stops.slice(0, 4).map((s) => s.name).join(" → ")}{d.stops.length > 4 ? ` → +${d.stops.length - 4} more` : ""}</p>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
