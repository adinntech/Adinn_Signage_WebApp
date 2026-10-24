"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Building2, Eye, FilterX, Pencil, Plus, Search, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { primaryContact, useClientSummary, useClients } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export function ClientsView() {
  const { can } = useAuth();
  const canWrite = can("clients:write") && can("sales:write");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useClients({ page, limit: 20, q: dq, sort: "-createdAt" });
  const summary = useClientSummary();

  const rows = list.data?.data ?? [];
  const filtered = !!dq;
  const addButton = canWrite && (
    <Button variant="brand" size="lg" asChild>
      <Link href="/clients/new">
        <Plus className="size-4" aria-hidden /> Add Client
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader icon={Users} title="Client Management" subtitle="View and manage all your clients and their contact persons." actions={addButton} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Clients" value={summary.data?.totalClients} icon={Building2} color="var(--color-brand)" loading={summary.isPending} />
        <KpiCard label="Active Clients" value={summary.data?.activeClients} icon={BadgeCheck} color="var(--color-success)" loading={summary.isPending} />
        <KpiCard label="Added This Month" value={summary.data?.clientsThisMonth} icon={UserPlus} color="var(--color-warning)" loading={summary.isPending} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search clients"
              placeholder="Search company name, client ID, email, contact person or phone"
              className="pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button
            variant="outline"
            disabled={!filtered && !q}
            onClick={() => {
              setQ("");
              setPage(1);
            }}
          >
            <FilterX className="size-4" aria-hidden /> Clear Filters
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[380px] flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">All Clients</h2>
          {list.data && <span className="text-xs text-muted-foreground">{list.data.meta.total} records</span>}
        </div>
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={filtered ? "No clients match your search" : "No clients yet"}
            description={filtered ? "Try a different search." : "Register your first client, then create its orders in Order Management."}
            action={!filtered ? addButton : undefined}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Client ID</th>
                  <th className="px-4 py-3">Company Name</th>
                  <th className="px-4 py-3">Company Email</th>
                  <th className="px-4 py-3">Primary Contact</th>
                  <th className="px-4 py-3">Mobile Number</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c, i) => {
                  const p = primaryContact(c);
                  return (
                    <motion.tr
                      key={c._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="transition-colors hover:bg-muted/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">{c.clientNo ?? c.code}</td>
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/clients/${c._id}`} className="hover:text-brand hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email ?? "-"}</td>
                      <td className="px-4 py-3">{p?.name ?? "-"}</td>
                      <td className="px-4 py-3 tabular-nums">{p?.phone ? `+91 ${p.phone}` : "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.city ?? "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/clients/${c._id}`} aria-label={`View ${c.name}`}>
                              <Eye className="size-4" aria-hidden /> View
                            </Link>
                          </Button>
                          {canWrite && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/clients/${c._id}/edit`} aria-label={`Edit ${c.name}`}>
                                <Pencil className="size-4" aria-hidden /> Edit
                              </Link>
                            </Button>
                          )}
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
