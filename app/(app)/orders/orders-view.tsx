"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ClipboardList, Download, FilterX, Handshake, Plus, ReceiptText, Search } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { downloadFile } from "@/lib/api/files";
import { useOrders } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

/** Order Management: every order with its client, New / Existing flag, BD and rate card status. */
export function OrdersView() {
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();
  const canWrite = can("sales:write");
  const isCs = user?.role === "CLIENT_SERVICING";
  const [q, setQ] = useState("");
  const [clientType, setClientType] = useState("");
  const [handover, setHandover] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);
  const list = useOrders({ page, limit: 20, q: dq, clientType, handover, sort: isCs ? "-handover.assignedAt" : "-createdAt" });
  const rows = list.data?.data ?? [];
  const filtered = !!(dq || clientType || handover);

  const createButton = canWrite && (
    <Button variant="brand" size="lg" onClick={() => setCreating(true)}>
      <Plus className="size-4" aria-hidden /> Create Order
    </Button>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader
        icon={ClipboardList}
        title={isCs ? "My Orders" : "Order Management"}
        subtitle={isCs ? "Orders the BD team handed over to you." : "Create orders for registered clients, prepare their rate cards and hand them to Client Servicing."}
        actions={createButton}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search orders"
              placeholder="Search order no, company name or Client ID"
              className="pl-9"
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
          {!isCs && (
            <div className="w-56">
              <Select
                aria-label="Filter by handover"
                value={handover}
                onChange={(e) => {
                  setHandover(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Handover Status</option>
                <option value="PENDING">Not handed over</option>
                <option value="ASSIGNED">With Client Servicing</option>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            disabled={!filtered && !q}
            onClick={() => {
              setQ("");
              setClientType("");
              setHandover("");
              setPage(1);
            }}
          >
            <FilterX className="size-4" aria-hidden /> Clear Filters
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[380px] flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">All Orders</h2>
          {list.data && <span className="text-xs text-muted-foreground">{list.data.meta.total} records</span>}
        </div>
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filtered ? "No orders match your filters" : isCs ? "No orders assigned to you yet" : "No orders yet"}
            description={filtered ? "Try a different search or filter." : isCs ? "Orders appear here when the BD team hands them over to you." : "Create the first order for a registered client."}
            action={!filtered ? createButton : undefined}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order No</th>
                  <th className="px-4 py-3">Client Company</th>
                  <th className="px-4 py-3">Client Flag</th>
                  <th className="px-4 py-3">BD</th>
                  <th className="px-4 py-3">{isCs ? "Assigned On" : "Client Servicing"}</th>
                  <th className="px-4 py-3">Rate Card</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((o, i) => (
                  <motion.tr
                    key={o._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      <Link href={`/orders/${o._id}`} className="text-brand hover:underline">
                        {o.orderNo}
                      </Link>
                      {isCs && !o.handover?.seenAt && <Badge className="ml-2 bg-brand text-white">New</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{o.client?.name ?? "-"}</span>
                      <span className="block text-xs text-muted-foreground">{[o.client?.clientNo, o.client?.city].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ClientTypeBadge type={o.clientType} full />
                    </td>
                    <td className="px-4 py-3">{o.owner?.name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      {isCs ? (
                        <span className="text-muted-foreground">{formatDate(o.handover?.assignedAt)}</span>
                      ) : o.csAssignee ? (
                        <>
                          <span className="block font-medium">{o.csAssignee.name}</span>
                          <span className="block text-xs text-muted-foreground">{formatDate(o.handover?.assignedAt)}</span>
                        </>
                      ) : (
                        <Badge tone="warning">Not handed over</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {o.rateCardLabel ? (
                        <Badge tone="info">
                          <ReceiptText className="size-3.5" aria-hidden /> {o.rateCardLabel}
                        </Badge>
                      ) : (
                        <Badge>Not prepared</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {o.rateCardPdf?.fileId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Download rate card PDF of ${o.orderNo}`}
                            onClick={() => downloadFile(o.rateCardPdf!.fileId, { orderId: o._id }, `${o.orderNo}_Rate_Card_${o.rateCardLabel}.pdf`).catch((e) => toast(errorMessage(e), "error"))}
                          >
                            <Download className="size-4" aria-hidden /> PDF
                          </Button>
                        )}
                        {canWrite && !o.csAssignee && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/orders/${o._id}?tab=handover`} aria-label={`Assign ${o.orderNo} to Client Servicing`}>
                              <Handshake className="size-4" aria-hidden /> Assign CS
                            </Link>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/orders/${o._id}${isCs ? "?tab=handover" : ""}`} aria-label={`Open ${o.orderNo}`}>
                            <ReceiptText className="size-4" aria-hidden /> {canWrite ? "Rate Card" : "View"}
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

      <CreateOrderDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(o) => {
          setCreating(false);
          router.push(`/orders/${o._id}`);
        }}
      />
    </div>
  );
}
