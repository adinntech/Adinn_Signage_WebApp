"use client";

import { useState } from "react";
import Link from "next/link";
import { FileCheck2, FilterX, Search } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { useOrders } from "@/lib/api/sales";
import { formatDate } from "@/lib/format";

/** Code Requests: pick one of your orders and open its Code Request Hub. */
export function CodeOrders() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const list = useOrders({ page, limit: 10, q: dq, sort: "-handover.assignedAt" });
  const rows = list.data?.data ?? [];

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader icon={FileCheck2} title="Code Requests" subtitle="Choose an order to request or confirm its client code and project code." />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search orders" placeholder="Search order no, company name or Client ID" className="pl-9" maxLength={60} value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </div>
          <Button variant="outline" disabled={!q} onClick={() => (setQ(""), setPage(1))}>
            <FilterX className="size-4" aria-hidden /> Clear
          </Button>
        </div>
      </Card>
      <Card className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
        <GradientHeader title="My Orders" right={list.data && <span className="text-xs text-white/80">{list.data.meta.total} records</span>} />
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FileCheck2} title={dq ? "No orders match your search" : "No orders assigned to you yet"} description="Orders appear here when the BD team hands them over to you." />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order No</th>
                  <th className="px-4 py-3">Client Company</th>
                  <th className="px-4 py-3">Flag</th>
                  <th className="px-4 py-3">Assigned On</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((o) => (
                  <tr key={o._id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">{o.orderNo}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{o.client?.name ?? "-"}</span>
                      <span className="block text-xs text-muted-foreground">{[o.client?.clientNo, o.client?.city].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ClientTypeBadge type={o.clientType} full />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.handover?.assignedAt ?? o.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="brand" asChild>
                        <Link href={`/client-servicing/codes/${o._id}`}>
                          <FileCheck2 className="size-4" aria-hidden /> Code Hub
                        </Link>
                      </Button>
                    </td>
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
