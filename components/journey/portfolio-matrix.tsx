"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Eye, FilterX, FolderKanban, Layers, PauseCircle, Search, Timer } from "lucide-react";
import { STATE_META } from "@/components/journey/stage-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { usePortfolio, type PortfolioMeta } from "@/lib/api/journey";
import { formatDate } from "@/lib/format";
import { STATUS_META as PROJECT_STATUS } from "@/lib/pipeline";

/** Project Portfolio Matrix: every project against every stage, with filters. Opens a project's journey. */
export function PortfolioMatrix() {
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const list = usePortfolio({ page, limit: 10, q: dq, status, overdue: overdue || undefined });
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta as PortfolioMeta | undefined;
  const sum = meta?.summary;
  const filtered = !!(dq || status || overdue);
  const reset = () => (setQ(""), setStatus(""), setOverdue(false), setPage(1));

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader icon={Layers} title="Project Monitoring" subtitle="Every project across every client, stage by stage." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="All Projects" value={sum?.total} icon={FolderKanban} color="blue" loading={!sum} />
        <KpiCard label="In Progress" value={sum ? sum.recceAssigned + sum.planning + sum.inProgress : undefined} icon={Timer} color="teal" delay={0.04} loading={!sum} />
        <KpiCard label="Client Approval" value={sum?.clientApproval} icon={CheckCircle2} color="orange" delay={0.08} loading={!sum} />
        <KpiCard label="On Hold / Closed" value={sum?.halted} icon={PauseCircle} color="purple" delay={0.12} loading={!sum} />
        <KpiCard label="Overdue" value={sum?.overdue} icon={AlertTriangle} color="red" delay={0.16} loading={!sum} onClick={() => (setOverdue(!overdue), setPage(1))} active={overdue} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search projects" placeholder="Search project code, name or client" className="pl-9" maxLength={60} value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </div>
          <div className="w-52">
            <Select aria-label="Filter by status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
              <option value="">All statuses</option>
              {["RECCE_ASSIGNED", "PLANNING", "IN_PROGRESS", "CLIENT_APPROVAL", "COMPLETED", "ON_HOLD", "CANCELLED"].map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS[s]?.label ?? s}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="outline" disabled={!filtered} onClick={reset}>
            <FilterX className="size-4" aria-hidden /> Clear
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[380px] flex-1 flex-col overflow-hidden">
        <GradientHeader
          title="Portfolio Matrix"
          right={
            <span className="hidden items-center gap-3 text-[11px] text-white/85 md:flex">
              {(["COMPLETED", "IN_PROGRESS", "PENDING", "BLOCKED"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full ring-1 ring-white/60" style={{ background: STATE_META[s].color }} /> {STATE_META[s].label}
                </span>
              ))}
            </span>
          }
        />
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FolderKanban} title={filtered ? "No projects match your filters" : "No projects yet"} description={filtered ? "Try a different search or status." : "Projects appear here once they are created."} />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  {meta!.stages.map((s) => (
                    <th key={s.key} className="px-1 py-3 text-center" title={s.label}>
                      <span className="block max-w-14 text-[10px] leading-tight">{s.label}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3 text-right">Journey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p, i) => {
                  const st = PROJECT_STATUS[p.status];
                  return (
                    <motion.tr key={p._id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/projects/${p._id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                          {p.code}
                        </Link>
                        <span className="block font-medium">{p.client.name}</span>
                        <span className="block text-xs text-muted-foreground">{[p.name, p.assignedTo && `Recce: ${p.assignedTo}`].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={st?.tone ?? "neutral"}>{st?.label ?? p.status}</Badge>
                        {p.overdue && <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-danger"><AlertTriangle className="size-3" aria-hidden /> Overdue</span>}
                      </td>
                      {p.states.map((s, k) => (
                        <td key={k} className="px-1 py-3 text-center">
                          <span className="inline-block size-3.5 rounded-full" style={{ background: STATE_META[s].color, opacity: s === "PENDING" || s === "NOT_APPLICABLE" ? 0.35 : 1 }} title={`${meta!.stages[k]!.label}: ${STATE_META[s].label}`} />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-muted-foreground">{p.targetDate ? formatDate(p.targetDate) : "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/projects/${p._id}`} aria-label={`Open journey of ${p.code}`}>
                              <Eye className="size-4" aria-hidden /> Open
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!list.isError && rows.length > 0 && <Pagination meta={meta} onPage={setPage} />}
      </Card>
    </div>
  );
}
