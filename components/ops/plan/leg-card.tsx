"use client";

import { AlertTriangle, BadgeCheck, Building2, CalendarClock, ExternalLink, Home, Route as RouteIcon, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Channel, CostRates, LegInput, LegLinks, PlanLeg, RouteInfo } from "@/lib/api/costing";
import type { Vendor } from "@/lib/api/vendors";
import { cn } from "@/lib/utils";

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const hm = (m: number | null) => (m == null ? "" : m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`);

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2 py-1 text-sm", strong && "mt-1 border-t border-border pt-2 font-bold")}>
      <span className={cn("min-w-0", strong ? "text-navy" : "text-muted-foreground")}>{label}{hint && <span className="block text-[11px] font-normal text-muted-foreground/80">{hint}</span>}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}
function Mini({ label, htmlFor, children, error }: { label: string; htmlFor: string; children: React.ReactNode; error?: string | undefined }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

/**
 * One area of the project (a district): its shops, the in-house cost and the vendor cost side by side, and the choice.
 * What is typed here is saved with the plan; every rupee shown comes back from the server.
 */
export function LegCard({
  leg, draft, rates, vendors, canEdit, unsaved, routing, route, links, linking, errors, onChange, onRoute, onLinks,
}: {
  leg: PlanLeg;
  draft: LegInput;
  rates: CostRates;
  vendors: Vendor[];
  canEdit: boolean;
  /** The figures shown are from the last save; this area has edits that are not saved yet. */
  unsaved: boolean;
  routing: boolean;
  route?: RouteInfo | undefined;
  links?: LegLinks | undefined;
  linking: boolean;
  errors: Record<string, string>;
  onChange: (patch: Partial<LegInput>) => void;
  onRoute: () => void;
  onLinks: () => void;
}) {
  const c = leg.calc;
  const id = (f: string) => `${leg.key}-${f}`;
  const choose = (ch: Channel) => canEdit && onChange({ channel: draft.channel === ch ? null : ch });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const picked = draft.channel;
  const diff = c.comparison.difference;
  const vendorPick = vendors.find((v) => v._id === draft.vendorId);

  return (
    <article aria-label={`${leg.name} plan`} className={cn("overflow-hidden rounded-2xl border bg-surface shadow-soft", picked ? "border-royal/40" : "border-border")}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-[#f4f8ff] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-navy">{leg.name} <span className="rounded-full bg-royal px-2.5 py-0.5 text-xs font-semibold text-white">{leg.shops} shops</span>{unsaved && <Badge tone="warning">Unsaved changes</Badge>}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{leg.distanceKm ? `${leg.distanceKm} km from the start point` : "Distance not set"}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden /> Recce by
          <Input aria-label={`Recce deadline for ${leg.name}`} type="date" className="w-40" disabled={!canEdit} value={draft.deadline ?? ""} onChange={(e) => onChange({ deadline: e.target.value || undefined })} />
        </label>
        <div role="group" aria-label={`How ${leg.name} will be done`} className="flex overflow-hidden rounded-lg border border-border">
          {(["IN_HOUSE", "VENDOR"] as const).map((ch) => (
            <button key={ch} type="button" disabled={!canEdit} aria-pressed={picked === ch} onClick={() => choose(ch)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors", picked === ch ? (ch === "IN_HOUSE" ? "bg-finance text-white" : "bg-vendor text-white") : "bg-surface text-muted-foreground hover:bg-muted")}>
              {ch === "IN_HOUSE" ? <Home className="size-4" aria-hidden /> : <Building2 className="size-4" aria-hidden />}{ch === "IN_HOUSE" ? "In-house" : "Vendor"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-px bg-border md:grid-cols-2">
        {/* ------------------------------------------------------------- in-house */}
        <section className={cn("space-y-3 bg-surface p-4", picked === "IN_HOUSE" && "bg-[#f3fbf7]")}>
          <h4 className="flex items-center gap-2 text-sm font-bold text-finance"><Home className="size-4" aria-hidden /> In-house team {c.recommended === "IN_HOUSE" && <Badge tone="success"><BadgeCheck className="size-3" aria-hidden />Recommended</Badge>}</h4>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Trip starts" htmlFor={id("start")} error={errors.tripStart}><Input id={id("start")} type="datetime-local" disabled={!canEdit} value={draft.tripStart ?? ""} onChange={(e) => onChange({ tripStart: e.target.value })} /></Mini>
            <Mini label="Trip ends" htmlFor={id("end")} error={errors.tripEnd}><Input id={id("end")} type="datetime-local" disabled={!canEdit} value={draft.tripEnd ?? ""} onChange={(e) => onChange({ tripEnd: e.target.value })} /></Mini>
            <Mini label="Route km (all days)" htmlFor={id("km")} error={errors.routeKm}><Input id={id("km")} format="decimal" disabled={!canEdit} value={draft.routeKm ?? ""} placeholder={`${Math.round(2 * (draft.distanceKm || 0))} (round trip)`} onChange={(e) => onChange({ routeKm: num(e.target.value) })} /></Mini>
            <Mini label="One-way distance (km)" htmlFor={id("dist")} error={errors.distanceKm}><Input id={id("dist")} format="decimal" disabled={!canEdit} value={draft.distanceKm} onChange={(e) => onChange({ distanceKm: Number(e.target.value) || 0 })} /></Mini>
            <Mini label="Clients on this trip" htmlFor={id("shared")}><Input id={id("shared")} format="digits" disabled={!canEdit} value={draft.clientsShared} onChange={(e) => onChange({ clientsShared: Math.max(1, Number(e.target.value) || 1) })} /></Mini>
            <Mini label="Other cost (₹)" htmlFor={id("other")}><Input id={id("other")} format="decimal" disabled={!canEdit} value={draft.otherAmount} onChange={(e) => onChange({ otherAmount: Number(e.target.value) || 0 })} /></Mini>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && <Button size="sm" variant="outline" loading={routing} onClick={onRoute}><RouteIcon className="size-4" aria-hidden /> Calculate road km</Button>}
            <Button size="sm" variant="outline" loading={linking} onClick={onLinks}><ExternalLink className="size-4" aria-hidden /> Shop addresses in Google Maps</Button>
          </div>
          {links && (
            <ul className="space-y-1 rounded-lg bg-[#fff7ed] p-2.5 text-xs text-navy" aria-label="Google Maps by address">
              {links.days.map((d) => (
                <li key={d.day} className="flex items-center gap-2"><span>Day {d.day}: {d.stops} shops (start point → shops → back)</span><a href={d.googleUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-royal hover:underline" aria-label={`Open day ${d.day} of ${leg.name} in Google Maps by address`}><ExternalLink className="size-3" aria-hidden /> Open</a></li>
              ))}
              <li className="text-[11px] text-muted-foreground">Opens the shops one after another, as you would add stops in Google Maps. Read the km and time there.</li>
            </ul>
          )}
          {route && (
            <div className="rounded-lg bg-[#eef4ff] p-2.5 text-xs text-navy">
              <p className="font-semibold">{route.totalKm} km over {route.days.length} day(s){route.roadDistance ? " (real roads)" : " (straight-line estimate)"}{route.missing ? ` · ${route.missing} shop(s) not on the map` : ""}</p>
              <ul className="mt-1 space-y-0.5">
                {route.days.map((d) => (
                  <li key={d.day} className="flex items-center gap-2"><span>Day {d.day}: {d.stops} shops · {d.km} km{d.minutes != null ? ` · ${hm(d.minutes)}` : ""}</span><a href={d.googleAddressUrl || d.googleUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-royal hover:underline" aria-label={`Open day ${d.day} of ${leg.name} in Google Maps`}><ExternalLink className="size-3" aria-hidden /> Google Maps</a></li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <Row label={`Food: ${c.inHouse.meals} meals × ${inr(rates.foodPerDay / 3)}`} hint={c.inHouse.datesAssumed ? "Trip dates not set: one day assumed" : `${c.inHouse.days} day(s) from start to end`} value={inr(c.inHouse.food)} />
            <Row label={`Stay: ${c.inHouse.nights} night(s) × ${inr(rates.stayPerNight)}`} value={inr(c.inHouse.stay)} />
            <Row label={`Fuel: ${c.inHouse.routeKm} km × ₹${rates.fuelRatePerKm}`} value={inr(c.inHouse.fuel)} />
            {c.inHouse.other > 0 && <Row label="Other" value={inr(c.inHouse.other)} />}
            {(draft.clientsShared ?? 1) > 1 && <Row label={`Shared by ${draft.clientsShared} clients`} value={`÷ ${draft.clientsShared}`} />}
            <Row label="In-house total" value={inr(c.inHouse.total)} strong />
            <p className={cn("text-right text-xs", c.flags.inHouseOverThreshold ? "font-semibold text-loss" : "text-muted-foreground")}>{inr(c.inHouse.perShop)} per shop</p>
          </div>
          {c.needsApproval.IN_HOUSE && <p className="flex items-start gap-1.5 rounded-lg bg-[#fff7ed] p-2 text-xs text-approval"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Needs special approval if chosen.</p>}
        </section>

        {/* --------------------------------------------------------------- vendor */}
        <section className={cn("space-y-3 bg-surface p-4", picked === "VENDOR" && "bg-[#f8f3fe]")}>
          <h4 className="flex items-center gap-2 text-sm font-bold text-vendor"><Building2 className="size-4" aria-hidden /> Vendor {c.recommended === "VENDOR" && <Badge tone="success"><BadgeCheck className="size-3" aria-hidden />Recommended</Badge>}</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Mini label="Vendor" htmlFor={id("vendor")} error={errors.vendorId}>
                <Select id={id("vendor")} disabled={!canEdit} value={draft.vendorId ?? ""} onChange={(e) => onChange({ vendorId: e.target.value || null })}>
                  <option value="">Choose a vendor</option>
                  {vendors.map((v) => <option key={v._id} value={v._id}>{v.name} · {v.code}{v.ratePerShop != null ? ` · ₹${v.ratePerShop}/shop` : ""}</option>)}
                </Select>
              </Mini>
            </div>
            <Mini label="Agreed price per shop (₹)" htmlFor={id("rate")} error={errors.vendorRate}><Input id={id("rate")} format="decimal" disabled={!canEdit} value={draft.vendorRate ?? ""} placeholder={`${c.vendor.perShopRate} (standard)`} onChange={(e) => onChange({ vendorRate: num(e.target.value) })} /></Mini>
            <Mini label="Other charges (₹)" htmlFor={id("vother")}><Input id={id("vother")} format="decimal" disabled={!canEdit} value={draft.vendorOther} onChange={(e) => onChange({ vendorOther: Number(e.target.value) || 0 })} /></Mini>
          </div>
          {vendorPick?.ratePerShop != null && !draft.vendorRate && <p className="text-xs text-muted-foreground">Using {vendorPick.name}&apos;s own rate card.</p>}
          <div className="pt-1">
            <Row label={`${leg.shops} shops × ${inr(c.vendor.perShopRate)}`} hint={c.vendor.negotiated ? "Price agreed with the vendor" : c.vendor.far ? "Far-distance rate" : "Standard rate"} value={inr(c.vendor.shopCost)} />
            {c.vendor.other > 0 && <Row label="Other charges" value={inr(c.vendor.other)} />}
            <Row label="Vendor total" value={inr(c.vendor.total)} strong />
            <p className={cn("text-right text-xs", c.flags.vendorOverThreshold ? "font-semibold text-loss" : "text-muted-foreground")}>{inr(c.vendor.perShop)} per shop (limit {inr(rates.thresholdPerShop)})</p>
          </div>
          {c.needsApproval.VENDOR && <p className="flex items-start gap-1.5 rounded-lg bg-[#fff7ed] p-2 text-xs text-approval"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Above {inr(rates.thresholdPerShop)} per shop: needs special approval if chosen.</p>}
        </section>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-4 py-2.5 text-sm">
        <span className="font-semibold text-navy">{diff >= 0 ? `In-house is ${inr(diff)} cheaper` : `Vendor is ${inr(-diff)} cheaper`} ({Math.abs(c.comparison.inHouseSavingPercent)}%)</span>
        {c.reasons.length > 0 && <span className="flex items-center gap-1 text-xs text-approval"><AlertTriangle className="size-3.5" aria-hidden /> {c.reasons[0]}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{picked ? `Chosen: ${picked === "IN_HOUSE" ? "In-house team" : vendorPick?.name ?? leg.vendorName ?? "Vendor"}` : "Not chosen yet"}</span>
      </footer>
    </article>
  );
}
