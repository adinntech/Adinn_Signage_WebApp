"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, Check, ExternalLink, FilterX, RefreshCw, Search } from "lucide-react";
import { CodeStatusBadge, ConfirmCodeDialog, EvidenceLinks, RejectCodeDialog } from "@/components/client-servicing/code-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { CODE_LABEL, STATUS_LABEL, useCodeList, useRetryCodes, type CodeKind, type CodeListItem, type CodeStatus } from "@/lib/api/codeRequests";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS: { key: CodeStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "PENDING_CONFIRMATION", label: STATUS_LABEL.PENDING_CONFIRMATION },
  { key: "CONFIRMED", label: STATUS_LABEL.CONFIRMED },
  { key: "FAILED", label: STATUS_LABEL.FAILED },
  { key: "REJECTED", label: STATUS_LABEL.REJECTED },
  { key: "DRAFT", label: STATUS_LABEL.DRAFT },
];

/** Retry sits in its own component so each row owns its order's mutation. */
function RetryButton({ r }: { r: CodeListItem }) {
  const toast = useToast();
  const retry = useRetryCodes(r.order?._id ?? "");
  return (
    <Button
      size="sm"
      variant="outline"
      loading={retry.isPending}
      onClick={() =>
        retry.mutateAsync(r.mailBatchId!).then(
          () => toast("Email sent again"),
          (e) => toast(errorMessage(e), "error"),
        )
      }
    >
      <RefreshCw className="size-4" aria-hidden /> Retry
    </Button>
  );
}

/** Code Confirmation: every client code and project code request, and where the real code is entered. */
export function CodeConfirmation() {
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<CodeStatus | "">("PENDING_CONFIRMATION");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ orderId: string; kind: CodeKind } | null>(null);
  const [reject, setReject] = useState<{ orderId: string; kind: CodeKind } | null>(null);
  const dq = useDebounced(q.trim());
  const list = useCodeList({ page, limit: 10, status, kind, q: dq });
  const rows = list.data?.data ?? [];
  const counts = (list.data?.meta as { counts?: Record<string, number> } | undefined)?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const filtered = !!(dq || kind);

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader icon={BadgeCheck} title="Code Confirmation" subtitle="Enter the client code and project code once the authorised team sends them back. Each code is confirmed on its own." />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={status === t.key}
                onClick={() => {
                  setStatus(t.key);
                  setPage(1);
                }}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium", status === t.key ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted")}
              >
                {t.label}
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", status === t.key ? "bg-white/20" : "bg-muted")}>{t.key ? (counts[t.key] ?? 0) : total}</span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search requests" placeholder="Order no, client or code" className="pl-9" maxLength={60} value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </div>
          <div className="w-40">
            <Select aria-label="Filter by code" value={kind} onChange={(e) => (setKind(e.target.value), setPage(1))}>
              <option value="">All codes</option>
              <option value="CLIENT_CODE">Client Code</option>
              <option value="PROJECT_CODE">Project Code</option>
            </Select>
          </div>
          <Button variant="outline" disabled={!filtered} onClick={() => (setQ(""), setKind(""), setPage(1))}>
            <FilterX className="size-4" aria-hidden /> Clear
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[360px] flex-1 flex-col overflow-hidden">
        <GradientHeader title="Code Requests" right={list.data && <span className="text-xs text-white/80">{list.data.meta.total} records</span>} />
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={BadgeCheck} title="No requests here" description={filtered || status ? "Try another status or search." : "Requests appear here after you send a code request from the Code Request Hub."} />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => {
                  const orderId = r.order?._id ?? "";
                  return (
                    <motion.tr key={r._id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">{r.order?.orderNo ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{r.client?.name ?? "-"}</span>
                        <span className="block text-xs text-muted-foreground">{r.client?.clientNo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block">{CODE_LABEL[r.kind]}</span>
                        {r.confirmedCode && <span className="font-mono text-xs font-semibold text-success">{r.confirmedCode}</span>}
                        <EvidenceLinks orderId={orderId} files={r.evidence} />
                        {r.mode === "COMBINED" && <Badge tone="info" className="mt-0.5">Combined mail</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <CodeStatusBadge status={r.status} />
                        {r.mailStatus === "SKIPPED" && <span className="mt-0.5 block text-xs text-warning">Email off: recorded only</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(r.sentAt)}
                        {r.sentByName && <span className="block">{r.sentByName}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {r.status === "PENDING_CONFIRMATION" && (
                            <>
                              <Button size="sm" variant="brand" onClick={() => setConfirm({ orderId, kind: r.kind })}>
                                <Check className="size-4" aria-hidden /> Confirm
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setReject({ orderId, kind: r.kind })}>
                                Reject
                              </Button>
                            </>
                          )}
                          {r.status === "FAILED" && r.mailBatchId && <RetryButton r={r} />}
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/client-servicing/codes/${orderId}/confirm`} aria-label="Open order confirmation">
                              <ExternalLink className="size-4" aria-hidden /> Open
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

      <ConfirmCodeDialog key={confirm ? `${confirm.orderId}${confirm.kind}` : "c"} orderId={confirm?.orderId ?? ""} kind={confirm?.kind ?? null} onClose={() => setConfirm(null)} />
      <RejectCodeDialog key={reject ? `${reject.orderId}${reject.kind}` : "r"} orderId={reject?.orderId ?? ""} kind={reject?.kind ?? null} onClose={() => setReject(null)} />
    </div>
  );
}
