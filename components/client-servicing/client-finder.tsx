"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, Eye, FilterX, Search } from "lucide-react";
import { duplicateKeys } from "@/components/clients/client-lookup";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import { clientTypeOf, useClients } from "@/lib/api/clients";

/** Client Finder: search the client master and open a client's profile. */
export function ClientFinder() {
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const [clientType, setClientType] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const list = useClients({ page, limit: 10, q: dq, clientType, status: "ACTIVE", sort: "name" });
  const rows = list.data?.data ?? [];
  const dups = duplicateKeys(rows);
  const filtered = !!(dq || clientType);

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader icon={Search} title="Client Finder" subtitle="Search by client ID, company name, GST number, PAN or contact." />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search clients"
              placeholder="Search client ID, company, GST, PAN, phone or contact"
              className="pl-9"
              maxLength={60}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-48">
            <Select
              aria-label="Filter by client flag"
              value={clientType}
              onChange={(e) => {
                setClientType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Client Flags</option>
              <option value="NEW">New Client</option>
              <option value="EXISTING">Existing Client</option>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={!q && !clientType}
            onClick={() => {
              setQ("");
              setClientType("");
              setPage(1);
            }}
          >
            <FilterX className="size-4" aria-hidden /> Clear Filters
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[380px] flex-1 flex-col overflow-hidden">
        <GradientHeader title="Clients" right={list.data && <span className="text-xs text-white/80">{list.data.meta.total} records</span>} />
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={filtered ? "No clients match your search" : "No clients yet"}
            description={filtered ? "Check the spelling or try the GST number or PAN." : "Clients registered by BD appear here."}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Client ID</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">GST Number</th>
                  <th className="px-4 py-3">PAN</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Flag</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c, i) => (
                  <motion.tr
                    key={c._id}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      <Link href={`/client-servicing/clients/${c._id}`} className="text-brand hover:underline">
                        {c.clientNo ?? c.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{[c.clientName, c.city].filter(Boolean).join(" · ")}</span>
                      {dups.has(c._id) && (
                        <Badge tone="warning" className="mt-1">
                          Possible duplicate (same GST / PAN)
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.gstin ?? "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.onboarding?.pan ?? "-"}</td>
                    <td className="px-4 py-3 tabular-nums">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3">
                      <ClientTypeBadge type={clientTypeOf(c)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/client-servicing/clients/${c._id}`} aria-label={`View ${c.name}`}>
                            <Eye className="size-4" aria-hidden /> View
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
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
