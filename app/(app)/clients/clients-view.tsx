"use client";

import { useState } from "react";
import { Building2, Pencil, Plus, Power, Search } from "lucide-react";
import { ClientFormDrawer } from "@/components/clients/client-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { useClients, useDeactivateClient, type Client } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export function ClientsView() {
  const { can } = useAuth();
  const canWrite = can("clients:write");
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useClients({ page, limit: 25, q: dq, status, sort: "name" });
  const deactivate = useDeactivateClient();
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<Client | null>(null);

  const rows = list.data?.data ?? [];
  const filtered = !!(dq || status);

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Clients</h1>
          <p className="text-sm text-muted-foreground">Companies that request signage recce work.</p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden /> New client
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search clients"
            placeholder="Search name or code"
            className="pl-9"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-40">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={filtered ? "No clients match your filters" : "No clients yet"}
            description={filtered ? "Try a different search or status." : "Add your first client to start creating projects."}
            action={
              !filtered && canWrite ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden /> New client
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Primary contact</th>
                  <th className="px-4 py-2.5 font-medium">City</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  {canWrite && <th className="px-4 py-2.5 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => {
                  const primary = c.contacts?.find((k) => k.isPrimary) ?? c.contacts?.[0];
                  return (
                    <tr key={c._id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                      <td className="px-4 py-3">
                        {primary ? (
                          <>
                            <span>{primary.name}</span>
                            {(primary.phone || primary.email) && (
                              <span className="block text-xs text-muted-foreground">{primary.phone ?? primary.email}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{c.city ?? "-"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>
                          {c.status === "ACTIVE" ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${c.name}`}
                              onClick={() => {
                                setEditing(c);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" aria-hidden /> Edit
                            </Button>
                            {c.status === "ACTIVE" && (
                              <Button variant="ghost" size="sm" aria-label={`Deactivate ${c.name}`} onClick={() => setConfirm(c)}>
                                <Power className="size-4 text-danger" aria-hidden /> Deactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!list.isError && rows.length > 0 && <Pagination meta={list.data?.meta} onPage={setPage} />}
      </Card>

      <ClientFormDrawer open={formOpen} onOpenChange={setFormOpen} client={editing} />

      <Modal
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Deactivate client?"
        description={`${confirm?.name ?? ""} will be hidden from new project pickers. Existing projects are not affected.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deactivate.isPending}
              onClick={async () => {
                if (!confirm) return;
                try {
                  await deactivate.mutateAsync(confirm._id);
                  toast("Client deactivated");
                  setConfirm(null);
                } catch (e) {
                  toast(errorMessage(e), "error");
                }
              }}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">This is a soft delete; the record is kept for history.</p>
      </Modal>
    </div>
  );
}
