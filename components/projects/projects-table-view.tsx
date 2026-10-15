"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, FolderKanban, Plus, Search } from "lucide-react";
import { ClientSelect } from "@/components/pickers";
import { PriorityBadge, StatusBadge } from "@/components/projects/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { PRIORITIES, PROJECT_STATUSES, useProjects } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNumber, label } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMNS: { key: string; label: string; sort?: string }[] = [
  { key: "code", label: "Code", sort: "code" },
  { key: "name", label: "Project", sort: "name" },
  { key: "client", label: "Client" },
  { key: "campaign", label: "Campaign" },
  { key: "status", label: "Status", sort: "status" },
  { key: "priority", label: "Priority", sort: "priority" },
  { key: "targetDate", label: "Target date", sort: "targetDate" },
  { key: "owner", label: "Owner" },
  { key: "sites", label: "Sites" },
];

export function ProjectsTableView({
  title,
  subtitle,
  fixedStatus,
}: {
  title: string;
  subtitle: string;
  /** When set, the status filter is locked (e.g. Recce requests = NEW). */
  fixedStatus?: string;
}) {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [clientId, setClientId] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useProjects({ page, limit: 25, q: dq, status: fixedStatus ?? status, priority, clientId, sort });
  const rows = list.data?.data ?? [];
  const filtered = !!(dq || status || priority || clientId);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const toggleSort = (field: string) => reset(() => setSort((s) => (s === field ? `-${field}` : field)));

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {can("projects:write") && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" aria-hidden /> New project
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search projects"
            placeholder="Search code, name, campaign"
            className="pl-9"
            value={q}
            onChange={(e) => reset(() => setQ(e.target.value))}
          />
        </div>
        {!fixedStatus && (
          <div className="w-40">
            <Select aria-label="Filter by status" value={status} onChange={(e) => reset(() => setStatus(e.target.value))}>
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="w-40">
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => reset(() => setPriority(e.target.value))}>
            <option value="">All priorities</option>
            {PRIORITIES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </Select>
        </div>
        {can("clients:read") && (
          <div className="w-52">
            <ClientSelect
              aria-label="Filter by client"
              placeholder="All clients"
              value={clientId}
              onChange={(e) => reset(() => setClientId(e.target.value))}
            />
          </div>
        )}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={filtered ? "No projects match your filters" : fixedStatus ? "No new requests" : "No projects yet"}
            description={
              filtered
                ? "Try clearing a filter."
                : fixedStatus
                  ? "New project requests will appear here."
                  : "Create a project from a client requirement."
            }
            action={
              !filtered && !fixedStatus && can("projects:write") ? (
                <Button asChild>
                  <Link href="/projects/new">
                    <Plus className="size-4" aria-hidden /> New project
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {COLUMNS.map((c) => {
                    const active = sort.replace(/^-/, "") === c.sort;
                    return (
                      <th
                        key={c.key}
                        className="px-4 py-2.5 font-medium"
                        aria-sort={active ? (sort.startsWith("-") ? "descending" : "ascending") : undefined}
                      >
                        {c.sort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.sort!)}
                            className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")}
                          >
                            {c.label}
                            {active && (sort.startsWith("-") ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p._id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/projects/${p._id}`} className="font-medium text-primary hover:underline">
                        {p.code}
                      </Link>
                    </td>
                    <td className="max-w-64 truncate px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.client?.name ?? "-"}</td>
                    <td className="px-4 py-3">{p.campaign ?? "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={p.priority} />
                    </td>
                    <td className="px-4 py-3">{formatDate(p.targetDate)}</td>
                    <td className="px-4 py-3">{p.owner?.name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(p.siteCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!list.isError && rows.length > 0 && <Pagination meta={list.data?.meta} onPage={setPage} />}
      </Card>
    </div>
  );
}
