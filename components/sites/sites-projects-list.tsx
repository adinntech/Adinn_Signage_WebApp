"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { StatusBadge } from "@/components/projects/badges";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { useProjects } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";

/** Sites are managed per project: this lists projects with their site counts and links into each project's Sites tab. */
export function SitesProjectsList() {
  const { can } = useAuth();
  const allowed = can("projects:read");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const dq = useDebounced(q.trim());
  const list = useProjects({ page, limit: 25, q: dq, sort: "-createdAt" }, allowed);
  const rows = list.data?.data ?? [];

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Sites</h1>
        <p className="text-sm text-muted-foreground">Site master data lives inside each project. Pick a project to view, import and edit its sites.</p>
      </div>
      {allowed && (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search projects"
            placeholder="Search code, name, campaign"
            className="pl-9"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!allowed ? (
          <EmptyState icon={MapPin} title="Project access required" description="Ask an administrator for access to projects to browse their sites." />
        ) : list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={MapPin} title={dq ? "No projects match your search" : "No projects yet"} description="Sites are added to a project once it exists." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sites</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p._id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p._id}?tab=sites`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                    </td>
                    <td className="px-4 py-3">{p.client?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(p.siteCount)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/projects/${p._id}?tab=sites`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Open sites <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {allowed && !list.isError && rows.length > 0 && <Pagination meta={list.data?.meta} onPage={setPage} />}
      </Card>
    </div>
  );
}
