"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Home, Map, MapPinOff, Route, Shuffle, Store, Users } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Button } from "@/components/ui/button";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useAllocationOverview } from "@/lib/api/allocation";
import { useProject } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AllocationItinerary } from "./allocation-itinerary";
import { AllocationMapTab } from "./allocation-map-tab";
import { AllocationShops } from "./allocation-shops";
import { AllocationSplit } from "./allocation-split";
import { colorFor } from "./team-colors";

type Tab = "shops" | "map" | "split" | "travel";

/** Recce planning & assignment: who does which shop (vendor or in-house), on a list and on the map. */
export function AllocationScreen() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const project = useProject(id);
  const ov = useAllocationOverview(id);
  const [tab, setTab] = useState<Tab>("shops");
  const closed = project.data?.status === "CANCELLED" || project.data?.status === "LOSS";
  const canEdit = can("sites:write") && can("verification:manage") && !closed;

  if (ov.isPending || project.isPending) return <RowsSkeleton rows={6} className="p-4" />;
  if (ov.isError) return <ErrorState error={ov.error} onRetry={() => ov.refetch()} title="Could not load the allocation" />;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} />;
  const o = ov.data;
  const p = project.data;
  const allocated = o.total - o.unassigned;
  const pct = o.total ? Math.round((allocated / o.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader
          code="6"
          title={`Recce Planning & Assignment – ${p.client?.name ?? ""} · ${p.campaign ?? p.name}`}
          subtitle={`${p.code} · ${o.total} shops`}
          right={<Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white"><Link href={`/operations/projects/${id}`}><ArrowLeft className="size-4" aria-hidden /> Project</Link></Button>}
        />
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <div className="rounded-xl bg-[#e8f0ff] p-3"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Store className="size-3.5" aria-hidden /> Allocated</p><p className="text-2xl font-bold tabular-nums text-royal">{allocated}<span className="text-sm font-medium text-muted-foreground"> / {o.total}</span></p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Shops allocated" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-royal" style={{ width: `${pct}%` }} /></div></div>
          <div className={cn("rounded-xl p-3", o.unassigned ? "bg-[#fff0e0]" : "bg-[#e2f8ea]")}><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Users className="size-3.5" aria-hidden /> Not allocated</p><p className={cn("text-2xl font-bold tabular-nums", o.unassigned ? "text-approval" : "text-finance")}>{o.unassigned}</p></div>
          <div className={cn("rounded-xl p-3", o.withoutCoords ? "bg-[#fdecec]" : "bg-[#e2f8ea]")}><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><MapPinOff className="size-3.5" aria-hidden /> No map position</p><p className={cn("text-2xl font-bold tabular-nums", o.withoutCoords ? "text-loss" : "text-finance")}>{o.withoutCoords}</p></div>
          <div className="rounded-xl bg-[#f6f0ff] p-3"><p className="text-xs font-medium text-muted-foreground">Start point</p><p className="truncate text-sm font-bold text-vendor">{o.origin ? o.origin.name : "Not set"}</p>{!o.origin && <button type="button" className="text-xs text-royal underline" onClick={() => setTab("map")}>Set on the map</button>}</div>
        </div>
        {o.teams.length > 0 && (
          <ul className="flex flex-wrap gap-2 border-t border-border px-4 py-3" aria-label="Teams">
            {o.teams.map((t) => (
              <li key={t.key} className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
                <span className="size-2.5 rounded-full" style={{ background: colorFor(t.vendorId ? "VENDOR" : "IN_HOUSE", t.vendorId, o.teams) }} />
                {t.vendorId ? <Building2 className="size-3.5 text-vendor" aria-hidden /> : <Home className="size-3.5 text-finance" aria-hidden />}
                <strong className="text-navy">{t.name}</strong> {t.shops} shops · {t.districts.length} district(s){o.origin ? ` · ≈${t.approxKm} km` : ""}
              </li>
            ))}
          </ul>
        )}
        <Tabs
          label="Allocation views"
          className="border-t border-border"
          value={tab}
          onChange={(k) => setTab(k as Tab)}
          tabs={[
            { key: "shops", label: "Shops", icon: Store, count: o.total },
            { key: "map", label: "Map view", icon: Map },
            { key: "split", label: "Split assignment", icon: Shuffle },
            { key: "travel", label: "In-house travel plan", icon: Route },
          ]}
        />
      </div>

      <TabPanel k={tab} className="space-y-4">
        {tab === "shops" && <AllocationShops projectId={id} overview={o} canEdit={canEdit} />}
        {tab === "map" && <AllocationMapTab projectId={id} overview={o} canEdit={canEdit} />}
        {tab === "split" && <AllocationSplit projectId={id} overview={o} />}
        {tab === "travel" && <AllocationItinerary projectId={id} />}
      </TabPanel>
    </div>
  );
}
