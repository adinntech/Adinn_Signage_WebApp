"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useTrackingShops, type TrackingOverview, type TrackShop, type TrackShopFilters, type TrackStatus } from "@/lib/api/projectTracking";
import { cn } from "@/lib/utils";
import { fmtAt, STATUS, StatusBadge } from "./ui";

const DECISION: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-[#FFFBEB] text-[#B45309]" },
  APPROVED: { label: "Approved", cls: "bg-[#ECFDF5] text-[#047857]" },
  REJECTED: { label: "Rejected", cls: "bg-[#FEF2F2] text-[#B91C1C]" },
  REWORK: { label: "Rework", cls: "bg-[#FEF2F2] text-[#B91C1C]" },
  VOID: { label: "—", cls: "text-[#9CA3AF]" },
};
const BASE: TrackShopFilters = { channel: "all", status: "all", approval: "all", page: 1, limit: 20 };

/** Global shop search with combined filters (server-side) and pagination. `preset` fixes filters for the Approvals tab. */
export function ShopsTable({ data, preset, onOpen }: { data: TrackingOverview; preset?: Partial<TrackShopFilters>; onOpen: (s: TrackShop) => void }) {
  const start = { ...BASE, ...preset };
  const [f, setF] = useState<TrackShopFilters>(start);
  const [text, setText] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setF((x) => (x.q === (text.trim() || undefined) ? x : { ...x, q: text.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [text]);
  const q = useTrackingShops(data.project.id, f);
  const set = (p: Partial<TrackShopFilters>) => setF((x) => ({ ...x, ...p, page: 1 }));
  const dirty = !!text || JSON.stringify({ ...f, q: undefined }) !== JSON.stringify({ ...start, q: undefined });
  const th = "bg-[#F9FAFB] px-3 py-2.5 text-left text-xs font-semibold text-[#4B5563] whitespace-nowrap";

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(5,minmax(0,1fr))_auto]">
        <label className="relative sm:col-span-2 xl:col-span-1">
          <span className="sr-only">Search shops</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Shop ID, name, vendor, staff, location…" className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#D92D20]" />
        </label>
        <Select aria-label="Allocation type" value={f.channel} onChange={(e) => set({ channel: e.target.value as TrackShopFilters["channel"], vendor: undefined, staff: undefined })}>
          <option value="all">All allocation</option><option value="VENDOR">Vendor</option><option value="IN_HOUSE">In-house</option>
        </Select>
        {!preset?.status && (
          <Select aria-label="Recce status" value={f.status} onChange={(e) => set({ status: e.target.value as TrackShopFilters["status"] })}>
            <option value="all">All status</option>
            {(Object.keys(STATUS) as TrackStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </Select>
        )}
        {!preset?.approval && (
          <Select aria-label="CS approval" value={f.approval} onChange={(e) => set({ approval: e.target.value as TrackShopFilters["approval"] })}>
            <option value="all">All approval</option><option value="PENDING">CS pending</option><option value="APPROVED">CS approved</option><option value="REJECTED">CS rejected</option>
          </Select>
        )}
        <Select aria-label="Vendor or staff" value={f.vendor ? `v:${f.vendor}` : f.staff ? `s:${f.staff}` : ""} onChange={(e) => { const v = e.target.value; set({ vendor: v.startsWith("v:") ? v.slice(2) : undefined, staff: v.startsWith("s:") ? v.slice(2) : undefined, channel: v.startsWith("v:") ? "VENDOR" : v.startsWith("s:") ? "IN_HOUSE" : f.channel }); }}>
          <option value="">All vendors / staff</option>
          {data.vendors.length > 0 && <optgroup label="Vendors">{data.vendors.map((m) => <option key={m.id} value={`v:${m.id}`}>{m.name}</option>)}</optgroup>}
          {data.staff.length > 0 && <optgroup label="In-house staff">{data.staff.map((m) => <option key={m.id} value={`s:${m.id}`}>{m.name}</option>)}</optgroup>}
        </Select>
        <Select aria-label="District" value={f.district ?? ""} onChange={(e) => set({ district: e.target.value || undefined })}>
          <option value="">All locations</option>
          {(q.data?.districts ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Button variant="outline" disabled={!dirty} onClick={() => { setText(""); setF(start); }}><RotateCcw className="size-4" aria-hidden /> Reset</Button>
      </div>

      {q.isPending ? <RowsSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load shops" /> : q.data.items.length === 0 ? <EmptyState icon={Store} title="No shops found" description="Try another search or filter." /> : (
        <>
          <div className={cn("max-h-[62vh] overflow-auto rounded-xl border border-[#EEF0F3]", q.isFetching && "opacity-70")}>
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr><th className={th}>S.No</th><th className={th}>Shop</th><th className={th}>Location</th><th className={th}>Allocated to</th><th className={th}>Status</th><th className={th}>Photos</th><th className={th}>Submitted</th><th className={th}>CS Approval</th><th className={th}><span className="sr-only">Action</span></th></tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {q.data.items.map((s, i) => (
                  <tr key={s.siteId} className="cursor-pointer hover:bg-[#FAFAFB]" onClick={() => onOpen(s)}>
                    <td className="px-3 py-2.5 tabular-nums text-[#6B7280]">{(q.data.meta.page - 1) * q.data.meta.limit + i + 1}</td>
                    <td className="px-3 py-2.5"><span className="block font-semibold text-[#111827]">{s.shopName ?? "-"}</span><span className="text-xs font-semibold text-[#D92D20]">#{s.siteCode}</span></td>
                    <td className="px-3 py-2.5 text-[#374151]">{s.location ?? "-"}</td>
                    <td className="px-3 py-2.5"><span className="block text-[#111827]">{s.team ?? "-"}</span><span className="text-xs text-[#6B7280]">{s.channel === "VENDOR" ? "Vendor" : s.channel === "IN_HOUSE" ? "In-house" : "Not allocated"}</span></td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} />{s.version > 1 && <span className="ml-1 text-[11px] font-semibold text-[#6B7280]">V{s.version}</span>}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[#374151]">{s.version ? `${s.photoCount}${s.expectedPhotos ? ` / ${s.expectedPhotos}` : ""}` : "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-[#374151]">{fmtAt(s.submittedAt)}</td>
                    <td className="px-3 py-2.5">{s.cs ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", DECISION[s.cs.decision]?.cls)}>{DECISION[s.cs.decision]?.label ?? s.cs.decision}</span> : <span className="text-xs text-[#9CA3AF]">-</span>}</td>
                    <td className="px-3 py-2.5 text-right"><button type="button" onClick={(e) => { e.stopPropagation(); onOpen(s); }} className="rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-white">Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={q.data.meta} onPage={(page) => setF((x) => ({ ...x, page }))} onLimit={(limit) => setF((x) => ({ ...x, limit, page: 1 }))} sizes={[20, 50, 100]} />
        </>
      )}
    </div>
  );
}
