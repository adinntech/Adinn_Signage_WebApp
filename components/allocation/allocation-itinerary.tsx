"use client";

import { useMemo, useState } from "react";
import { Clock, ExternalLink, Route, Satellite } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useItinerary } from "@/lib/api/allocation";
import { AllocationMap } from "./map-loader";

const DAY_COLORS = ["#2563eb", "#dc2626", "#059669", "#9333ea", "#f97316", "#0d9488", "#db2777", "#ca8a04"];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const hm = (m: number | null) => (m == null ? "" : m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`);

/**
 * Day-wise road round trips for the in-house team (like a Google Maps multi-stop route): each day starts and ends at the
 * start point, with real road distance and time, a map, and a button that opens the same route in Google Maps.
 */
export function AllocationItinerary({ projectId }: { projectId: string }) {
  const [per, setPer] = useState("8");
  const [open, setOpen] = useState<number | null>(null);
  const n = /^[1-9]\d*$/.test(per) && Number(per) <= 60 ? Number(per) : 8;
  const q = useItinerary(projectId, n);
  const it = q.data;
  const shown = open ?? null;
  const days = useMemo(() => (shown == null ? it?.days ?? [] : (it?.days ?? []).filter((d) => d.day === shown)), [it, shown]);
  const pins = useMemo(() => days.flatMap((d) => d.stops.map((s, i) => ({ id: `${d.day}-${s.id}`, name: s.name, sub: `Day ${d.day} · stop ${i + 1}${s.area ? ` · ${s.area}` : ""}`, lat: s.lat, lng: s.lng, color: DAY_COLORS[(d.day - 1) % DAY_COLORS.length]!, label: String(i + 1) }))), [days]);
  const routes = useMemo(() => days.map((d) => ({ color: DAY_COLORS[(d.day - 1) % DAY_COLORS.length]!, coords: d.path })), [days]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-2">
        {q.isPending && <RowsSkeleton rows={4} />}
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} title="Travel plan not ready" />}
        {it && <AllocationMap pins={pins} origin={it.origin} routes={routes} height={560} />}
        {it && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {it.roadDistance ? <Badge tone="success"><Satellite className="size-3" aria-hidden />Real road distance</Badge> : <Badge tone="warning">Straight-line estimate (road service not reachable)</Badge>}
            Numbers on the map are the visiting order within the day.
          </p>
        )}
      </div>

      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-surface p-4 shadow-soft">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><Route className="size-4 text-royal" aria-hidden /> In-house recce travel plan</h3>
          <Field label="Shops per day" htmlFor="per-day" hint="Google Maps shows up to 10 stops in one route; 8 works well"><Input id="per-day" format="digits" value={per} onChange={(e) => { setPer(e.target.value); setOpen(null); }} /></Field>
          {it && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-[#e8f0ff] p-2"><dt className="text-xs text-muted-foreground">Shops</dt><dd className="font-bold tabular-nums">{it.totalShops}</dd></div>
              <div className="rounded-lg bg-[#e8f0ff] p-2"><dt className="text-xs text-muted-foreground">Total distance</dt><dd className="font-bold tabular-nums">{it.totalKm} km</dd></div>
              <div className="rounded-lg bg-[#e2f8ea] p-2"><dt className="text-xs text-muted-foreground">Days</dt><dd className="font-bold tabular-nums">{it.estimate.days}</dd></div>
              <div className="rounded-lg bg-[#e2f8ea] p-2"><dt className="text-xs text-muted-foreground">Est. cost</dt><dd className="font-bold tabular-nums">{inr(it.estimate.total)}</dd></div>
            </dl>
          )}
          {it && it.withoutCoords > 0 && <p className="mt-2 text-xs text-approval">{it.withoutCoords} in-house shop(s) have no map position and are not in the plan. Use “Locate shops” on the Map view.</p>}
          {it && <p className="mt-2 text-xs text-muted-foreground">Food {inr(it.estimate.food)} · fuel {inr(it.estimate.fuel)}. Each day returns to the start point, so no stay is added. The Cost Comparison screen has the full plan with trip dates and stay.</p>}
        </section>

        {it && it.days.length > 0 && (
          <ol className="max-h-[420px] space-y-2 overflow-y-auto" aria-label="Days">
            {it.days.map((d) => (
              <li key={d.day} className="rounded-xl border border-border bg-surface p-3 text-sm shadow-soft" style={{ borderLeft: `4px solid ${DAY_COLORS[(d.day - 1) % DAY_COLORS.length]}` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" aria-pressed={shown === d.day} onClick={() => setOpen(shown === d.day ? null : d.day)} className="font-semibold text-navy hover:underline">Day {d.day}</button>
                  <span className="text-xs text-muted-foreground">{d.stops.length} shops · {d.km} km{d.minutes != null ? <> · <Clock className="inline size-3" aria-hidden /> {hm(d.minutes)}</> : null}</span>
                  <Button asChild size="sm" variant="outline" className="ml-auto"><a href={d.googleAddressUrl || d.googleUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open day ${d.day} in Google Maps`}><ExternalLink className="size-3.5" aria-hidden /> Google Maps</a></Button>
                </div>
                <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {d.stops.map((s, i) => <li key={s.id} className="flex gap-2"><span className="w-4 shrink-0 text-right tabular-nums">{i + 1}.</span><span className="min-w-0 truncate">{s.name}{s.area ? ` — ${s.area}` : ""}</span><span className="ml-auto shrink-0 tabular-nums">{s.legKm} km</span></li>)}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
