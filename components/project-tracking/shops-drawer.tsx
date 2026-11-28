"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Store } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useTrackingShops, type TrackMember, type TrackShopFilters } from "@/lib/api/projectTracking";
import { cn } from "@/lib/utils";
import { ShopPanel } from "./shop-panel";
import { Bar, INHOUSE, RED, STATUS, VENDOR } from "./ui";

export type DrawerTarget = { kind: "member"; member: TrackMember } | { kind: "shop"; siteId: string; siteCode: string | null };

/**
 * Second reference design: a vendor's / staff member's shops as tabs (or one shop), Previous / Next, and the selected shop's
 * information, photos, measurements, history and the CS decision.
 */
export function ShopsDrawer({ projectId, target, onClose }: { projectId: string; target: DrawerTarget; onClose: () => void }) {
  const member = target.kind === "member" ? target.member : null;
  const filter: TrackShopFilters = member
    ? { ...(member.channel === "VENDOR" ? { vendor: member.id } : { staff: member.id }), page: 1, limit: 100 }
    : { q: target.kind === "shop" ? (target.siteCode ?? undefined) : undefined, page: 1, limit: 20 };
  const q = useTrackingShops(projectId, filter);
  const list = (q.data?.items ?? []).filter((s) => member || target.kind !== "shop" || s.siteId === target.siteId);
  const [picked, setPicked] = useState<string | null>(target.kind === "shop" ? target.siteId : null);
  const idx = Math.max(0, list.findIndex((s) => s.siteId === picked));
  const shop = list[idx];
  const tabs = useRef<HTMLDivElement>(null);
  const go = (d: number) => {
    const next = list[idx + d];
    if (!next) return;
    setPicked(next.siteId);
    tabs.current?.querySelector<HTMLElement>(`[data-site="${next.siteId}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  };
  const color = member ? (member.channel === "VENDOR" ? VENDOR : INHOUSE) : RED;

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      variant="drawer"
      className="max-w-6xl"
      title={member ? member.name : shop ? `Shop #${shop.siteCode}` : "Shop Details"}
      titleClassName="text-lg"
      description={member ? `${member.channel === "VENDOR" ? "Vendor" : "In-house staff"} · ${member.assigned} shops allocated` : (shop?.shopName ?? undefined)}
    >
      {member && (
        <div className="mb-4 rounded-xl border border-[#EEF0F3] p-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {([["Assigned", member.assigned, "#111827"], ["Completed", member.completed, "#16A34A"], ["Pending", member.pending, "#D97706"], ["Rejected", member.rejected, "#DC2626"]] as const).map(([l, v, c]) => (
              <div key={l} className="rounded-lg bg-[#F9FAFB] py-2">
                <p className="text-lg font-bold tabular-nums" style={{ color: c }}>{v}</p>
                <p className="text-[11px] text-[#6B7280]">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#6B7280]"><Bar value={member.percent} color={color} className="flex-1" /><span className="font-semibold text-[#111827]">{member.percent}% completed</span></div>
        </div>
      )}

      {q.isPending ? <RowsSkeleton rows={4} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the shops" /> : list.length === 0 ? <EmptyState icon={Store} title="No shops found" /> : (
        <>
          {list.length > 1 && (
            <div className="mb-3 flex items-center gap-2">
              <button type="button" onClick={() => go(-1)} disabled={idx === 0} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-40" aria-label="Previous shop"><ChevronLeft className="size-4" /></button>
              <div ref={tabs} role="tablist" aria-label="Shops" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
                {list.map((s) => {
                  const active = s.siteId === shop?.siteId;
                  return (
                    <button
                      key={s.siteId}
                      data-site={s.siteId}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPicked(s.siteId)}
                      className={cn("flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors", active ? "border-transparent text-white" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]")}
                      style={active ? { background: RED } : undefined}
                      title={`${s.shopName ?? s.siteCode} · ${STATUS[s.status].label}`}
                    >
                      <span className="size-2 rounded-full" style={{ background: active ? "#fff" : STATUS[s.status].color }} aria-hidden />
                      <span className="max-w-36 truncate font-semibold">{s.shopName ?? s.siteCode}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => go(1)} disabled={idx >= list.length - 1} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-40" aria-label="Next shop"><ChevronRight className="size-4" /></button>
            </div>
          )}
          {shop && (
            <div className="rounded-xl border border-[#EEF0F3] px-4 pt-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Store className="size-5" style={{ color: RED }} aria-hidden />
                <h3 className="text-base font-semibold text-[#111827]">Shop #{shop.siteCode}</h3>
                <span className="text-sm text-[#6B7280]">{shop.shopName}</span>
                {list.length > 1 && <span className="ml-auto text-xs text-[#6B7280]">{idx + 1} of {list.length}</span>}
              </div>
              <ShopPanel key={shop.siteId} shop={shop} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
