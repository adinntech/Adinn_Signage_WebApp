"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Clock3,
  FileCheck2,
  FilterX,
  FolderPlus,
  UserCheck,
  Mail,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useDebounced } from "@/hooks/use-debounced";
import {
  useCodeOrders,
  type OrderBucket,
  type OrderCodeState,
} from "@/lib/api/codeRequests";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "ALL" | OrderBucket;
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All orders" },
  { key: "TODO", label: "To request" },
  { key: "WAITING", label: "Waiting for code" },
  { key: "DONE", label: "Done" },
];

const CHIP: Record<
  OrderCodeState["codes"]["CLIENT_CODE"]["state"],
  { label: string; cls: string; icon: typeof Mail }
> = {
  NOT_REQUESTED: {
    label: "Not requested",
    cls: "bg-[#ffe8e8] text-loss",
    icon: Mail,
  },
  PENDING: {
    label: "Waiting",
    cls: "bg-[#fff0e0] text-approval",
    icon: Clock3,
  },
  BD_SENT: {
    label: "BD requested",
    cls: "bg-[#e8f0ff] text-royal",
    icon: Clock3,
  },
  CONFIRMED: {
    label: "Confirmed",
    cls: "bg-[#e2f8ea] text-finance",
    icon: BadgeCheck,
  },
  FAILED: {
    label: "Email failed",
    cls: "bg-[#ffe8e8] text-loss",
    icon: TriangleAlert,
  },
};
function Chip({ s }: { s: OrderCodeState["codes"]["CLIENT_CODE"] }) {
  const m = CHIP[s.state];
  return (
    <span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
          m.cls,
        )}
      >
        <m.icon className="size-3" aria-hidden /> {m.label}
      </span>
      {s.code && (
        <span className="mt-0.5 block font-mono text-xs font-semibold text-finance">
          {s.code}
        </span>
      )}
    </span>
  );
}

/**
 * Code Requests: your orders by what is left to do for their client code and project code. (The plain order list is
 * My Orders; this page is for the code work only.) Opening an order goes to its Code Request Hub.
 */
export function CodeOrders() {
  const [tab, setTab] = useState<Tab>("TODO");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const list = useCodeOrders({
    page,
    limit: 10,
    q: dq,
    bucket: tab === "ALL" ? undefined : tab,
  });
  const rows = list.data?.data ?? [];
  const counts = (
    list.data?.meta as
      | {
          counts?: { ALL: number; TODO: number; WAITING: number; DONE: number };
        }
      | undefined
  )?.counts;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-5">
      <PageHeader
        icon={FileCheck2}
        title="Code Requests"
        subtitle="See which orders still need a client code or project code, which are waiting for the code to come back, and which are done."
      />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => (setTab(t.key), setPage(1))}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
                  tab === t.key
                    ? "bg-brand text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    tab === t.key ? "bg-white/20" : "bg-muted",
                  )}
                >
                  {counts ? counts[t.key] : "-"}
                </span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto min-w-52 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label="Search orders"
              placeholder="Order no, company or Client ID"
              className="pl-9"
              maxLength={60}
              value={q}
              onChange={(e) => (setQ(e.target.value), setPage(1))}
            />
          </div>
          <Button
            variant="outline"
            disabled={!q}
            onClick={() => (setQ(""), setPage(1))}
          >
            <FilterX className="size-4" aria-hidden /> Clear
          </Button>
        </div>
      </Card>
      <Card className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
        <GradientHeader
          title={TABS.find((t) => t.key === tab)!.label}
          right={
            list.data && (
              <span className="text-xs text-white/80">
                {list.data.meta.total} orders
              </span>
            )
          }
        />
        {list.isPending ? (
          <RowsSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={tab === "DONE" || tab === "TODO" ? BadgeCheck : FileCheck2}
            title={
              dq
                ? "No orders match your search"
                : tab === "TODO"
                  ? "Nothing left to request"
                  : tab === "WAITING"
                    ? "Nothing is waiting for a code"
                    : tab === "DONE"
                      ? "No order has both codes yet"
                      : "No orders assigned to you yet"
            }
            description={
              dq
                ? "Check the spelling or clear the search."
                : tab === "TODO"
                  ? "Every order already has its codes requested or confirmed."
                  : "Orders appear here when the BD team hands them over to you."
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order No</th>
                  <th className="px-4 py-3">Client Company</th>
                  <th className="px-4 py-3">Client Code</th>
                  <th className="px-4 py-3">Project Code</th>
                  <th className="px-4 py-3">Assigned On</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((o) => (
                  <tr key={o.orderId} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">
                      {o.orderNo}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{o.client.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.client.clientNo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Chip s={o.codes.CLIENT_CODE} />
                    </td>
                    <td className="px-4 py-3">
                      <Chip s={o.codes.PROJECT_CODE} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(o.assignedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex gap-1.5">
                        {o.bucket === "DONE" && o.hasProject && (
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              href={`/client-servicing/recce-assignment/${o.orderId}`}
                            >
                              <UserCheck className="size-4" aria-hidden /> Recce
                              Assignment
                            </Link>
                          </Button>
                        )}
                        {o.bucket === "DONE" && !o.hasProject && (
                          <Button size="sm" variant="brand" asChild>
                            <Link
                              href={`/client-servicing/projects/new?order=${o.orderId}`}
                            >
                              <FolderPlus className="size-4" aria-hidden />{" "}
                              Create Project
                            </Link>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={o.bucket === "TODO" ? "brand" : "outline"}
                          asChild
                        >
                          <Link
                            href={
                              o.bucket === "WAITING"
                                ? `/client-servicing/codes/${o.orderId}/confirm`
                                : `/client-servicing/codes/${o.orderId}`
                            }
                          >
                            <FileCheck2 className="size-4" aria-hidden />{" "}
                            {o.bucket === "TODO"
                              ? "Request"
                              : o.bucket === "WAITING"
                                ? "Confirm"
                                : "View"}
                          </Link>
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!list.isError && rows.length > 0 && (
          <Pagination meta={list.data?.meta} onPage={setPage} />
        )}
      </Card>
    </div>
  );
}
