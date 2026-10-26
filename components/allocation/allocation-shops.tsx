"use client";

import { useState } from "react";
import { MapPin, Search, UserMinus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useAllocationShops, useAssign, useSetCoords, type AllocShop, type AllocationOverview } from "@/lib/api/allocation";
import { useActiveVendors } from "@/lib/api/vendors";
import { cn } from "@/lib/utils";

const nameOf = (s: AllocShop) => s.shopName || s.dealerName || s.siteCode;

export function AllocationShops({ projectId, overview, canEdit }: { projectId: string; overview: AllocationOverview; canEdit: boolean }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [view, setView] = useState("");
  const [district, setDistrict] = useState("");
  const [sort, setSort] = useState("seq");
  const [page, setPage] = useState(1);
  const list = useAllocationShops(projectId, { q: dq || undefined, view: view || undefined, district: district || undefined, sort, page, limit: 50 });
  const vendors = useActiveVendors(canEdit);
  const assign = useAssign(projectId);
  const setCoords = useSetCoords(projectId);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState("");
  const [locate, setLocate] = useState<AllocShop | null>(null);
  const [pos, setPos] = useState({ lat: "", lng: "" });
  const [posErr, setPosErr] = useState<Record<string, string>>({});
  const rows = list.data?.data ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => picked.has(r._id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = (channel: "VENDOR" | "IN_HOUSE" | "NONE", vendorId?: string) =>
    assign.mutate({ siteIds: [...picked], channel, ...(vendorId ? { vendorId } : {}) }, {
      onSuccess: (r) => { toast(`${(r as { affected: number }).affected} shop(s) updated`); setPicked(new Set()); },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  const doAssign = () => (target === "IN_HOUSE" ? run("IN_HOUSE") : target ? run("VENDOR", target) : undefined);

  function savePos() {
    const lat = Number(pos.lat), lng = Number(pos.lng);
    const e: Record<string, string> = {};
    if (pos.lat.trim() === "" || !Number.isFinite(lat) || Math.abs(lat) > 90) e.lat = "Latitude, e.g. 9.9252";
    if (pos.lng.trim() === "" || !Number.isFinite(lng) || Math.abs(lng) > 180) e.lng = "Longitude, e.g. 78.1198";
    setPosErr(e);
    if (Object.keys(e).length || !locate) return;
    setCoords.mutate({ id: locate._id, lat, lng }, { onSuccess: () => { toast("Map position saved"); setLocate(null); }, onError: (err) => { const fe = fieldErrorsOf(err); if (Object.keys(fe).length) setPosErr(fe); else toast(errorMessage(err), "error"); } });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search shop, dealer, area, mobile…" className="pl-9" aria-label="Search shops" />
        </div>
        <div className="w-48">
          <Select value={view} onChange={(e) => { setView(e.target.value); setPage(1); }} aria-label="Show">
            <option value="">All shops</option><option value="unassigned">Not allocated ({overview.unassigned})</option><option value="in_house">In-house team</option><option value="vendor">Any vendor</option><option value="no_coords">No map position ({overview.withoutCoords})</option>
            {overview.teams.filter((t) => t.vendorId).map((t) => <option key={t.key} value={t.vendorId ?? ""}>{t.name} ({t.shops})</option>)}
          </Select>
        </div>
        <div className="w-40"><Select value={district} onChange={(e) => { setDistrict(e.target.value); setPage(1); }} aria-label="District"><option value="">All districts</option>{overview.districts.map((d) => <option key={d} value={d}>{d}</option>)}</Select></div>
        <div className="w-40"><Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="seq">Entry order</option><option value="distance">Nearest first</option><option value="-distance">Farthest first</option><option value="district">District</option><option value="name">Shop name</option></Select></div>
      </div>

      {canEdit && picked.size > 0 && (
        <div role="region" aria-label="Allocate selected shops" className="flex flex-wrap items-center gap-2 rounded-xl border border-royal/30 bg-[#e8f0ff] p-3">
          <span className="text-sm font-semibold text-navy">{picked.size} selected</span>
          <div className="w-60"><Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Allocate to"><option value="">Allocate to…</option><option value="IN_HOUSE">In-house team</option>{(vendors.data ?? []).map((v) => <option key={v._id} value={v._id}>{v.name} ({v.code})</option>)}</Select></div>
          <Button className="bg-royal hover:bg-royal/90" disabled={!target} loading={assign.isPending} onClick={doAssign}><Users className="size-4" aria-hidden /> Allocate</Button>
          <Button variant="outline" onClick={() => run("NONE")}><UserMinus className="size-4" aria-hidden /> Remove allocation</Button>
          <Button variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <div className={cn("max-h-[520px] overflow-auto transition-opacity", list.isFetching && !list.isPending && "opacity-60")}>
          {list.isPending ? (
            <RowsSkeleton rows={6} className="p-4" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="No shops here" description="Change the filters, or add shops in the project first." />
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-10 bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr>
                  {canEdit && <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => setPicked((s) => { const n = new Set(s); rows.forEach((r) => (allOnPage ? n.delete(r._id) : n.add(r._id))); return n; })} /></th>}
                  <th className="px-3 py-2.5">Shop</th><th className="px-3 py-2.5">Area / district</th><th className="px-3 py-2.5 text-right">Distance</th><th className="px-3 py-2.5">Map</th><th className="px-3 py-2.5">Allocated to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((s) => (
                  <tr key={s._id} className={cn("hover:bg-[#f4f8ff]", picked.has(s._id) && "bg-[#eef4ff]")}>
                    {canEdit && <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${nameOf(s)}`} checked={picked.has(s._id)} onChange={() => toggle(s._id)} /></td>}
                    <td className="px-3 py-2 font-medium text-navy">{nameOf(s)}<span className="block text-xs font-normal text-muted-foreground">{s.siteCode}{s.mobile ? ` · ${s.mobile}` : ""}</span></td>
                    <td className="px-3 py-2">{s.location ?? "-"}<span className="block text-xs text-muted-foreground">{s.district ?? ""}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.distanceKm != null ? `${s.distanceKm} km` : <span className="text-xs text-muted-foreground">–</span>}</td>
                    <td className="px-3 py-2">
                      {s.lat != null ? <span className="text-xs text-finance">Placed</span> : <span className="text-xs text-approval">No position</span>}
                      {canEdit && <Button size="icon" variant="ghost" className="ml-1 size-7" aria-label={`Set map position for ${nameOf(s)}`} onClick={() => { setPos({ lat: s.lat != null ? String(s.lat) : "", lng: s.lng != null ? String(s.lng) : "" }); setPosErr({}); setLocate(s); }}><MapPin className="size-4" aria-hidden /></Button>}
                    </td>
                    <td className="px-3 py-2">{s.channel === "VENDOR" ? <Badge tone="info">{s.vendorName ?? "Vendor"}</Badge> : s.channel === "IN_HOUSE" ? <Badge tone="success">In-house</Badge> : <span className="text-xs text-muted-foreground">Not allocated</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>

      <Modal
        open={!!locate}
        onOpenChange={(o) => !o && setLocate(null)}
        title="Map position"
        description={locate ? `${nameOf(locate)} — type the coordinates, or place it by clicking on the Map tab.` : undefined}
        className="max-w-sm"
        footer={<div className="flex justify-between gap-2"><Button variant="ghost" className="text-loss" disabled={locate?.lat == null} onClick={() => locate && setCoords.mutate({ id: locate._id, lat: null, lng: null }, { onSuccess: () => setLocate(null) })}>Clear</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setLocate(null)}>Cancel</Button><Button className="bg-royal hover:bg-royal/90" loading={setCoords.isPending} onClick={savePos}>Save</Button></div></div>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" htmlFor="lat" error={posErr.lat}><Input id="lat" inputMode="decimal" value={pos.lat} onChange={(e) => setPos((p) => ({ ...p, lat: e.target.value }))} /></Field>
          <Field label="Longitude" htmlFor="lng" error={posErr.lng}><Input id="lng" inputMode="decimal" value={pos.lng} onChange={(e) => setPos((p) => ({ ...p, lng: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
