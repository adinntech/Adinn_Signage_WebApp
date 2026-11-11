"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LocateShops } from "@/components/allocation/locate-shops";
import { AllocationMap } from "@/components/allocation/map-loader";
import { useSetCoords, useSetOrigin } from "@/lib/api/allocation";
import { History, Pencil, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { findPlace, useAddBase, useBases, useChoosePlan, useCost, useEditPlanShops, usePlanHistory, usePlanShops, useReadiness, useSuggestPlan, type Channel, type PlannerMode, type SuggestResult } from "@/lib/api/costing";
import { useActiveVendors, useVendorSkills, type Vendor } from "@/lib/api/vendors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const MODES: { key: PlannerMode; label: string; hint: string }[] = [
  { key: "BOTH", label: "Vendors + in-house", hint: "Cheaper one for each area" },
  { key: "VENDOR", label: "Vendors only", hint: "Always a vendor where one covers the area" },
  { key: "IN_HOUSE", label: "In-house only", hint: "Recce team does every area" },
];

/** What changed, as readable lines (used here and in the admin project view). */
export function PlanHistory({ projectId }: { projectId: string }) {
  const h = usePlanHistory(projectId);
  if (h.isPending) return <p className="p-4 text-sm text-muted-foreground">Loading history…</p>;
  if (h.isError) return <ErrorState error={h.error} onRetry={() => h.refetch()} />;
  if (!h.data.length) return <EmptyState title="No planning changes yet" description="Suggestions, shop changes and vendor choices are listed here." />;
  return (
    <ol className="max-h-96 divide-y divide-border overflow-y-auto">
      {h.data.map((r) => (
        <li key={r._id} className="px-4 py-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy">{r.user?.name ?? "User"}</span>
            {r.user?.role && <span className="text-xs text-muted-foreground">{r.user.role.replace(/_/g, " ").toLowerCase()}</span>}
            <span className="text-xs text-muted-foreground">{formatDateTime(r.at)}</span>
            <Badge>{r.action === "PLAN_SHOPS_EDIT" ? "Shops edited" : r.action === "COST_SUGGEST_APPLY" ? "Suggestion used" : r.action === "COST_ASSIGN" ? "Assigned" : "Plan updated"}</Badge>
          </p>
          {r.reason && <p className="mt-1 text-muted-foreground">{r.reason}</p>}
          {r.changes.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs">
              {r.changes.map((c, i) => (
                <li key={i}><span className="font-medium text-navy">{c.field}</span>: {c.oldValue != null && <span className="text-muted-foreground line-through">{String(c.oldValue)}</span>} {c.newValue != null && <span>{String(c.newValue)}</span>}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Add or remove shops of one suggested area. A reason is required and goes to the history. */
function EditShops({ projectId, areaKey, areaName, onClose }: { projectId: string; areaKey: string; areaName: string; onClose: () => void }) {
  const toast = useToast();
  const shops = usePlanShops(projectId);
  const edit = useEditPlanShops(projectId);
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const list = shops.data ?? [];
  const inArea = (id: string) => list.find((s) => s.id === id)?.planArea === areaKey;
  const want = (id: string) => picked[id] ?? inArea(id);
  const add = list.filter((s) => !inArea(s.id) && want(s.id)).map((s) => s.id);
  const remove = list.filter((s) => inArea(s.id) && !want(s.id)).map((s) => s.id);
  const shown = list.filter((s) => !q.trim() || `${s.name} ${s.location} ${s.district}`.toLowerCase().includes(q.trim().toLowerCase()));
  const save = () =>
    edit.mutate({ areaKey, add, remove, reason: reason.trim() }, { onSuccess: () => { toast("Area updated and saved in the history"); onClose(); }, onError: (e) => toast(errorMessage(e), "error") });
  return (
    <Modal
      open
      persistent
      onOpenChange={(o) => !o && onClose()}
      title={`Edit shops: ${areaName}`}
      description="Tick the shops this area should have. Unticking a shop leaves it out of the plan; ticking one from another area moves it here."
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{add.length} to add · {remove.length} to remove</span>
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={(!add.length && !remove.length) || reason.trim().length < 3} loading={edit.isPending} onClick={save}><Save className="size-4" aria-hidden /> Save changes</Button></div>
        </div>
      }
    >
      <div className="space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shop, area or district" aria-label="Search shops" />
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {shops.isPending ? <li className="p-3 text-sm text-muted-foreground">Loading shops…</li> : shown.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                <input type="checkbox" className="size-4" checked={want(s.id)} onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))} />
                <span className="min-w-0 flex-1 truncate">{s.name}<span className="ml-2 text-xs text-muted-foreground">{[s.location, s.district].filter(Boolean).join(", ")}</span></span>
                {!inArea(s.id) && <span className="text-xs text-muted-foreground">{s.planArea ? "other area" : "not planned"}</span>}
              </label>
            </li>
          ))}
        </ul>
        <div>
          <label htmlFor="edit-reason" className="mb-1 block text-xs font-medium text-navy">Reason <span className="text-loss">*</span></label>
          <Input id="edit-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are the shops changed?" />
        </div>
      </div>
    </Modal>
  );
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
type OrderShop = { name: string; lat: number | null; lng: number | null; location?: string; pincode?: string; address?: string };
const low = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
/**
 * Shop ids in visiting order. Shops at the same map point form one stop (they are the same area), stops are visited nearest
 * first from the start point, and inside a stop shops with the same pincode / street text sit together. A shop without a point
 * is placed next to the shops of its pincode (else its town); the rest go last, grouped the same way.
 */
function routeOrder(ids: string[], byId: Map<string, OrderShop>, origin: { lat: number; lng: number } | null): string[] {
  const get = (id: string) => byId.get(id);
  const sortKey = (id: string) => `${get(id)?.pincode ?? ""}|${low(get(id)?.address)}|${low(get(id)?.name)}`;
  const byKey = (a: string, b: string) => sortKey(a).localeCompare(sortKey(b));
  const stops = new Map<string, { lat: number; lng: number; ids: string[] }>();
  const loose: string[] = [];
  for (const id of ids) {
    const s = get(id);
    if (!s || s.lat == null || s.lng == null) { loose.push(id); continue; }
    const k = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
    const stop = stops.get(k) ?? { lat: s.lat, lng: s.lng, ids: [] };
    stop.ids.push(id);
    stops.set(k, stop);
  }
  const left = [...stops.values()];
  const out: string[] = [];
  let here = origin ?? (left[0] ? { lat: left[0].lat, lng: left[0].lng } : null);
  while (left.length && here) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (km(here, left[i]!) < km(here, left[best]!)) best = i;
    const [stop] = left.splice(best, 1);
    out.push(...stop!.ids.sort(byKey));
    here = stop!;
  }
  // Shops with no point: after the last shop with the same pincode, else the same town; otherwise at the end.
  const rest: string[] = [];
  for (const id of loose.sort(byKey)) {
    const s = get(id);
    const same = (o: string) => (!!s?.pincode && get(o)?.pincode === s.pincode) || (!s?.pincode && !!s?.location && low(get(o)?.location) === low(s.location));
    let at = -1;
    out.forEach((o, i) => { if (same(o)) at = i; });
    if (at >= 0) out.splice(at + 1, 0, id); else rest.push(id);
  }
  return [...out, ...rest];
}
const PALETTE = ["#1e3a8a", "#b45309", "#047857", "#6d28d9", "#be123c", "#0e7490", "#4d7c0f", "#9a3412", "#4338ca", "#475569"];
const IN_COLOR = "#1e3a8a";
const VENDOR_COLOR = "#0f766e";

interface Option { total: number; perShop: number; lines: { label: string; amount: number }[]; note?: string }
interface AreaCard {
  key: string; name: string; district: string; shops: string[]; routeKm: number; saved: boolean;
  channel: Channel | null; vendorId: string | null; vendorName: string | null;
  inHouse: Option; vendor: Option | null; reasons: string[]; warnings: string[];
  /** The vendors offered for this route (works in the area / nearest / lowest cost), with their saved price. */
  candidates: { name: string; rate: number; total: number; km: number | null; tags: string[]; place: string | null; skills: string[] }[];
}
const costOf = (c: AreaCard) => (c.channel === "VENDOR" && c.vendor ? c.vendor.total : c.inHouse.total);

// Sizes here are plain; the whole app scales with the screen through the root font size (globals.css).
const F = {
  body: "text-sm",
  small: "text-xs",
  title: "text-base",
  big: "text-xl",
};

function Tile({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", strong ? "border-navy/40 bg-muted/40 shadow-soft" : "border-border bg-surface")}>
      <p className={cn("font-medium uppercase tracking-wide text-muted-foreground", F.small)}>{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums text-navy", F.big)}>{value}</p>
      {hint && <p className={cn("mt-0.5 text-muted-foreground", F.small)}>{hint}</p>}
    </div>
  );
}

interface Slice { key: string; label: string; sub: string; value: number; color: string }

/** Ring chart: a slice lifts out and the middle shows its cost when it is hovered (here or in the list beside it). */
function Donut({ parts, total, hover, onHover }: { parts: Slice[]; total: number; hover: string | null; onHover: (k: string | null) => void }) {
  const R = 68, W = 26, C = 2 * Math.PI * R;
  let acc = 0;
  const active = parts.find((p) => p.key === hover);
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={`Budget ${inr(total)} split by area`} className="size-52 shrink-0">
      <circle cx="100" cy="100" r={R} fill="none" stroke="#e5e7eb" strokeWidth={W} />
      {total > 0 && parts.map((p) => {
        const len = (p.value / total) * C;
        const mid = ((acc + len / 2) / C) * 2 * Math.PI - Math.PI / 2;
        const on = hover === p.key;
        const dx = on ? Math.cos(mid) * 7 : 0, dy = on ? Math.sin(mid) * 7 : 0;
        const el = (
          <g key={p.key} style={{ transform: `translate(${dx}px, ${dy}px)`, transition: "transform 220ms ease, opacity 220ms ease", opacity: hover && !on ? 0.4 : 1 }} onMouseEnter={() => onHover(p.key)} onMouseLeave={() => onHover(null)} className="cursor-pointer">
            <circle cx="100" cy="100" r={R} fill="none" stroke={p.color} strokeWidth={on ? W + 6 : W} strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 100 100)" style={{ transition: "stroke-width 220ms ease" }}><title>{p.label}: {inr(p.value)}</title></circle>
          </g>
        );
        acc += len;
        return el;
      })}
      {active ? (
        <>
          <text x="100" y="86" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>{active.label.length > 22 ? `${active.label.slice(0, 21)}…` : active.label}</text>
          <text x="100" y="108" textAnchor="middle" className="fill-navy font-semibold" style={{ fontSize: 20 }}>{inr(active.value)}</text>
          <text x="100" y="124" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>{total ? Math.round((active.value / total) * 100) : 0}% of budget</text>
        </>
      ) : (
        <>
          <text x="100" y="92" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>BUDGET</text>
          <text x="100" y="116" textAnchor="middle" className="fill-navy font-semibold" style={{ fontSize: 22 }}>{inr(total)}</text>
        </>
      )}
    </svg>
  );
}

/** A border of light running round the edge, so the cheaper way is seen at once. Still when the user prefers less motion. */
function Glow({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <div className="h-full min-w-0 rounded-xl border border-border">{children}</div>;
  return (
    <div className="relative h-full min-w-0 overflow-hidden rounded-xl p-[2px]">
      <span aria-hidden className="absolute -inset-[60%] animate-[spin_3.2s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_250deg,#0f766e_320deg,#1e3a8a_350deg,transparent_360deg)] motion-reduce:animate-none" />
      <div className="relative h-full rounded-[10px] bg-surface">{children}</div>
    </div>
  );
}

/** Two bars on one scale, so the gap between the team and the vendor is seen at once, with the difference in words. */
function Compare({ c }: { c: AreaCard }) {
  if (!c.vendor) return null;
  const a = c.inHouse.total, b = c.vendor.total, max = Math.max(a, b, 1);
  const diff = Math.abs(a - b);
  const pct = Math.round((diff / Math.max(a, b, 1)) * 100);
  const cheaper = a === b ? null : a < b ? "In-house team" : c.vendorName ?? "Vendor";
  return (
    <div className="mt-3 rounded-xl bg-muted/40 p-3" aria-label="Cost comparison">
      {([["In-house", a, IN_COLOR], [`${c.vendorName ?? "Vendor"}`, b, VENDOR_COLOR]] as const).map(([label, v, color]) => (
        <div key={label} className={cn("mb-1.5 flex items-center gap-2", F.small)}>
          <span className="w-40 shrink-0 truncate text-muted-foreground" title={label}>{label}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(v / max) * 100}%`, background: color }} /></span>
          <span className="w-16 text-right font-semibold tabular-nums text-navy">{inr(v)}</span>
        </div>
      ))}
      <p className={cn("mt-1.5 font-medium text-navy", F.body)}>{cheaper ? <>{cheaper} saves <strong>{inr(diff)}</strong> <span className="font-normal text-muted-foreground">({pct}% less)</span></> : "Both cost the same"}</p>
    </div>
  );
}

function OptionPanel({ title, sub, opt, color, tag, cheapest, active, onPick, children }: { title: string; sub?: string; opt: Option | null; color: string; tag?: string; cheapest: boolean; active: boolean; onPick?: () => void; children?: React.ReactNode }) {
  const inner = (
    <div className={cn("flex h-full flex-col rounded-[inherit] p-3.5", active && "bg-muted/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("flex items-center gap-1.5 font-semibold text-navy", F.body)}><span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden /><span className="truncate">{title}</span></p>
          {sub && <p className={cn("line-clamp-2 break-words text-muted-foreground", F.small)} title={sub}>{sub}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {cheapest && <span className="animate-pulse rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white motion-reduce:animate-none">Budget friendly</span>}
          {tag && <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{tag}</span>}
        </div>
      </div>
      {opt ? (
        <>
          {opt.lines.length > 0 && (
            <details className={cn("mt-2 text-muted-foreground", F.small)} onClick={(e) => e.stopPropagation()}>
              <summary className="cursor-pointer select-none text-navy">Cost breakdown</summary>
              <ul className="mt-1 space-y-0.5">{opt.lines.map((l) => <li key={l.label} className="flex justify-between gap-3"><span>{l.label}</span><span className="tabular-nums">{inr(l.amount)}</span></li>)}</ul>
            </details>
          )}
          {/* The price is the last line of the card, so it sits at the same level in both cards and no empty space is left under it. */}
          <p className={cn("mt-auto border-t border-border pt-3 font-semibold tabular-nums text-navy", F.big)}>{inr(opt.total)}<span className={cn("ml-2 font-normal text-muted-foreground", F.small)}>{inr(opt.perShop)} / shop</span></p>
        </>
      ) : <p className={cn("mt-3 text-muted-foreground", F.body)}>No vendor with a cost in Vendor master for this route. Add costs in Vendors → Vendor master</p>}
      {children}
    </div>
  );
  const clickable = onPick ? { role: "button" as const, tabIndex: 0, onClick: onPick, onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onPick(), className: "cursor-pointer" } : {};
  return <div {...clickable} className={cn("h-full min-w-0", clickable.className)}><Glow on={cheapest}>{inner}</Glow></div>;
}

/** Type-to-filter vendor list: matches the vendor name, vendor ID (code), mobile number or cost, cheapest first. */
function VendorPicker({ label, vendors, disabled, onPick }: { label: string; vendors: Vendor[]; disabled: boolean; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return vendors
      .filter((v) => v.ratePerShop != null && !!v.zohoContactId)
      .filter((v) => !t || [v.name, v.code, v.mobile, String(v.ratePerShop)].some((x) => (x ?? "").toLowerCase().includes(t)))
      .sort((x, y) => x.ratePerShop! - y.ratePerShop!)
      .slice(0, 30);
  }, [vendors, q]);
  return (
    <div ref={box} className="relative mt-2" onClick={(e) => e.stopPropagation()}>
      <Input aria-label={label} disabled={disabled} value={q} placeholder="Search vendor by name, ID, number or cost…" autoComplete="off" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      {open && (
        <ul role="listbox" aria-label="Vendors" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-card">
          {list.length === 0 ? <li className="px-3 py-2 text-xs text-muted-foreground">No vendor with a cost matches.</li> : list.map((v) => (
            <li key={v._id} role="option" aria-selected={false}>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60" onClick={() => { onPick(v._id); setOpen(false); setQ(""); }}>
                <span className="min-w-0"><span className="block truncate font-medium text-navy">{v.name}</span><span className="block truncate text-xs text-muted-foreground">{v.code} · {v.mobile}</span></span>
                <span className="shrink-0 font-semibold tabular-nums text-navy">₹{v.ratePerShop}/shop</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ c, color, hot, onHot, selected, onSelect, shopNames, shopList, focusId, placingId, onFocusShop, onMap, canEdit, vendors, onChoose, onEdit, busy }: {
  c: AreaCard; color: string; hot: boolean; onHot: (on: boolean) => void; selected: boolean; onSelect: () => void; shopNames: string[]; shopList: { id: string; name: string; pinned: boolean }[]; focusId: string | null; placingId: string | null; onFocusShop: (id: string) => void; onMap: number; canEdit: boolean; vendors: Vendor[];
  onChoose: (channel: Channel, vendorId?: string) => void; onEdit: () => void; busy: boolean;
}) {
  const inCheaper = !c.vendor || c.inHouse.total <= c.vendor.total;
  return (
    <article onClick={onSelect} onMouseEnter={() => onHot(true)} onMouseLeave={() => onHot(false)} className={cn("min-w-0 rounded-2xl border bg-surface p-4 shadow-soft transition-shadow 2xl:p-5", selected ? "border-navy ring-2 ring-navy/20" : hot ? "border-navy/50 shadow-card" : "border-border")}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="size-3.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <h3 className={cn("font-semibold text-navy", F.title)}>{c.name}</h3>
        <span className={cn("rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground", F.small)}>{c.shops.length} shop{c.shops.length > 1 ? "s" : ""}{onMap < c.shops.length ? ` · ${onMap} on map` : ""}</span>
        {c.routeKm > 0 && <span className={cn("rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground", F.small)}>{Math.round(c.routeKm)} km round trip</span>}
        {canEdit && c.saved && <Button size="sm" variant="outline" className="ml-auto" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Pencil className="size-3.5" aria-hidden /> Edit shops</Button>}
      </header>
      <details className={cn("mt-2 text-muted-foreground", F.small)} onClick={(e) => e.stopPropagation()}>
        <summary className="cursor-pointer select-none truncate">{shopNames.slice(0, 3).join(" · ")}{shopNames.length > 3 ? ` +${shopNames.length - 3} more` : ""}</summary>
        <p className="mt-1 text-xs">Click a shop to see its point on the map.</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          {shopList.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onFocusShop(s.id)} aria-pressed={focusId === s.id || placingId === s.id} title={s.pinned ? "Show on the map" : "Not on the map yet. Click to place it"}
                className={cn("rounded px-1 text-left hover:bg-muted", (focusId === s.id || placingId === s.id) && "bg-navy font-medium text-white hover:bg-navy")}>
                {s.name}
              </button>
              {!s.pinned && <span className="ml-1.5 rounded bg-[#fff7ed] px-1.5 text-[10px] font-semibold text-approval">{placingId === s.id && canEdit ? "Click the map to place" : "no pin"}</span>}
            </li>
          ))}
        </ol>
      </details>

      <div className="mt-3 grid grid-cols-1 items-stretch gap-3 2xl:grid-cols-2" onClick={(e) => e.stopPropagation()}>
        <OptionPanel title="In-house team" sub={c.inHouse.note} color={IN_COLOR} opt={c.inHouse} cheapest={inCheaper && !!c.vendor} tag={c.channel === "IN_HOUSE" ? (c.saved ? "Selected" : "Suggested") : undefined} active={c.channel === "IN_HOUSE"} onPick={c.saved && canEdit && !busy ? () => onChoose("IN_HOUSE") : undefined} />
        <OptionPanel title={c.vendorName ?? "Vendor"} sub={c.vendor?.note} color={VENDOR_COLOR} opt={c.vendor} cheapest={!!c.vendor && !inCheaper} tag={c.channel === "VENDOR" ? (c.saved ? "Selected" : "Suggested") : undefined} active={c.channel === "VENDOR"} onPick={c.saved && canEdit && !busy && c.vendorId ? () => onChoose("VENDOR", c.vendorId!) : undefined}>
          {c.saved && canEdit && (
            <VendorPicker label={`Vendor for ${c.name}`} disabled={busy} vendors={vendors} onPick={(id) => onChoose("VENDOR", id)} />
          )}
        </OptionPanel>
      </div>
      <Compare c={c} />

      {c.candidates.some((v) => v.name !== c.vendorName) && (
        <details className={cn("mt-3 rounded-xl border border-border", F.small)} open onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-navy">Next lowest-cost vendors from Vendor master</summary>
          <ul className="divide-y divide-border border-t border-border">
            {[...c.candidates].filter((v) => v.name !== c.vendorName).sort((a, b) => a.total - b.total || (a.km ?? 1e9) - (b.km ?? 1e9)).slice(0, 2).map((v, i) => (
              <li key={v.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className={cn("flex min-w-32 flex-1 items-center gap-2 font-medium text-navy", F.body)}><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white" title={`Next lowest cost, number ${i + 1}`}>{i + 1}</span>{v.name}</span>
                <span className="tabular-nums text-navy">₹{v.rate}/shop <span className="text-muted-foreground">· {inr(v.total)}</span></span>
                <span className="text-muted-foreground">{[v.place, v.km != null ? `${v.km} km` : "distance unknown", v.skills.length ? v.skills.join(", ") : "no skills saved"].filter(Boolean).join(" · ")}</span>
                <span className="flex gap-1">{v.tags.filter((t) => t !== "Lowest cost").map((t) => <span key={t} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t === "Not registered" || t.startsWith("Waiting") ? "bg-amber-100 text-amber-800" : t.startsWith("Rejected") ? "bg-red-100 text-red-800" : t === "Approved" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-navy")}>{t === "Not registered" ? "Zoho vendor, not onboarded in CRM" : t}</span>)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {(c.reasons.length > 0 || c.warnings.length > 0) && (
        <details className={cn("mt-2 text-muted-foreground", F.small)} onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer select-none text-navy">Why this suggestion</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{[...c.reasons, ...c.warnings].map((r, i) => <li key={i}>{r}</li>)}</ul>
        </details>
      )}
    </article>
  );
}

const vendorNote = (shops: number, rate: number, source: "VENDOR" | "COMPANY" | undefined, extra: string[]) =>
  [`${shops} shop${shops > 1 ? "s" : ""} × ₹${rate}`, source === "VENDOR" ? "vendor's own rate" : "company rate (no rate saved for this vendor)", ...extra].join(" · ");

/**
 * Pre-setup (like the Smart Recce Planner): the verified shops are grouped into routes on a map; every route shows the
 * in-house team against the vendor with the cost lines and the gap between them, the budget is shown as a ring chart, and
 * Operations can use the suggestion, then change who does a route or add / remove shops. Changes go to the history.
 */
export function PreSetup({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast();
  const suggest = useSuggestPlan(projectId);
  const choose = useChoosePlan(projectId);
  const ready = useReadiness(projectId).data;
  const cost = useCost(projectId);
  const shops = usePlanShops(projectId);
  const vendors = useActiveVendors(canEdit);
  const skillList = useVendorSkills();
  const qc = useQueryClient();
  const setOrigin = useSetOrigin(projectId);
  const setCoords = useSetCoords(projectId);
  const [focusShop, setFocusShop] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["cost", projectId] });
  const [mode, setMode] = useState<PlannerMode>("BOTH");
  const [picked, setPicked] = useState<string[]>([]);
  const [require, setRequire] = useState(false);
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [editing, setEditing] = useState<{ key: string; name: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [moving, setMoving] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState("");
  const bases = useBases();
  const [addr, setAddr] = useState("");
  const [finding, setFinding] = useState(false);
  const addBase = useAddBase();
  const saved = useMemo(() => (cost.data?.saved ? cost.data.plan.legs : []), [cost.data]);
  const first = useRef(false);
  const byId = useMemo(() => new Map((shops.data ?? []).map((s) => [s.id, s])), [shops.data]);

  const run = (apply: boolean, over?: { mode?: PlannerMode; skills?: string[]; require?: boolean }) =>
    suggest.mutate({ skills: over?.skills ?? picked, requireSkills: over?.require ?? require, apply, groupBy: "area", mode: over?.mode ?? mode }, {
      onSuccess: (r) => { setResult(apply ? null : r); if (apply) toast("Plan saved. Now you can change who does a route or edit its shops"); },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  // The suggestion appears by itself as soon as verified shops exist; changing the mode or a skill refreshes it.
  useEffect(() => {
    if (!first.current && ready?.verified) { first.current = true; run(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready?.verified]);
  const change = (o: { mode?: PlannerMode; skills?: string[]; require?: boolean }) => {
    if (o.mode) setMode(o.mode);
    if (o.skills) setPicked(o.skills);
    if (o.require !== undefined) setRequire(o.require);
    if (ready?.verified) run(false, o);
  };

  const rates = cost.data?.rates;
  const inHouseLines = (days: number, nights: number, km: number, travel: number, food: number, stay: number, local = 0) => [
    ...(local > 0 ? [{ label: `Local (${days} day${days > 1 ? "s" : ""}${rates ? ` × ₹${rates.localPerDay}` : ""})`, amount: local }] : []),
    { label: `Food (${days} day${days > 1 ? "s" : ""}${rates ? ` × ₹${rates.foodPerDay}` : ""})`, amount: food },
    ...(nights > 0 ? [{ label: `Stay (${nights} night${nights > 1 ? "s" : ""}${rates ? ` × ₹${rates.stayPerNight}` : ""})`, amount: stay }] : []),
    { label: `Travel (${Math.round(km)} km${rates ? ` × ₹${rates.fuelRatePerKm}` : ""})`, amount: travel },
  ];
  const cards: AreaCard[] = useMemo(() => {
    if (result) {
      return result.proposals.map((p) => {
        // The vendor shown is the one chosen by the suggestion, else the lowest cost (a vendor only in Vendor master counts, to compare with the team).
        const lowest = [...p.vendors].sort((a, b) => a.total - b.total || (a.nearKm ?? 1e9) - (b.nearKm ?? 1e9))[0];
        const v = p.vendors.find((x) => x.vendorId === p.recommended.vendorId) ?? lowest;
        return {
          key: p.key, name: p.name, district: p.district, shops: p.siteIds, routeKm: p.routeKm, saved: false,
          channel: p.recommended.channel, vendorId: v?.vendorId ?? null, vendorName: v?.name ?? null,
          inHouse: { total: p.inHouse.total, perShop: p.inHouse.perShop, note: `${p.inHouse.days} day${p.inHouse.days > 1 ? "s" : ""}, ${p.inHouse.nights} night${p.inHouse.nights === 1 ? "" : "s"}`, lines: inHouseLines(p.inHouse.days, p.inHouse.nights, p.routeKm, p.inHouse.travel, p.inHouse.food, p.inHouse.stay, p.inHouse.local) },
          vendor: v ? { total: v.total, perShop: v.perShop, note: vendorNote(p.shops, v.perShopRate, v.rateSource, [...(v.nearKm != null ? [`nearest, about ${v.nearKm} km away`] : []), ...(v.pendingRate != null ? [`₹${v.pendingRate} waiting for approval`] : []), ...(v.days ? [`about ${v.days} day${v.days > 1 ? "s" : ""}`] : []), ...(v.skills.length ? [v.skills.join(", ")] : [])]), lines: [] } : null,
          reasons: p.reasons, warnings: p.warnings,
          candidates: p.vendors.map((x) => ({ name: x.name, rate: x.perShopRate, total: x.total, km: x.nearKm ?? null, tags: x.tags ?? [], place: x.place ?? null, skills: x.skills })),
        };
      });
    }
    return saved.map((l) => ({
      key: l.key, name: l.name, district: l.district ?? "", shops: (shops.data ?? []).filter((s) => s.planArea === l.key).map((s) => s.id), routeKm: l.routeKm ?? 0, saved: true,
      channel: l.channel ?? null, vendorId: l.vendor ?? null, vendorName: l.vendorName ?? null,
      inHouse: { total: l.calc.inHouse.total, perShop: l.calc.inHouse.perShop, note: `${l.calc.inHouse.days} day${l.calc.inHouse.days > 1 ? "s" : ""}, ${l.calc.inHouse.nights} night${l.calc.inHouse.nights === 1 ? "" : "s"}`, lines: inHouseLines(l.calc.inHouse.days, l.calc.inHouse.nights, l.calc.inHouse.routeKm, l.calc.inHouse.fuel, l.calc.inHouse.food, l.calc.inHouse.stay, l.calc.inHouse.local) },
      vendor: l.vendorName ? { total: l.calc.vendor.total, perShop: l.calc.vendor.perShop, note: vendorNote(l.shops, l.calc.vendor.perShopRate, l.cardRate != null ? "VENDOR" : "COMPANY", []), lines: [] } : null,
      reasons: l.calc.reasons, warnings: [], candidates: [],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, saved, shops.data, rates]);

  const chosen = cards.reduce((a, c) => a + costOf(c), 0);
  const allIn = cards.reduce((a, c) => a + c.inHouse.total, 0);
  const allVendor = cards.reduce((a, c) => a + (c.vendor?.total ?? c.inHouse.total), 0);
  const total = cards.reduce((a, c) => a + c.shops.length, 0);
  const inShops = cards.filter((c) => c.channel === "IN_HOUSE").reduce((a, c) => a + c.shops.length, 0);

  const ownOrigin = cost.data?.project.origin;
  const base = result?.base;
  const origin = useMemo(() => ownOrigin ?? (base ? { name: base.name, lat: base.lat, lng: base.lng } : null), [ownOrigin, base]);
  // Each route's shops in visiting order (nearest next), so shops close to each other sit together in the list and on the map.
  const orderOf = useMemo(() => new Map(cards.map((c) => [c.key, routeOrder(c.shops, byId, origin)])), [cards, byId, origin]);
  const { pins, paths } = useMemo(() => {
    const seen = new Map<string, number>();
    const lit = selected ?? hover;
    const paths = new Map<string, [number, number][]>();
    const pins = cards.flatMap((c, i) => (orderOf.get(c.key) ?? c.shops).flatMap((id, pos) => {
      const s = byId.get(id);
      if (s?.lat == null || s.lng == null) return [];
      // Shops with exactly the same position (found only down to the area) are spread a little so each can be seen and clicked.
      const k = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
      const n = seen.get(k) ?? 0; seen.set(k, n + 1);
      const a = n * 2.1; const r = 0.0007 * Math.sqrt(n);
      const lat = s.lat + (n ? r * Math.sin(a) : 0), lng = s.lng + (n ? r * Math.cos(a) : 0);
      paths.set(c.key, [...(paths.get(c.key) ?? []), [lat, lng]]);
      return [{ id, name: `${pos + 1}. ${s.name}`, sub: `${c.name}${s.location ? ` · ${s.location}` : ""}`, lat, lng, color: lit && lit !== c.key ? "#cbd5e1" : PALETTE[i % PALETTE.length]! }];
    }));
    return { pins, paths };
  }, [cards, byId, selected, hover, orderOf]);
  // The visiting order of the route being looked at (hovered, selected, the one of the shop clicked, or the only route): start point, then each shop with an arrow.
  const watched = selected ?? hover ?? cards.find((c) => focusShop && c.shops.includes(focusShop))?.key ?? (cards.length === 1 ? cards[0]!.key : null);
  const routes = useMemo(() => {
    const path = watched ? paths.get(watched) : undefined;
    const i = cards.findIndex((c) => c.key === watched);
    return path?.length ? [{ color: PALETTE[Math.max(0, i) % PALETTE.length]!, coords: [...(origin ? [[origin.lat, origin.lng] as [number, number]] : []), ...path], arrows: true }] : [];
  }, [watched, paths, cards, origin]);
  // Clicking a shop in a route zooms the map to its point; a shop without a point can be placed by clicking the map.
  const onShopClick = (id: string) => {
    const s = byId.get(id);
    if (s?.lat != null && s.lng != null) { setPlacing(null); setFocusShop(focusShop === id ? null : id); return; }
    setFocusShop(null);
    if (canEdit) { setPlacing(placing === id ? null : id); toast("This shop has no point yet. Click its place on the map"); }
    else toast("This shop has no point on the map yet", "error");
  };
  const placeShop = (lat: number, lng: number) => {
    if (!placing) return;
    setCoords.mutate({ id: placing, lat, lng }, { onSuccess: () => { toast("Shop placed on the map"); setFocusShop(placing); setPlacing(null); refresh(); run(false); }, onError: (e) => toast(errorMessage(e), "error") });
  };
  const onMapOf = (c: AreaCard) => c.shops.filter((id) => byId.get(id)?.lat != null).length;
  const unlocated = (shops.data ?? []).filter((s) => s.lat == null || s.lng == null).length;
  const setStart = (name: string, lat: number, lng: number) => setOrigin.mutate({ name, lat, lng }, { onSuccess: () => { toast(`Start point: ${name}`); setMoving(false); setPinned(null); setPlaceName(""); refresh(); run(false); }, onError: (e) => toast(errorMessage(e), "error") });
  const findAddress = async () => {
    // "address - Name": the last part after " - " names the place.
    const m = /^(.*\S)\s+[-–]\s+([^,-]{2,60})$/.exec(addr.trim());
    const text = m ? m[1]! : addr.trim();
    if (m && !placeName.trim()) setPlaceName(m[2]!.trim());
    setFinding(true);
    try {
      const r = await findPlace(text);
      setPinned({ lat: r.lat, lng: r.lng });
      if (!r.exact) toast("Found the area, not the exact door. Click the map to adjust the pin");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setFinding(false);
    }
  };
  const savePlace = () => pinned && addBase.mutate({ name: placeName.trim(), ...pinned }, { onSuccess: (b) => setStart(b.name, b.lat, b.lng), onError: (e) => toast(errorMessage(e), "error") });
  const skills = (skillList.data ?? []).map((s) => s.name);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy">Who can do the recce</h3>
            <p className="text-xs text-muted-foreground">The best choice per route is picked from your vendors&apos; saved costs and the in-house cost. Change this only if you want to force one way.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Planner mode">
            {MODES.map((m) => (
              <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} title={m.hint} onClick={() => change({ mode: m.key })} className={cn("rounded-md px-3 py-1.5 text-sm", mode === m.key ? "bg-navy font-medium text-white" : "text-muted-foreground hover:bg-muted/50")}>{m.label}</button>
            ))}
          </div>
        </div>
        {skills.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-navy">Skills needed:</span>
            {skills.map((s) => {
              const on = picked.includes(s);
              return <button key={s} type="button" aria-pressed={on} onClick={() => change({ skills: on ? picked.filter((x) => x !== s) : [...picked, s] })} className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-navy bg-navy text-white" : "border-border text-muted-foreground hover:bg-muted/50")}>{s}</button>;
            })}
            {picked.length > 0 && <label className="ml-2 flex items-center gap-1.5 text-xs"><input type="checkbox" className="size-3.5" checked={require} onChange={(e) => change({ require: e.target.checked })} /> Only vendors with these skills</label>}
          </div>
        )}
        {ready && !ready.verified && <p className="mt-3 text-sm text-muted-foreground">No verified shops yet. Go back to step 2 and verify the shops; the suggestion then appears here.</p>}
        {ready && ready.verified > 0 && ready.unverified > 0 && <p className="mt-3 text-xs text-muted-foreground">{ready.unverified} shop(s) are not verified and are left out of the plan.</p>}
      </section>

      {suggest.isError && <ErrorState error={suggest.error} onRetry={() => run(false)} />}
      {suggest.isPending && !cards.length && <p role="status" className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">Reading the shops, finding vendors and working out the cost…</p>}

      <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-2" aria-label="Start point and shop positions">
        <div>
          <h3 className="text-sm font-semibold text-navy">Start point</h3>
          <p className="text-xs text-muted-foreground">Where the in-house team starts from. Travel cost is counted from here.</p>
          {canEdit ? (
            <div className="mt-2 space-y-2">
              <select aria-label="Saved start points" value="" onChange={(e) => { const b = bases.data?.find((x) => x._id === e.target.value); if (b) setStart(b.name, b.lat, b.lng); }} className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm">
                <option value="">{origin ? `Now: ${origin.name} · choose another place…` : "Choose a saved place…"}</option>
                {(bases.data ?? []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
              {!moving ? <Button size="sm" variant="outline" onClick={() => setMoving(true)}>Pin a new place on the map</Button> : (
                <div className="space-y-2 rounded-md border border-dashed border-border p-2">
                  <textarea aria-label="Address" rows={3} maxLength={300} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Paste the address. Add ' - Adinn Factory' at the end to name it" className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm" />
                  <Button size="sm" variant="outline" disabled={addr.trim().length < 6} loading={finding} onClick={findAddress}>Find on map</Button>
                  <p className="text-xs text-muted-foreground">{pinned ? "Position found. Check the pin on the map (you can click to move it), name it and save." : "Or click the place on the map below."}</p>
                  <Input aria-label="Place name" maxLength={80} value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="e.g. Adinn Factory" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!pinned || placeName.trim().length < 2} loading={addBase.isPending} onClick={savePlace}>Save place and use it</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setMoving(false); setPinned(null); setPlaceName(""); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ) : <p className="mt-1 text-sm text-navy">{origin?.name ?? "Default base"}</p>}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-navy">Shop positions</h3>
          {unlocated > 0 && canEdit ? <div className="mt-1"><LocateShops auto projectId={projectId} missing={unlocated} onDone={() => { refresh(); run(false); }} /></div> : <p className="mt-1 text-xs text-muted-foreground">{unlocated > 0 ? `${unlocated} shop(s) have no position yet.` : "All shops are on the map."}</p>}
        </div>
      </section>

      {cards.length > 0 && (
        <>
          <section className="grid gap-5 rounded-2xl border border-border bg-surface p-4 shadow-soft 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:p-6" aria-label="Budget control">
            <div className="flex flex-wrap items-center gap-5">
              <Donut total={chosen} hover={hover} onHover={setHover} parts={cards.map((c, i) => ({ key: c.key, label: c.name, sub: c.channel === "VENDOR" ? c.vendorName ?? "Vendor" : "In-house", value: costOf(c), color: PALETTE[i % PALETTE.length]! }))} />
              <ul className="min-w-64 flex-1 space-y-1.5">
                {cards.map((c, i) => (
                  <li key={c.key} onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)} className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 transition-colors", hover === c.key ? "bg-muted" : "hover:bg-muted/50")}>
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums text-white shadow-sm transition-transform duration-200 2xl:size-14 2xl:text-xs" style={{ background: PALETTE[i % PALETTE.length], transform: hover === c.key ? "scale(1.14)" : "none" }}>{inr(costOf(c))}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-medium text-navy", F.body)}>{c.name}</span>
                      <span className={cn("block truncate text-muted-foreground", F.small)}>{c.channel === "VENDOR" ? c.vendorName ?? "Vendor" : "In-house team"} · {chosen ? Math.round((costOf(c) / chosen) * 100) : 0}% of budget</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-2">
              <Tile strong label={result ? "Suggested budget" : "Chosen budget"} value={inr(chosen)} hint={`${total} shops · ${inShops} in-house, ${total - inShops} vendor`} />
              <Tile label="If all in-house" value={inr(allIn)} hint={allIn > chosen ? `${inr(allIn - chosen)} more than the plan` : "same as the plan"} />
              <Tile label="If all vendor" value={inr(allVendor)} hint={allVendor > chosen ? `${inr(allVendor - chosen)} more than the plan` : "same as the plan"} />
              <Tile label="Saved vs the dearer way" value={inr(Math.max(allIn, allVendor) - chosen)} hint="what this plan keeps in budget" />
            </div>
          </section>
          {result && canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">This is a suggestion. Nothing is saved until you use it.</p>
              <Button loading={suggest.isPending} onClick={() => run(true)}><Save className="size-4" aria-hidden /> Use this plan</Button>
            </div>
          )}
          {/* The map stays in view while the routes on the right scroll past it. When the routes are short nothing scrolls. */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="flex flex-col gap-2 xl:sticky xl:top-3 xl:h-[calc(100dvh-1.5rem)] xl:self-start">
              <div className="h-[360px] min-h-0 xl:h-auto xl:flex-1"><AllocationMap pins={pins} routes={routes} origin={pinned ? { name: "New place", ...pinned } : origin} height="100%" focusId={focusShop} onPick={canEdit && moving ? (lat, lng) => setPinned({ lat, lng }) : canEdit && placing ? placeShop : undefined} /></div>
              <p className={cn("text-muted-foreground", F.small)}>{pins.length} of {total} shops are on the map{pins.length < total ? ". The others have no position yet; they are still counted in the cost." : "."}</p>
              <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground", F.small)}>{cards.map((c, i) => <li key={c.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden />{c.name}</li>)}</ul>
            </div>
            <div className="min-w-0 space-y-3">
              {cards.map((c, i) => (
                <Card key={c.key} c={c} color={PALETTE[i % PALETTE.length]!} hot={hover === c.key} onHot={(on) => setHover(on ? c.key : null)} selected={selected === c.key} onSelect={() => setSelected(selected === c.key ? null : c.key)} canEdit={canEdit} vendors={vendors.data ?? []} busy={choose.isPending} onMap={onMapOf(c)}
                  shopNames={(orderOf.get(c.key) ?? c.shops).map((id) => byId.get(id)?.name ?? "").filter(Boolean)}
                  shopList={(orderOf.get(c.key) ?? c.shops).flatMap((id) => { const s = byId.get(id); return s ? [{ id, name: s.name, pinned: s.lat != null && s.lng != null }] : []; })}
                  focusId={focusShop} placingId={placing} onFocusShop={onShopClick}
                  onChoose={(channel, vendorId) => choose.mutate({ areaKey: c.key, channel, ...(vendorId ? { vendorId } : {}) }, { onSuccess: () => toast("Saved in the planning history"), onError: (e) => toast(errorMessage(e), "error") })}
                  onEdit={() => setEditing({ key: c.key, name: c.name })} />
              ))}
            </div>
          </div>
        </>
      )}

      {cards.length > 0 && rates && (
        <section className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <h4 className="mb-1 font-semibold text-navy">How the cost is worked out</h4>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Distances are straight-line × 1.25 (estimated road km), not actual driving routes.</li>
            <li>Field time = drive at 40 km/h + 45 min per shop, 9 working hours a day.</li>
            <li>In-house: food ₹{rates.foodPerDay}/day, stay ₹{rates.stayPerNight}/night, travel ₹{rates.fuelRatePerKm}/km (Admin cost rates). Salary is not included.</li>
            <li>Vendors: only the ones listed in Vendors → Vendor master (&ldquo;Vendors with cost&rdquo;), with the price per shop saved there. A price above the company rate (₹{rates.vendorRatePerShop}) counts only after it is approved; waiting or rejected uses the company rate. Busy vendors are left out.</li>
            <li>If nobody works in an area, the nearest vendor that has a price saved is offered, with its distance.</li>
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-border bg-surface">
        <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-navy" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}><History className="size-4" aria-hidden /> Planning history <span className="text-xs font-normal text-muted-foreground">who changed what (admin sees the same)</span></button>
        {showHistory && <div className="border-t border-border"><PlanHistory projectId={projectId} /></div>}
      </section>

      {editing && <EditShops projectId={projectId} areaKey={editing.key} areaName={editing.name} onClose={() => setEditing(null)} />}
    </div>
  );
}
