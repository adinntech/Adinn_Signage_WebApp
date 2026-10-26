"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BarChart3, FileWarning, FolderKanban, MapPin, Route, Search, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { SortHeader, nextSort, type SortState } from "@/components/ui/sort-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useDebounced } from "@/hooks/use-debounced";
import { useClientOptions } from "@/lib/api/clients";
import { REQUIREMENT_TYPES, useProjects, useProjectSummary, type Project } from "@/lib/api/projects";
import { formatDate } from "@/lib/format";
import { OPS_STAGE_LABEL, PRIORITY_CLASS, PRIORITY_LABEL, STATUS_META, isOverdue, reqLabel, totalExpected } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

/** The same project list serves four menu items; each opens the project in its own screen. */
const TARGETS = {
  projects: { path: "projects", title: "Projects", subtitle: "Every project BD has assigned to Operations", cta: "Open", icon: ArrowRight },
  cost: { path: "cost", title: "Cost Comparison", subtitle: "Pick a project to compare vendor and in-house cost, and review expense bills", cta: "Compare cost", icon: BarChart3 },
  allocation: { path: "allocation", title: "Shop Allocation", subtitle: "Pick a project to give its shops to vendors or the in-house team", cta: "Allocate shops", icon: MapPin },
  movement: { path: "movement", title: "Movement", subtitle: "Pick a project to plan the in-house team's day-wise road routes", cta: "Plan routes", icon: Route },
} satisfies Record<string, { path: string; title: string; subtitle: string; cta: string; icon: LucideIcon }>;
export type ProjectsTarget = keyof typeof TARGETS;

type TabKey = "ALL" | "RECCE_ASSIGNED" | "PLANNING" | "IN_PROGRESS" | "CLIENT_APPROVAL" | "COMPLETED" | "OVERDUE" | "CANCELLED" | "LOSS";
const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "RECCE_ASSIGNED", label: "New Assigned" },
  { key: "PLANNING", label: "In Planning" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "CLIENT_APPROVAL", label: "Pending Approval" },
  { key: "COMPLETED", label: "Completed" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "LOSS", label: "Loss" },
];
type SortKey = "code" | "name" | "district" | "expectedShops" | "assignedAt" | "targetDate" | "priority";

export function OpsProjects({ target = "projects" }: { target?: ProjectsTarget }) {
  const t = TARGETS[target];
  const router = useRouter();
  const summary = useProjectSummary();
  const clients = useClientOptions();
  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [clientId, setClientId] = useState("");
  const [req, setReq] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "assignedAt", dir: "desc" });
  const [page, setPage] = useState(1);

  const list = useProjects({
    page,
    limit: PAGE_SIZE,
    assigned: "true",
    q: dq || undefined,
    clientId: clientId || undefined,
    requirementType: req || undefined,
    overdue: tab === "OVERDUE" ? "true" : undefined,
    status: tab !== "ALL" && tab !== "OVERDUE" ? tab : undefined,
    sort: `${sort.dir === "desc" ? "-" : ""}${sort.key}`,
  });
  const by = summary.data?.byStatus ?? {};
  const allAssigned = ["RECCE_ASSIGNED", "PLANNING", "IN_PROGRESS", "CLIENT_APPROVAL", "COMPLETED", "CANCELLED", "LOSS"].reduce((a, s) => a + (by[s] ?? 0), 0);
  const count = (k: TabKey) => (summary.data ? (k === "ALL" ? allAssigned : k === "OVERDUE" ? (summary.data.overdue ?? 0) : (by[k] ?? 0)) : undefined);
  const rows = list.data?.data ?? [];
  const filtered = !!(dq || clientId || req);
  const open = (p: Project, to: ProjectsTarget = target) => router.push(`/operations/${TARGETS[to].path}/${p._id}`);
  const pick = (k: TabKey) => { setTab(k); setPage(1); };
  const onSort = (k: SortKey) => { setSort((s) => nextSort(s, k)); setPage(1); };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-navy"><FolderKanban className="size-5 text-royal" aria-hidden /> {t.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <p className="text-sm text-muted-foreground">{summary.data ? <><strong className="text-navy">{allAssigned}</strong> projects assigned to Operations</> : "Loading…"}</p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <Tabs label="Project stage" className="border-b border-border pt-2" value={tab} onChange={(k) => pick(k as TabKey)} tabs={TABS.map((x) => ({ key: x.key, label: x.label, count: count(x.key) }))} />

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 p-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by project code, client, campaign, district…" className="bg-surface pl-9" aria-label="Search projects" />
          </div>
          <div className="w-44"><Select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }} aria-label="Filter by client"><option value="">All clients</option>{clients.data?.data.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></div>
          <div className="w-52"><Select value={req} onChange={(e) => { setReq(e.target.value); setPage(1); }} aria-label="Filter by requirement type"><option value="">All requirement types</option>{REQUIREMENT_TYPES.map((r) => <option key={r} value={r}>{reqLabel(r)}</option>)}</Select></div>
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setClientId(""); setReq(""); setPage(1); }}><X className="size-4" aria-hidden /> Clear</Button>}
        </div>

        <div className={cn("overflow-auto transition-opacity duration-150", list.isFetching && !list.isPending && "opacity-60")} aria-busy={list.isFetching}>
          {list.isPending ? (
            <RowsSkeleton rows={8} className="p-4" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title={filtered ? "No projects match your filters" : "No projects in this stage"} description={filtered ? "Clear the filters or pick another stage." : "Projects assigned by BD will show up here."} />
          ) : (
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-[#eef4ff] text-xs uppercase tracking-wide text-navy">
                <tr>
                  <SortHeader col="code" label="Project" sort={sort} onSort={onSort} />
                  <SortHeader col="name" label="Client" sort={sort} onSort={onSort} />
                  <SortHeader col="district" label="District" sort={sort} onSort={onSort} />
                  <SortHeader col="expectedShops" label="Shops" sort={sort} onSort={onSort} />
                  <SortHeader col="assignedAt" label="Assigned" sort={sort} onSort={onSort} />
                  <SortHeader col="targetDate" label="Due" sort={sort} onSort={onSort} />
                  <SortHeader col="priority" label="Priority" sort={sort} onSort={onSort} />
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => {
                  const aso = p.requirementType === "ASO";
                  const total = totalExpected(p);
                  const pct = !aso && total ? Math.min(100, Math.round((p.siteCount / total) * 100)) : 0;
                  const overdue = isOverdue(p);
                  const importPending = !aso && p.siteCount === 0 && !["COMPLETED", "CANCELLED", "LOSS"].includes(p.status);
                  return (
                    <tr key={p._id} onClick={() => open(p)} className="cursor-pointer hover:bg-[#f4f8ff]">
                      <td className="px-4 py-3">
                        <span className="font-semibold tabular-nums text-navy">{p.code}</span>
                        <span className="block max-w-56 truncate text-xs text-muted-foreground">{p.campaign}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {p.client?.name}
                        <span className="mt-0.5 block"><span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-medium text-royal">{reqLabel(p.requirementType)}</span></span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.district || "-"}</td>
                      <td className="w-44 px-4 py-3">
                        {aso ? (
                          <span className="text-xs text-muted-foreground">Unknown (survey)</span>
                        ) : (
                          <>
                            <div className="flex items-baseline justify-between text-xs"><span className="font-semibold tabular-nums text-navy">{p.siteCount}<span className="font-normal text-muted-foreground"> / {total || "-"}</span></span><span className="text-muted-foreground">{pct}%</span></div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Shops entered" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-finance" style={{ width: `${pct}%` }} /></div>
                          </>
                        )}
                        {importPending && <span className="mt-1 flex items-center gap-1 text-[11px] text-approval"><FileWarning className="size-3" aria-hidden /> Shops pending</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(p.assignedAt)}</td>
                      <td className={cn("whitespace-nowrap px-4 py-3", overdue ? "font-semibold text-loss" : "text-muted-foreground")}>{overdue && <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />}{formatDate(p.targetDate)}</td>
                      <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", PRIORITY_CLASS[p.priority])}>{PRIORITY_LABEL[p.priority]}</span></td>
                      <td className="px-4 py-3"><Badge tone={STATUS_META[p.status]?.tone ?? "neutral"}>{OPS_STAGE_LABEL[p.status] ?? STATUS_META[p.status]?.label ?? p.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {target === "projects" && (
                            <>
                              <Button size="icon" variant="ghost" aria-label={`Cost comparison for ${p.code}`} title="Cost comparison" onClick={() => open(p, "cost")}><BarChart3 className="size-4" aria-hidden /></Button>
                              <Button size="icon" variant="ghost" aria-label={`Shop allocation for ${p.code}`} title="Shop allocation" onClick={() => open(p, "allocation")}><MapPin className="size-4" aria-hidden /></Button>
                              <Button size="icon" variant="ghost" aria-label={`Movement for ${p.code}`} title="Movement" onClick={() => open(p, "movement")}><Route className="size-4" aria-hidden /></Button>
                            </>
                          )}
                          <Button size="sm" className="bg-royal hover:bg-royal/90" onClick={() => open(p)} aria-label={`${t.cta} ${p.code}`}>{t.cta} <t.icon className="size-3.5" aria-hidden /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </section>
    </div>
  );
}
