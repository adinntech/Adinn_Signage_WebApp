"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, CheckCircle2, ClipboardList, Clock3, Eye, FileEdit, FolderKanban, Inbox, Loader, Pencil, Search, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { SortHeader, nextSort, type SortState } from "@/components/ui/sort-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { useClientOptions } from "@/lib/api/clients";
import { useRecentActivity } from "@/lib/api/pipeline";
import { useProject, useProjects, useProjectSummary, type Project } from "@/lib/api/projects";
import { formatDate, formatDateTime } from "@/lib/format";
import { STATUS_META } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { Tabs } from "@/components/ui/tabs";
import { ProjectDrawer } from "./project-drawer";
import { ProjectStatusBadge } from "./status-badge";

const PAGE_SIZE = 8;

type TabKey = "all" | "drafts" | "pending" | "assigned" | "progress" | "approval" | "completed" | "cancelled";
const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  { key: "all", label: "All Projects", statuses: [] },
  { key: "drafts", label: "Drafts", statuses: ["DRAFT"] },
  { key: "pending", label: "Recce Pending", statuses: ["ENQUIRY", "NEW"] },
  { key: "assigned", label: "Recce Assigned", statuses: ["RECCE_ASSIGNED", "PLANNING"] },
  { key: "progress", label: "In Progress", statuses: ["IN_PROGRESS"] },
  { key: "approval", label: "Client Approval", statuses: ["CLIENT_APPROVAL"] },
  { key: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

type SortKey = "code" | "name" | "expectedShops" | "startDate" | "targetDate" | "status";
const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "code", label: "Project Code" },
  { key: "name", label: "Client" },
  { key: null, label: "Campaign" },
  { key: "expectedShops", label: "Total Shops", className: "text-right" },
  { key: "startDate", label: "Start Date" },
  { key: "targetDate", label: "End Date" },
  { key: "status", label: "Status" },
];

export function BdDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const viewId = params.get("view");

  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "startDate", dir: "desc" });
  const [page, setPage] = useState(1);

  const summary = useProjectSummary();
  const clients = useClientOptions();
  const activity = useRecentActivity();
  const tabDef = TABS.find((t) => t.key === tab)!;
  const list = useProjects({
    page,
    limit: PAGE_SIZE,
    q: dq || undefined,
    clientId: clientId || undefined,
    status: status || undefined,
    statuses: !status && tabDef.statuses.length ? tabDef.statuses.join(",") : undefined,
    sort: `${sort.dir === "desc" ? "-" : ""}${sort.key}`,
  });
  const selected = useProject(viewId ?? "");

  const by = summary.data?.byStatus ?? {};
  const countOf = (statuses: string[]) => statuses.reduce((a, s) => a + (by[s] ?? 0), 0);
  const tabCount = (t: (typeof TABS)[number]) => (t.key === "all" ? (summary.data?.total ?? 0) : countOf(t.statuses));
  const total = (summary.data?.total ?? 0) - (by.CANCELLED ?? 0);

  const rows = list.data?.data ?? [];
  const filtered = !!(dq || clientId || status);
  /** A draft is unfinished work: clicking it resumes the form. Every other project opens its detail drawer. */
  const openProject = (p: Project) => (p.status === "DRAFT" ? router.push(`/bd/projects/new?edit=${p._id}`) : router.replace(`/bd/dashboard?view=${p._id}`, { scroll: false }));
  const draftCount = by.DRAFT ?? 0;
  const closeProject = () => router.replace("/bd/dashboard", { scroll: false });
  const pickTab = (t: TabKey) => {
    setTab(t);
    setStatus("");
    setPage(1);
  };
  const onSort = (k: SortKey) => {
    setSort((s) => nextSort(s, k));
    setPage(1);
  };
  const statusOptions = useMemo(() => Object.entries(STATUS_META).filter(([k]) => !["NEW", "ACTIVE"].includes(k)), []);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader
          code="A"
          title="BD / Client Servicing"
          subtitle="Projects dashboard · assign recce projects to Operations"
        />
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-7">
          <KpiCard label="Total Projects" value={summary.data ? total : "–"} icon={FolderKanban} color="blue" active={tab === "all"} onClick={() => pickTab("all")} />
          <KpiCard label="Enquiries" value={summary.data ? countOf(["ENQUIRY", "NEW"]) : "–"} icon={Inbox} color="rose" delay={0.04} active={tab === "pending"} onClick={() => pickTab("pending")} />
          <KpiCard label="Recce Assigned" value={summary.data ? countOf(["RECCE_ASSIGNED", "PLANNING"]) : "–"} icon={ClipboardList} color="teal" delay={0.08} active={tab === "assigned"} onClick={() => pickTab("assigned")} />
          <KpiCard label="In Progress" value={summary.data ? countOf(["IN_PROGRESS"]) : "–"} icon={Loader} color="green" delay={0.12} active={tab === "progress"} onClick={() => pickTab("progress")} />
          <KpiCard label="Awaiting Client Approval" value={summary.data ? countOf(["CLIENT_APPROVAL"]) : "–"} icon={ThumbsUp} color="orange" delay={0.16} active={tab === "approval"} onClick={() => pickTab("approval")} />
          <KpiCard label="Completed" value={summary.data ? countOf(["COMPLETED"]) : "–"} icon={CheckCircle2} color="purple" delay={0.2} active={tab === "completed"} onClick={() => pickTab("completed")} />
          <KpiCard label="Cancelled" value={summary.data ? countOf(["CANCELLED"]) : "–"} icon={Ban} color="red" delay={0.24} active={tab === "cancelled"} onClick={() => pickTab("cancelled")} />
        </div>
        {draftCount > 0 && tab !== "drafts" && (
          <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#ffd9a8] bg-[#fff6e8] px-3 py-2 text-sm text-approval">
            <FileEdit className="size-4" aria-hidden />
            <span className="flex-1">You have <strong>{draftCount}</strong> unfinished draft{draftCount > 1 ? "s" : ""}. Click a draft to continue it.</span>
            <Button size="sm" variant="outline" onClick={() => pickTab("drafts")}>View drafts</Button>
          </div>
        )}
        {summary.isError && <p role="alert" className="px-4 pb-3 text-xs text-danger">Could not load the counts. <button type="button" className="underline" onClick={() => summary.refetch()}>Retry</button></p>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <Tabs
            label="Project stage"
            className="border-b border-border pt-2"
            value={tab}
            onChange={(k) => pickTab(k as TabKey)}
            tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: summary.data ? tabCount(t) : "–" }))}
          />

          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by project code, client, campaign…" className="pl-9" aria-label="Search projects" />
            </div>
            <div className="w-40">
              <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }} aria-label="Filter by client">
                <option value="">All Clients</option>
                {clients.data?.data.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="w-44">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
                <option value="">All Status</option>
                {statusOptions.map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </Select>
            </div>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); setClientId(""); setStatus(""); setPage(1); }}>
                <X className="size-4" aria-hidden /> Clear
              </Button>
            )}
          </div>

          <div className={cn("max-h-[520px] min-h-0 overflow-auto transition-opacity duration-150", list.isFetching && !list.isPending && "opacity-60")} aria-busy={list.isFetching}>
            {list.isPending ? (
              <RowsSkeleton rows={6} className="p-4" />
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : (
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 z-10 bg-[#eef4ff] text-xs uppercase tracking-wide text-navy">
                  <tr>
                    {COLUMNS.map((c) =>
                      c.key ? (
                        <SortHeader key={c.key} col={c.key} label={c.label} sort={sort} onSort={onSort} className={c.className} />
                      ) : (
                        <th key={c.label} scope="col" className="px-4 py-3 text-left font-semibold">{c.label}</th>
                      ),
                    )}
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((p) => (
                    <tr key={p._id} onClick={() => openProject(p)} className="cursor-pointer hover:bg-[#f4f8ff]">
                      <td className="px-4 py-3 font-semibold tabular-nums text-navy">{p.code}</td>
                      <td className="px-4 py-3 font-medium">{p.client?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.campaign}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.expectedShops ?? <span className="text-xs text-muted-foreground">{p.requirementType === "ASO" ? "Unknown" : "-"}</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(p.startDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(p.targetDate)}</td>
                      <td className="px-4 py-3"><ProjectStatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className={p.status === "DRAFT" ? "bg-approval hover:bg-approval/90" : "bg-royal hover:bg-royal/90"} onClick={(e) => { e.stopPropagation(); openProject(p); }} aria-label={`${p.status === "DRAFT" ? "Resume draft" : "View project"} ${p.code}`}>
                          {p.status === "DRAFT" ? <><Pencil className="size-3.5" aria-hidden /> Resume</> : <><Eye className="size-3.5" aria-hidden /> View</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {list.isSuccess && rows.length === 0 && (
              <EmptyState
                title={tab === "drafts" && !filtered ? "No drafts" : filtered || tab !== "all" ? "No projects match your filters" : "No projects yet"}
                description={filtered || tab !== "all" ? "Try clearing the search or switching tab." : "Projects are created by Client Servicing once the client code and project code are confirmed."}
              />
            )}
          </div>
          <Pagination meta={list.data?.meta} onPage={setPage} />
        </section>

        <aside className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Clock3 className="size-4 text-royal" aria-hidden />
            <h2 className="text-sm font-semibold text-navy">Recent activity</h2>
          </div>
          {activity.isPending ? (
            <RowsSkeleton rows={4} className="p-4" />
          ) : activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => activity.refetch()} title="Could not load activity" />
          ) : activity.data.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ol className="max-h-[560px] space-y-4 overflow-y-auto p-4">
              {activity.data.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-royal" />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{a.text}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.code} · {a.client}</span>
                    <span className="block text-xs text-muted-foreground">{a.by} · {formatDateTime(a.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      <ProjectDrawer projectId={viewId} project={selected.data} loading={!!viewId && selected.isPending} error={selected.isError ? selected.error : null} onClose={closeProject} />
    </div>
  );
}
