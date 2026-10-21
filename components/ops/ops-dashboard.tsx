"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, Eye, FileWarning, Loader, Map, PlayCircle, Search, ThumbsUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { SortHeader, nextSort, type SortState } from "@/components/ui/sort-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { useClientOptions } from "@/lib/api/clients";
import { useAdvanceStage } from "@/lib/api/pipeline";
import { REQUIREMENT_TYPES, useProjects, useProjectSummary, type Project } from "@/lib/api/projects";
import { formatDate } from "@/lib/format";
import { OPS_STAGE_LABEL, PRIORITY_CLASS, PRIORITY_LABEL, STATUS_META, isOverdue, reqLabel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { NotificationsPanel } from "./notifications-panel";

const PAGE_SIZE = 8;
type TabKey = "RECCE_ASSIGNED" | "PLANNING" | "IN_PROGRESS" | "CLIENT_APPROVAL" | "COMPLETED" | "OVERDUE" | "ALL";
const TABS: { key: TabKey; label: string }[] = [
  { key: "RECCE_ASSIGNED", label: "New Assigned" },
  { key: "PLANNING", label: "In Planning" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "CLIENT_APPROVAL", label: "Pending Approval" },
  { key: "COMPLETED", label: "Completed" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "ALL", label: "All" },
];
type SortKey = "code" | "name" | "district" | "expectedShops" | "assignedAt" | "targetDate" | "priority";

export function OpsDashboard() {
  const router = useRouter();
  const toast = useToast();
  const advance = useAdvanceStage();
  const summary = useProjectSummary();
  const clients = useClientOptions();

  const [tab, setTab] = useState<TabKey>("RECCE_ASSIGNED");
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
  const count = (k: TabKey) => (k === "ALL" ? undefined : k === "OVERDUE" ? summary.data?.overdue : by[k]);
  const allAssigned = ["RECCE_ASSIGNED", "PLANNING", "IN_PROGRESS", "CLIENT_APPROVAL", "COMPLETED"].reduce((a, s) => a + (by[s] ?? 0), 0);
  const show = (n: number | undefined) => (summary.data ? (n ?? 0) : "–");

  const rows = list.data?.data ?? [];
  const filtered = !!(dq || clientId || req);
  const open = (p: Project) => router.push(`/operations/projects/${p._id}`);
  const startPlanning = (p: Project) =>
    advance.mutate(
      { id: p._id, stage: "PLANNING" },
      {
        onSuccess: () => {
          toast(`Planning started for ${p.code}`);
          open(p);
        },
        onError: (e) => toast(errorMessage(e), "error"),
      },
    );
  const pickTab = (t: TabKey) => {
    setTab(t);
    setPage(1);
  };
  const onSort = (k: SortKey) => {
    setSort((s) => nextSort(s, k));
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader code="B" title="Operations / Coordinator" subtitle="Receive assigned tasks from BD and plan the recce" />
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="New Assigned" value={show(count("RECCE_ASSIGNED"))} icon={ClipboardList} color="blue" active={tab === "RECCE_ASSIGNED"} onClick={() => pickTab("RECCE_ASSIGNED")} />
          <KpiCard label="In Planning" value={show(count("PLANNING"))} icon={Map} color="teal" delay={0.04} active={tab === "PLANNING"} onClick={() => pickTab("PLANNING")} />
          <KpiCard label="In Progress" value={show(count("IN_PROGRESS"))} icon={Loader} color="orange" delay={0.08} active={tab === "IN_PROGRESS"} onClick={() => pickTab("IN_PROGRESS")} />
          <KpiCard label="Pending Approval" value={show(count("CLIENT_APPROVAL"))} icon={ThumbsUp} color="purple" delay={0.12} active={tab === "CLIENT_APPROVAL"} onClick={() => pickTab("CLIENT_APPROVAL")} />
          <KpiCard label="Completed" value={show(count("COMPLETED"))} icon={CheckCircle2} color="green" delay={0.16} active={tab === "COMPLETED"} onClick={() => pickTab("COMPLETED")} />
          <KpiCard label="Overdue" value={show(count("OVERDUE"))} icon={AlertTriangle} color="red" delay={0.2} active={tab === "OVERDUE"} onClick={() => pickTab("OVERDUE")} />
        </div>
        {summary.isError && <p role="alert" className="px-4 pb-3 text-xs text-danger">Could not load the counts. <button type="button" className="underline" onClick={() => summary.refetch()}>Retry</button></p>}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <div role="tablist" aria-label="Task stage" className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => pickTab(t.key)}
                className={cn("whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-medium transition-colors", tab === t.key ? "border-royal text-royal" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {t.label}{" "}
                <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-xs", tab === t.key ? "bg-royal/10" : "bg-muted")}>{t.key === "ALL" ? show(allAssigned) : show(count(t.key))}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by project code, client, district…" className="pl-9" aria-label="Search projects" />
            </div>
            <div className="w-40">
              <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }} aria-label="Filter by client">
                <option value="">All Clients</option>
                {clients.data?.data.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="w-48">
              <Select value={req} onChange={(e) => { setReq(e.target.value); setPage(1); }} aria-label="Filter by requirement type">
                <option value="">All Requirement Types</option>
                {REQUIREMENT_TYPES.map((r) => <option key={r} value={r}>{reqLabel(r)}</option>)}
              </Select>
            </div>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); setClientId(""); setReq(""); setPage(1); }}>
                <X className="size-4" aria-hidden /> Clear
              </Button>
            )}
          </div>

          <div className="max-h-[560px] min-h-0 overflow-auto">
            {list.isPending ? (
              <RowsSkeleton rows={6} className="p-4" />
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : (
              <table className="w-full min-w-[980px] text-sm">
                <thead className="sticky top-0 z-10 bg-[#eef4ff] text-xs uppercase tracking-wide text-navy">
                  <tr>
                    <SortHeader col="code" label="Project Code" sort={sort} onSort={onSort} />
                    <SortHeader col="name" label="Client" sort={sort} onSort={onSort} />
                    <SortHeader col="district" label="District" sort={sort} onSort={onSort} />
                    <SortHeader col="expectedShops" label="Shops" sort={sort} onSort={onSort} className="text-right" />
                    <SortHeader col="assignedAt" label="Assigned" sort={sort} onSort={onSort} />
                    <SortHeader col="targetDate" label="Due Date" sort={sort} onSort={onSort} />
                    <SortHeader col="priority" label="Priority" sort={sort} onSort={onSort} />
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((p) => {
                    const overdue = isOverdue(p);
                    const importPending = p.requirementType !== "ASO" && p.siteCount === 0 && p.status !== "COMPLETED";
                    return (
                      <tr key={p._id} onClick={() => open(p)} className="cursor-pointer hover:bg-[#f4f8ff]">
                        <td className="px-4 py-3 font-semibold tabular-nums text-navy">{p.code}</td>
                        <td className="px-4 py-3 font-medium">
                          {p.client?.name}
                          <span className="block text-xs font-normal text-muted-foreground">{reqLabel(p.requirementType)}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.district}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {p.requirementType === "ASO" ? <span className="text-xs text-muted-foreground">Unknown</span> : <>{p.siteCount}<span className="text-xs text-muted-foreground"> / {p.expectedShops ?? "-"}</span></>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(p.assignedAt)}</td>
                        <td className={cn("whitespace-nowrap px-4 py-3", overdue ? "font-semibold text-loss" : "text-muted-foreground")}>{formatDate(p.targetDate)}</td>
                        <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", PRIORITY_CLASS[p.priority])}>{PRIORITY_LABEL[p.priority]}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={STATUS_META[p.status]?.tone ?? "neutral"}>{OPS_STAGE_LABEL[p.status] ?? STATUS_META[p.status]?.label ?? p.status}</Badge>
                            {overdue && <Badge tone="danger">Overdue</Badge>}
                            {importPending && <Badge tone="neutral"><FileWarning className="size-3" aria-hidden />Import pending</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {p.status === "RECCE_ASSIGNED" && (
                              <Button size="sm" className="bg-approval hover:bg-approval/90" disabled={advance.isPending} onClick={(e) => { e.stopPropagation(); startPlanning(p); }}>
                                <PlayCircle className="size-3.5" aria-hidden /> Start Planning
                              </Button>
                            )}
                            <Button size="sm" className="bg-royal hover:bg-royal/90" onClick={(e) => { e.stopPropagation(); open(p); }} aria-label={`View project ${p.code}`}>
                              <Eye className="size-3.5" aria-hidden /> View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {list.isSuccess && rows.length === 0 && (
              <EmptyState
                title={filtered ? "No tasks match your filters" : allAssigned === 0 ? "No tasks assigned yet" : "Nothing in this stage"}
                description={allAssigned === 0 ? "Projects assigned by BD will show up here." : "Switch tab or clear filters to see other tasks."}
              />
            )}
          </div>
          <Pagination meta={list.data?.meta} onPage={setPage} />
        </section>

        <NotificationsPanel />
      </div>
    </div>
  );
}
