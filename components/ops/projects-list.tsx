"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Eye, FileWarning, MapPin, Search, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { useProjects } from "@/lib/api/projects";
import { formatDate } from "@/lib/format";
import { OPS_STAGE_LABEL, totalExpected, PRIORITY_CLASS, PRIORITY_LABEL, STATUS_META, isOverdue, reqLabel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 9;
const STAGES = ["RECCE_ASSIGNED", "PLANNING", "IN_PROGRESS", "CLIENT_APPROVAL", "COMPLETED", "CANCELLED"];

/** Operations → Projects: every project assigned to this team as cards, with shop progress and a one-click View. */
export function OpsProjects({ target = "projects" }: { /** "allocation" opens each project in Shop Allocation instead of its details. */ target?: "projects" | "allocation" }) {
  const allocation = target === "allocation";
  const router = useRouter();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useProjects({ page, limit: PAGE_SIZE, assigned: "true", q: dq || undefined, status: status || undefined, sort: "-assignedAt" });
  const rows = list.data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader code={allocation ? "6" : "P"} title={allocation ? "Shop Allocation" : "Projects"} subtitle={allocation ? "Choose a project to give its shops to vendors or the in-house team" : "All projects assigned to Operations — open one to see its overview, documents and shops"} />
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by project code, client, district…" className="pl-9" aria-label="Search projects" />
          </div>
          <div className="w-48">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by stage">
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{OPS_STAGE_LABEL[s] ?? STATUS_META[s]?.label ?? s}</option>)}
            </Select>
          </div>
        </div>
      </div>

      {list.isPending ? (
        <RowsSkeleton rows={6} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No projects found" description="Projects assigned by BD will show up here." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const aso = p.requirementType === "ASO";
            const pct = !aso && totalExpected(p) ? Math.min(100, Math.round((p.siteCount / totalExpected(p)) * 100)) : 0;
            const overdue = isOverdue(p);
            return (
              <li key={p._id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft transition-shadow hover:shadow-card">
                <div className="flex items-start justify-between gap-2 bg-gradient-to-r from-navy to-royal px-4 py-3 text-white">
                  <div className="min-w-0">
                    <p className="text-xs opacity-80">{p.code}</p>
                    <p className="truncate font-semibold">{p.client?.name}</p>
                  </div>
                  <Badge tone={STATUS_META[p.status]?.tone ?? "neutral"}>{OPS_STAGE_LABEL[p.status] ?? STATUS_META[p.status]?.label ?? p.status}</Badge>
                </div>
                <div className="flex-1 space-y-3 p-4 text-sm">
                  <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{p.district || "-"}</span>
                    <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-xs font-medium text-royal">{reqLabel(p.requirementType)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", PRIORITY_CLASS[p.priority])}>{PRIORITY_LABEL[p.priority]}</span>
                  </p>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground"><Store className="size-3.5" aria-hidden />Shops</span>
                      <span className="font-semibold tabular-nums text-navy">{aso ? "Unknown (survey)" : `${p.siteCount} / ${totalExpected(p) || "-"}`}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Shops imported">
                      <div className="h-full rounded-full bg-finance" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Assigned {formatDate(p.assignedAt)}</span>
                    <span className={cn("flex items-center gap-1", overdue && "font-semibold text-loss")}><CalendarDays className="size-3.5" aria-hidden />Due {formatDate(p.targetDate)}</span>
                  </div>
                  {!aso && p.siteCount === 0 && p.status !== "COMPLETED" && (
                    <p className="flex items-center gap-1.5 rounded-lg bg-[#fff7e6] px-2.5 py-1.5 text-xs text-approval"><FileWarning className="size-3.5" aria-hidden />Shop import pending</p>
                  )}
                </div>
                <div className="border-t border-border p-3">
                  <Button className="w-full bg-royal hover:bg-royal/90" onClick={() => router.push(`/operations/${allocation ? "allocation" : "projects"}/${p._id}`)} aria-label={`${allocation ? "Allocate shops of" : "View project"} ${p.code}`}>
                    {allocation ? <MapPin className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />} {allocation ? "Allocate shops" : "View project"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination meta={list.data?.meta} onPage={setPage} />
    </div>
  );
}
