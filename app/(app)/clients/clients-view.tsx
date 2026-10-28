"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Building2, Eye, FileClock, FilterX, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { primaryContact, useClientSummary, useClients, useDeactivateClient, type Client } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ClientsView() {
  const { can } = useAuth();
  const canWrite = can("clients:write") && can("sales:write");
  const toast = useToast();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  // Drafts: Add Client forms saved part-way, listed apart from the clients (they have no Client ID yet).
  const [drafts, setDrafts] = useState(false);
  const [discard, setDiscard] = useState<Client | null>(null);
  const remove = useDeactivateClient();
  const dq = useDebounced(q);
  const list = useClients({ page, limit: 20, q: dq, sort: drafts ? "-updatedAt" : "-createdAt", ...(drafts ? { status: "DRAFT" } : {}) });
  const summary = useClientSummary();
  const showDrafts = (on: boolean) => {
    setDrafts(on);
    setPage(1);
  };

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
              placeholder="Search company name, client ID, email, phone or GST number"
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
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5">
          <div role="tablist" aria-label="Client list" className="inline-flex rounded-lg bg-muted p-1">
            {[
              { on: false, label: "All Clients" },
              { on: true, label: `Drafts${summary.data?.draftClients ? ` (${summary.data.draftClients})` : ""}` },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={drafts === t.on}
                onClick={() => showDrafts(t.on)}
                className={cn("rounded-md px-3 py-1.5 text-sm font-semibold transition-colors", drafts === t.on ? "bg-surface text-primary shadow-soft" : "text-muted-foreground hover:text-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>
          {list.data && <span className="text-xs text-muted-foreground">{list.data.meta.total} records</span>}
        </div>
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          drafts ? (
            <EmptyState
              icon={FileClock}
              title={filtered ? "No drafts match your search" : "No drafts"}
              description="Use Save Draft on Add Client to keep an incomplete client and finish it later."
            />
          ) : (
            <EmptyState
              icon={Building2}
              title={filtered ? "No clients match your search" : "No clients yet"}
              description={filtered ? "Try a different search." : "Register your first client, then create its orders in Order Management."}
              action={!filtered ? addButton : undefined}
            />
          )
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Client ID</th>
                  <th className="px-4 py-3">Company Name</th>
                  <th className="px-4 py-3">Company Email</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">GST Number</th>
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
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">{c.status === "DRAFT" ? <Badge tone="warning">Draft</Badge> : (c.clientNo ?? c.code)}</td>
                      <td className="px-4 py-3 font-medium">
                        {c.status === "DRAFT" ? (
                          <span className={cn(!c.name && "italic text-muted-foreground")}>{c.name || "Untitled draft"}</span>
                        ) : (
                          <Link href={`/clients/${c._id}`} className="hover:text-brand hover:underline">
                            {c.name}
                          </Link>
                        )}
                        {c.clientName && <span className="block text-xs font-normal text-muted-foreground">{c.clientName}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email ?? "-"}</td>
                      {/* Older clients have no company phone yet: fall back to the primary contact's mobile. */}
                      <td className="px-4 py-3 tabular-nums">{c.phone ?? (p?.phone ? `+91 ${p.phone}` : "-")}</td>
                      <td className="px-4 py-3 font-mono text-xs">{c.gstin ?? "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.status === "DRAFT" ? `Saved ${formatDate(c.updatedAt)}` : formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        {c.status === "DRAFT" ? (
                          <div className="flex justify-end gap-1">
                            {canWrite && (
                              <>
                                <Button variant="brand-outline" size="sm" asChild>
                                  <Link href={`/clients/new?draft=${c._id}`} aria-label={`Resume draft ${c.name || "untitled"}`}>
                                    <Pencil className="size-4" aria-hidden /> Resume Draft
                                  </Link>
                                </Button>
                                <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setDiscard(c)} aria-label={`Delete draft ${c.name || "untitled"}`}>
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </>
                            )}
                          </div>
                        ) : (
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
                        )}
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
      <ConfirmDialog
        open={!!discard}
        onOpenChange={(o) => !o && setDiscard(null)}
        title={`Delete the draft${discard?.name ? ` "${discard.name}"` : ""}?`}
        confirmLabel="Delete Draft"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutateAsync(discard!._id).then(
            () => {
              toast("Draft deleted");
              setDiscard(null);
            },
            (e) => toast(errorMessage(e), "error"),
          )
        }
      >
        <p className="text-sm text-muted-foreground">The draft and its uploaded GST certificate are removed. This cannot be undone.</p>
      </ConfirmDialog>
    </div>
  );
}
