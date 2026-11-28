"use client";

import { useState } from "react";
import { House, Layers, UserRound } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import type { TrackingOverview, TrackMember } from "@/lib/api/projectTracking";
import { Bar, INHOUSE, stateOf, VENDOR } from "./ui";

type Key = "all" | "vendor" | "staff";

/** Allocation / Vendor / Staff summary: every person's assigned, completed, yet to complete and rejected shops. */
export function AllocationTabs({ data, onSelect }: { data: TrackingOverview; onSelect: (m: TrackMember) => void }) {
  const [tab, setTab] = useState<Key>("all");
  const items: TabItem<Key>[] = [
    { key: "all", label: `Allocation Summary (${data.vendors.length + data.staff.length})`, icon: Layers },
    { key: "vendor", label: `Vendor Summary (${data.vendors.length})`, icon: UserRound },
    { key: "staff", label: `Staff Summary (${data.staff.length})`, icon: House },
  ];
  const rows = tab === "vendor" ? data.vendors : tab === "staff" ? data.staff : [...data.vendors, ...data.staff];
  const th = "bg-[#F9FAFB] px-3 py-2.5 text-left text-xs font-semibold text-[#4B5563]";
  return (
    <div>
      <Tabs items={items} value={tab} onChange={setTab} idPrefix="pt-alloc" />
      <div id="pt-alloc-panel" role="tabpanel" aria-labelledby={`pt-alloc-tab-${tab}`} className="pt-3">
        {rows.length === 0 ? <EmptyState title="No allocation yet" description="Shops are allocated to vendors and in-house staff by Operations." /> : (
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-[#EEF0F3]">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <th className={th}>Allocation</th><th className={th}>Name</th><th className={`${th} text-right`}>Assigned</th><th className={`${th} text-right`}>Completed</th>
                  <th className={`${th} text-right`}>Yet to Complete</th><th className={`${th} text-right`}>Rejected</th><th className={th}>Completion</th><th className={th}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {rows.map((m) => {
                  const color = m.channel === "VENDOR" ? VENDOR : INHOUSE;
                  const s = stateOf(m);
                  return (
                    <tr key={`${m.channel}-${m.id}`} className="hover:bg-[#FAFAFB]">
                      <td className="px-3 py-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color, background: `${color}14` }}>{m.channel === "VENDOR" ? "Vendor" : "In-house Staff"}</span></td>
                      <td className="px-3 py-2.5"><span className="flex items-center gap-1.5 font-semibold text-[#111827]"><s.Icon className="size-4 shrink-0" style={{ color: s.color }} aria-label={s.label} />{m.name}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m.assigned}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#16A34A]">{m.completed}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#D97706]">{m.pending}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#DC2626]">{m.rejected}</td>
                      <td className="px-3 py-2.5"><span className="flex items-center gap-2"><Bar value={m.percent} color={color} className="w-24" /><span className="text-xs font-semibold tabular-nums">{m.percent}%</span></span></td>
                      <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => onSelect(m)} className="rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-[#F9FAFB]">View Shops</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
