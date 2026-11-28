"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Copy, ExternalLink, History, Info, Layers, MapPin, Store, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { UnitReview } from "@/components/unit-review/unit-review";
import { allUnits, ReviewerInfo, UnitBadge, unitTitle } from "@/components/unit-review/unit-shared";
import { useApprovalWorkspace, type ApprovalWorkspace } from "@/lib/api/projectApproval";
import type { TrackShop } from "@/lib/api/projectTracking";
import { useStartReview, useTimeline, type WsPhoto } from "@/lib/api/recceReview";
import { fmtAt, RED, StatusBadge } from "./ui";

type Tab = "info" | "units" | "activity";

/** Selected shop: Shop Information, unit-wise review (photos, measurement, Q&A, versions, approve / reject) and the activity timeline. */
export function ShopPanel({ shop }: { shop: TrackShop }) {
  const ws = useApprovalWorkspace(shop.version > 0 ? shop.submissionId : null);
  if (shop.version === 0) {
    return (
      <div className="space-y-4 pb-4">
        <Facts shop={shop} />
        <EmptyState icon={Store} title={shop.status === "IN_PROGRESS" ? "Recce in progress" : "Recce not started yet"} description="Units, photos, measurements and answers appear here once the shop is submitted." />
      </div>
    );
  }
  if (ws.isPending) return <div className="space-y-3 pb-4"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  if (ws.isError) return <ErrorState error={ws.error} onRetry={() => ws.refetch()} title="Could not load this shop" />;
  return <Loaded w={ws.data} shop={shop} />;
}

function Facts({ shop, w }: { shop: TrackShop; w?: ApprovalWorkspace }) {
  const toast = useToast();
  const photos = (w?.boards ?? []).flatMap((b) => b.units.flatMap((u) => u.photos));
  const front: WsPhoto | undefined = photos.find((p) => p.category === "SHOP_FRONT" && p.state === "SUBMITTED") ?? w?.photos.find((p) => p.category === "SHOP_FRONT");
  const gps = photos.find((p) => p.lat != null && p.lng != null) ?? w?.photos.find((p) => p.lat != null && p.lng != null);
  const lat = gps?.lat ?? shop.lat;
  const lng = gps?.lng ?? shop.lng;
  const copy = () => {
    if (lat == null || lng == null) return;
    void navigator.clipboard?.writeText(`${lat}, ${lng}`).then(() => toast("GPS copied"), () => toast("Could not copy", "error"));
  };
  return (
    <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
      {front?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage link
        <img src={front.editedUrl ?? front.url} alt={`${shop.shopName ?? "Shop"} front view`} className="h-28 w-full rounded-xl border border-[#EEF0F3] object-cover sm:h-full sm:max-h-36" />
      ) : (
        <div className="grid h-28 place-items-center rounded-xl bg-[#F3F4F6] text-[#9CA3AF]"><Store className="size-8" aria-hidden /></div>
      )}
      <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
        <Fact icon={Store} label="Shop" value={shop.shopName ?? "-"} sub={`Shop ID ${shop.siteCode}${w?.project.client ? ` · ${w.project.client}` : ""}`} />
        <Fact icon={MapPin} label="Location" value={w?.shop.address || shop.address || shop.location || "-"} sub={shop.district ?? undefined} />
        <Fact icon={UserRound} label="Assigned to" value={shop.team ?? "-"} sub={shop.channel === "VENDOR" ? `Vendor · allocated ${fmtAt(shop.allocatedAt)}` : shop.channel === "IN_HOUSE" ? `In-house · allocated ${fmtAt(shop.allocatedAt)}` : "Not allocated"} />
        <div className="flex min-w-0 gap-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0" style={{ color: RED }} aria-hidden />
          <div className="min-w-0">
            <dt className="text-xs text-[#6B7280]">GPS {gps ? "(from photos)" : "(shop location)"}</dt>
            {lat != null && lng != null ? (
              <dd className="flex flex-wrap items-center gap-2 font-medium text-[#111827]">
                <span className="tabular-nums">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
                <button type="button" onClick={copy} className="rounded p-0.5 text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="Copy GPS coordinates"><Copy className="size-3.5" /></button>
                <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#2563EB] hover:underline">Maps<ExternalLink className="size-3" aria-hidden /></a>
              </dd>
            ) : <dd className="text-[#6B7280]">Not available</dd>}
            {gps && <dd className="text-xs text-[#6B7280]">Captured {fmtAt(gps.capturedAt)}{gps.gpsAccuracy != null ? ` · ±${Math.round(gps.gpsAccuracy)} m` : ""}</dd>}
          </div>
        </div>
        <div className="flex gap-2.5 sm:col-span-2">
          <CalendarClock className="mt-0.5 size-4 shrink-0" style={{ color: RED }} aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={shop.status} />
            {shop.submittedAt && <span className="text-xs text-[#6B7280]">Last submitted {fmtAt(shop.submittedAt)}</span>}
          </div>
        </div>
      </dl>
    </div>
  );
}

function Fact({ icon: Icon, label, value, sub }: { icon: typeof MapPin; label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0" style={{ color: RED }} aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-[#6B7280]">{label}</dt>
        <dd className="break-words font-medium text-[#111827]">{value}</dd>
        {sub && <dd className="text-xs text-[#6B7280]">{sub}</dd>}
      </div>
    </div>
  );
}

function Loaded({ w, shop }: { w: ApprovalWorkspace; shop: TrackShop }) {
  const units = allUnits(w);
  const [tab, setTab] = useState<Tab>(units.length ? "units" : "info");
  const start = useStartReview(w.id);
  // Opening a submission that waits for my stage marks the review as started (same rule as Project Approval).
  useEffect(() => {
    if (w.me.openStage && w.me.openStage === w.me.stage && w.status === "SUBMITTED") start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.id, w.status, w.me.openStage]);
  const s = w.summary;
  const tabs: TabItem<Tab>[] = [
    { key: "info", label: "Shop Information", icon: Info },
    { key: "units", label: `Units & Photos (${units.length})`, icon: Layers },
    { key: "activity", label: "Activity", icon: History },
  ];
  return (
    <div className="pb-4">
      <Tabs items={tabs} value={tab} onChange={setTab} idPrefix="pt-shop" />
      <div id="pt-shop-panel" role="tabpanel" aria-labelledby={`pt-shop-tab-${tab}`} className="pt-4">
        {tab === "info" && (
          <div className="space-y-4">
            <Facts shop={shop} w={w} />
            <section className="rounded-xl border border-[#EEF0F3] p-4">
              <h3 className="text-sm font-semibold text-[#111827]">Units{s ? ` · ${s.approved} of ${s.units} approved` : ""}</h3>
              <ul className="mt-2 divide-y divide-[#F3F4F6]">
                {units.map(({ board, unit }) => (
                  <li key={`${board.key}-${unit.key}`} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 font-medium text-[#111827]">{unitTitle(board, unit)}{unit.currentVersion ? <span className="ml-1 text-xs text-[#6B7280]">V{unit.currentVersion}</span> : null}</span>
                    <ReviewerInfo unit={unit} compact className="basis-full sm:basis-auto" />
                    <UnitBadge status={unit.status} />
                  </li>
                ))}
                {!units.length && <li className="py-2 text-xs text-[#6B7280]">No unit record yet.</li>}
              </ul>
              <button type="button" onClick={() => setTab("units")} className="mt-2 text-xs font-semibold hover:underline" style={{ color: RED }}>Open unit review →</button>
            </section>
          </div>
        )}
        {tab === "units" && <UnitReview w={w} />}
        {tab === "activity" && <Timeline id={w.id} />}
      </div>
    </div>
  );
}

function Timeline({ id }: { id: string }) {
  const tl = useTimeline(id, {});
  const events = useMemo(() => [...(tl.data ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [tl.data]);
  if (tl.isPending) return <RowsSkeleton rows={4} />;
  if (tl.isError) return <ErrorState error={tl.error} onRetry={() => tl.refetch()} />;
  if (!events.length) return <p className="text-sm text-[#6B7280]">No activity yet.</p>;
  return (
    <ol className="relative space-y-3 border-l-2 border-[#F3F4F6] pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-white" style={{ background: /REJECT|REWORK/.test(e.type) ? "#DC2626" : /APPROV/.test(e.type) ? "#16A34A" : "#94A3B8" }} aria-hidden />
          <p className="text-sm font-medium text-[#111827]">{e.label}{e.mediaKey ? <span className="font-normal text-[#6B7280]"> · {e.mediaKey}</span> : null}{e.version ? <span className="font-normal text-[#6B7280]"> · shop submit #{e.version}</span> : null}</p>
          <p className="text-xs text-[#6B7280]">{e.actor} · {fmtAt(e.at)}</p>
          {e.reason && <p className="text-xs text-[#B91C1C]">{e.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
