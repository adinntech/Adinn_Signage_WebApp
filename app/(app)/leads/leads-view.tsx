"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Ban, FilterX, Hourglass, Network, Plus, Search, Waypoints } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { STAGE_META } from "@/components/leads/stage-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { LEAD_STAGES, useLeads, useLeadSummary, type LeadStage } from "@/lib/api/leads";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Lead Management list: every lead with its current mind map stage. Opening one shows its mind map. */
export function LeadsView() {
  const { can } = useAuth();
  const canWrite = can("sales:write");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<LeadStage | "">("");
  const [status, setStatus] = useState("OPEN");
  const [clientType, setClientType] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useLeads({ page, limit: 20, q: dq, stage, status, clientType });
  const summary = useLeadSummary();
  const rows = list.data?.data ?? [];
  const filtered = !!(dq || stage || clientType || status !== "OPEN");
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const newButton = canWrite && (
    <Button variant="brand" size="lg" asChild>
      <Link href="/leads/new">
        <Plus className="size-4" aria-hidden /> New Lead
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader icon={Waypoints} title="Lead Management" subtitle="Every lead from first approach to client rate approval, shown as a mind map." actions={newButton} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Open Leads" value={summary.data?.open} icon={Network} color="blue" loading={summary.isPending} active={status === "OPEN" && !stage} onClick={() => reset(() => (setStatus("OPEN"), setStage("")))} />
        {LEAD_STAGES.map((s, i) => (
          <KpiCard
            key={s}
            label={STAGE_META[s].short}
            value={summary.data?.stages[s]}
            icon={STAGE_META[s].icon}
            color={STAGE_META[s].kpi}
            loading={summary.isPending}
            delay={0.04 * (i + 1)}
            active={stage === s}
            onClick={() => reset(() => (setStage(stage === s ? "" : s), setStatus("OPEN")))}
          />
        ))}
        <KpiCard label="Completed" value={summary.data?.completed} icon={BadgeCheck} color="green" loading={summary.isPending} active={status === "COMPLETED"} onClick={() => reset(() => (setStatus("COMPLETED"), setStage("")))} />
        <KpiCard label="Closed" value={summary.data?.closed} icon={Ban} color="red" loading={summary.isPending} active={status === "CLOSED"} onClick={() => reset(() => (setStatus("CLOSED"), setStage("")))} />
      </div>
      {!!summary.data?.waiting && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Hourglass className="size-3.5" aria-hidden /> {summary.data.waiting} order{summary.data.waiting === 1 ? "" : "s"} not taken up as a lead yet. Start one with New Lead.
        </p>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search leads" placeholder="Search order no, company name, client name or Client ID" className="pl-9" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
          </div>
          <div className="w-52">
            <Select aria-label="Filter by stage" value={stage} onChange={(e) => reset(() => setStage(e.target.value as LeadStage | ""))}>
              <option value="">All Stages</option>
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select aria-label="Filter by status" value={status} onChange={(e) => reset(() => setStatus(e.target.value))}>
              <option value="OPEN">Open</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
              <option value="">All</option>
            </Select>
          </div>
          <div className="w-44">
            <Select aria-label="Filter by client flag" value={clientType} onChange={(e) => reset(() => setClientType(e.target.value))}>
              <option value="">All Client Flags</option>
              <option value="NEW">New Client</option>
              <option value="EXISTING">Existing Client</option>
            </Select>
          </div>
          <Button variant="outline" disabled={!filtered && !q} onClick={() => reset(() => (setQ(""), setStage(""), setStatus("OPEN"), setClientType("")))}>
            <FilterX className="size-4" aria-hidden /> Clear Filters
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[360px] flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Leads</h2>
          {list.data && <span className="text-xs text-muted-foreground">{list.data.meta.total} records</span>}
        </div>
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Waypoints}
            title={filtered ? "No leads match your filters" : "No leads yet"}
            description={filtered ? "Try a different search or filter." : "Start a lead from an order: select the order in New Lead and the mind map takes it from there."}
            action={!filtered ? newButton : undefined}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order No</th>
                  <th className="px-4 py-3">Client Company</th>
                  <th className="px-4 py-3">Client Flag</th>
                  <th className="px-4 py-3">Current Stage</th>
                  <th className="px-4 py-3">BD</th>
                  <th className="px-4 py-3">Client Servicing</th>
                  <th className="px-4 py-3">Last Moved</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((l, i) => {
                  const m = STAGE_META[l.lead.stage];
                  const closed = l.lead.status === "CLOSED";
                  return (
                    <motion.tr key={l._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        <Link href={`/leads/${l._id}`} className="text-brand hover:underline">
                          {l.orderNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{l.client?.name ?? "-"}</span>
                        <span className="block text-xs text-muted-foreground">{[l.client?.clientName, l.client?.clientNo, l.client?.city].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-4 py-3">
                        <ClientTypeBadge type={l.clientType} full />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: m.soft, color: m.color }}>
                            <m.icon className="size-3.5" aria-hidden /> {m.short}
                          </span>
                          {closed && <Badge tone="danger">Closed</Badge>}
                          {l.lead.status === "COMPLETED" && <Badge tone="success">Completed</Badge>}
                        </span>
                        <span className="mt-1.5 flex gap-1" aria-label={`Stage ${l.stageNumber} of ${l.stageCount}`}>
                          {Array.from({ length: l.stageCount }).map((_, k) => (
                            <span key={k} className={cn("h-1.5 w-5 rounded-full", k < l.stageNumber - 1 ? "bg-success" : k === l.stageNumber - 1 ? "" : "bg-border")} style={k === l.stageNumber - 1 ? { background: m.color } : undefined} />
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-3">{l.owner?.name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                      <td className="px-4 py-3">{l.csAssignee?.name ?? <span className="text-muted-foreground">Not assigned</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(l.lead.stageChangedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/leads/${l._id}`} aria-label={`Open lead ${l.orderNo}`}>
                              <Waypoints className="size-4" aria-hidden /> Mind Map
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
        {!list.isError && rows.length > 0 && <Pagination meta={list.data?.meta} onPage={setPage} />}
      </Card>
    </div>
  );
}
