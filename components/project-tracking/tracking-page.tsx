"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, ClipboardCheck, House, Layers, Network, Store, TableProperties, Users, XCircle, type LucideIcon } from "lucide-react";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TabPanel } from "@/components/ui/tabs";
import { useApprovalProjects } from "@/lib/api/projectApproval";
import { useTrackingOverview, useTrackingShops, type TrackingOverview, type TrackMember } from "@/lib/api/projectTracking";
import { cn } from "@/lib/utils";
import { AllocationTabs } from "./allocation-tabs";
import { MindMap, type MapOpen } from "./mind-map";
import { LastActivity, OverallProgress } from "./progress-activity";
import { ShopsDrawer, type DrawerTarget } from "./shops-drawer";
import { ShopsTable } from "./shops-table";
import { fmtDate, INHOUSE, RED, STATUS, VENDOR } from "./ui";

type Tab = "map" | "allocation" | "shops" | "approvals";
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "map", label: "Recce Mind Map", icon: Network },
  { key: "allocation", label: "Allocation List", icon: Layers },
  { key: "shops", label: "Shop Details", icon: TableProperties },
  { key: "approvals", label: "Approvals", icon: ClipboardCheck },
];
const REQ: Record<string, string> = { ASO: "ASO", SHOP_DETAILS: "Shop Details", SHOP_MEASUREMENT: "Signage" };

function Stat({ icon: Icon, color, label, value, sub }: { icon: LucideIcon; color: string; label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#EEF0F3] bg-white p-3.5 shadow-sm">
      <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: `${color}14`, color }}><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-[#4B5563]">{label}</p>
        <p className="text-2xl font-bold leading-tight tabular-nums text-[#111827]">{value}</p>
        {sub && <p className="truncate text-[11px] text-[#6B7280]">{sub}</p>}
      </div>
    </div>
  );
}

function ProjectHeader({ d }: { d: TrackingOverview }) {
  const p = d.project;
  const done = d.counts.total > 0 && d.counts.completed === d.counts.total;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl border-2" style={{ borderColor: `${RED}40`, color: RED }}><Store className="size-6" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-[#111827] sm:text-xl">{p.name}</h2>
          {p.requirementType && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: RED }}>{REQ[p.requirementType] ?? p.requirementType}</span>}
        </div>
        <p className="mt-0.5 text-sm text-[#4B5563]">Project Code: <b className="text-[#111827]">{p.code}</b>{p.client ? <> · Client: <b className="text-[#111827]">{p.client}</b></> : null}{p.district ? <> · {p.district}</> : null} · {d.counts.total} shops</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-[#374151]"><CalendarDays className="size-4 text-[#6B7280]" aria-hidden />{fmtDate(p.startDate ?? p.createdAt)} – {p.lastSubmittedAt ? fmtDate(p.lastSubmittedAt) : "Today"}</span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", done ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#F0FDF4] text-[#15803D]")}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden />{done ? "Completed" : p.status === "IN_PROGRESS" || d.counts.total ? "In Progress" : p.status}
        </span>
      </div>
    </div>
  );
}

/** Project Tracking (Client Servicing): project dashboard with the allocation mind map and the shop review workspace. */
export function ProjectTrackingPage() {
  const [projQ, setProjQ] = useState("");
  const projects = useApprovalProjects({ q: projQ || undefined, page: 1, limit: 20 });
  const [picked, setPicked] = useState<SearchOption | null>(null);
  const first = projects.data?.data[0];
  const projectId = picked?.value ?? first?.id ?? null;
  const shown: SearchOption | null = picked ?? (first ? { value: first.id, label: first.code, sublabel: first.client ?? first.name } : null);
  const ov = useTrackingOverview(projectId);

  const [tab, setTab] = useState<Tab>("map");
  const [open, setOpen] = useState<MapOpen>({ vendor: false, inhouse: false });
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const [shopQ, setShopQ] = useState("");
  const found = useTrackingShops(projectId, { q: shopQ.trim(), page: 1, limit: 12 }, shopQ.trim().length > 0);

  const openMember = (m: TrackMember) => { setSelected(m.id); setTarget({ kind: "member", member: m }); };
  const openShop = (siteId: string, siteCode: string | null) => setTarget({ kind: "shop", siteId, siteCode });
  const d = ov.data;
  // The drawer header follows the live counts after an approval / rejection.
  const live: DrawerTarget | null = target?.kind === "member" && d ? { kind: "member", member: [...d.vendors, ...d.staff].find((m) => m.id === target.member.id && m.channel === target.member.channel) ?? target.member } : target;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs text-[#6B7280]">Recce Projects › Project Tracking{d ? ` › ${d.project.code}` : ""}</p>
          <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Project Tracking</h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div className="w-full sm:w-72">
            <SearchSelect
              id="pt-project"
              value={shown}
              options={(projects.data?.data ?? []).map((p) => ({ value: p.id, label: p.code, sublabel: `${p.client ?? p.name} · ${p.total} shops` }))}
              query={projQ}
              onQueryChange={setProjQ}
              onSelect={(o) => { setPicked(o); setOpen({ vendor: false, inhouse: false }); setSelected(null); setTarget(null); setTab("map"); }}
              loading={projects.isFetching}
              placeholder="Select project code…"
            />
          </div>
          <div className="w-full sm:w-80">
            <SearchSelect
              id="pt-shop-find"
              value={null}
              options={(found.data?.items ?? []).map((s) => ({ value: s.siteId, label: `#${s.siteCode} · ${s.shopName ?? ""}`, sublabel: `${s.team ?? "Not allocated"} · ${STATUS[s.status].label}` }))}
              query={shopQ}
              onQueryChange={setShopQ}
              onSelect={(o) => { const s = found.data?.items.find((x) => x.siteId === o.value); if (s) openShop(s.siteId, s.siteCode); setShopQ(""); }}
              loading={found.isFetching}
              placeholder="Find shop, vendor or staff…"
              emptyText="No matching shops"
              disabled={!projectId}
            />
          </div>
        </div>
      </div>

      {projects.isPending || (projectId && ov.isPending) ? (
        <div className="space-y-4"><Skeleton className="h-20 rounded-2xl" /><div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div><Skeleton className="h-96 rounded-2xl" /></div>
      ) : !projectId ? (
        <EmptyState icon={Network} title="No projects" description={projQ ? "No project matches this search." : "Projects with shops appear here."} />
      ) : ov.isError || !d ? (
        <ErrorState error={ov.error} onRetry={() => ov.refetch()} title="Could not load the project" />
      ) : (
        <>
          <ProjectHeader d={d} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            <Stat icon={Store} color={RED} label="Total Shops" value={d.counts.total} sub={d.counts.notAllocated ? `${d.counts.notAllocated} not allocated` : "All allocated"} />
            <Stat icon={Users} color={VENDOR} label="Vendor Shops" value={d.counts.vendor} sub={`(${d.counts.vendors} Vendors · ${d.counts.percent.vendor}%)`} />
            <Stat icon={House} color={INHOUSE} label="In-house Shops" value={d.counts.inhouse} sub={`(${d.counts.staff} Staff · ${d.counts.percent.inhouse}%)`} />
            <Stat icon={CheckCircle2} color="#16A34A" label="Completed" value={d.counts.completed} sub={`(${d.counts.percent.completed}%)`} />
            <Stat icon={Clock3} color="#F59E0B" label="Yet to Complete" value={d.counts.pending} sub={`(${d.counts.percent.pending}%)`} />
            <Stat icon={XCircle} color="#DC2626" label="Rejected" value={d.counts.rejected} sub={`(${d.counts.percent.rejected}%)`} />
          </div>

          <div role="tablist" aria-label="Project tracking views" className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`pt-tab-${t.key}`}
                  aria-selected={active}
                  aria-controls="pt-panel"
                  onClick={() => setTab(t.key)}
                  className={cn("flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors", active ? "border-transparent text-white shadow-sm" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]")}
                  style={active ? { background: RED } : undefined}
                >
                  <t.icon className="size-4" aria-hidden />{t.label}
                </button>
              );
            })}
          </div>

          <div id="pt-panel" role="tabpanel" aria-labelledby={`pt-tab-${tab}`}>
            <TabPanel k={tab}>
              {tab === "map" && (
                <div className="space-y-4">
                  <MindMap data={d} open={open} setOpen={setOpen} selected={selected} onSelect={openMember} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <OverallProgress data={d} />
                    <LastActivity data={d} onOpen={(e) => e.siteId && openShop(e.siteId, e.siteCode)} />
                  </div>
                </div>
              )}
              {tab === "allocation" && <div className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm"><AllocationTabs data={d} onSelect={openMember} /></div>}
              {tab === "shops" && <div className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm"><ShopsTable key={`all-${d.project.id}`} data={d} onOpen={(s) => openShop(s.siteId, s.siteCode)} /></div>}
              {tab === "approvals" && (
                <div className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm">
                  <p className="mb-3 text-sm text-[#4B5563]">Submitted shops waiting for the Client Servicing decision.</p>
                  <ShopsTable key={`appr-${d.project.id}`} data={d} preset={{ status: "SUBMITTED", approval: "PENDING" }} onOpen={(s) => openShop(s.siteId, s.siteCode)} />
                </div>
              )}
            </TabPanel>
          </div>
        </>
      )}

      {live && projectId && <ShopsDrawer key={live.kind === "member" ? `m-${live.member.channel}-${live.member.id}` : `s-${live.siteId}`} projectId={projectId} target={live} onClose={() => { setTarget(null); setSelected(null); }} />}
    </div>
  );
}
