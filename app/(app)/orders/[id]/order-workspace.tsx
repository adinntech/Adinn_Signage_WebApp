"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, GitBranch, Handshake, MessageSquare, ReceiptText, UserRound } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { HandoverTab } from "@/components/orders/handover-tab";
import { OrderComments } from "@/components/sales/order-comments";
import { PipelineHistory } from "@/components/sales/pipeline-history";
import { RateCardStage } from "@/components/sales/rate-card/rate-card-stage";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useOrder } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

type Tab = "ratecard" | "handover" | "comments" | "history";
const TAB_KEYS: Tab[] = ["ratecard", "handover", "comments", "history"];

/**
 * One order: who it is for, its New / Existing client flag, the rate card (BD), and the BD -> Client Servicing handover.
 * Client Servicing opens the same page read-only, starting on the handover details.
 */
export function OrderWorkspace() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const isCs = user?.role === "CLIENT_SERVICING";
  const q = useOrder(id);
  // The tab lives in the URL (?tab=), so notification links and Back land on the right tab even when this page was kept alive.
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && TAB_KEYS.includes(asked) ? asked : isCs ? "handover" : "ratecard";
  const setTab = (t: Tab) => router.replace(`/orders/${id}?tab=${t}`, { scroll: false });

  if (q.isPending)
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this order" />;
  const o = q.data;
  const tabs: TabItem<Tab>[] = [
    { key: "ratecard", label: "Rate Card", icon: ReceiptText },
    {
      key: "handover",
      label: isCs ? "Handover Details" : "Handover to CS",
      icon: Handshake,
      badge: !isCs && !o.csAssignee ? <span className="size-2 rounded-full bg-warning" aria-label="Not handed over yet" /> : undefined,
    },
    { key: "comments", label: "Comments", icon: MessageSquare },
    { key: "history", label: "History", icon: GitBranch },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> {isCs ? "My Orders" : "Order Management"}
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-primary">{o.orderNo}</h1>
              <ClientTypeBadge type={o.clientType} full />
              {o.csAssignee ? (
                <Badge tone="success">
                  <Handshake className="size-3.5" aria-hidden /> With Client Servicing
                </Badge>
              ) : (
                <Badge tone="warning">Not handed over</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/clients/${o.client._id}`} className="font-semibold text-foreground hover:text-brand hover:underline">
                {o.client.name}
              </Link>{" "}
              · {o.client.clientNo ?? o.client.code}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {[
              { icon: UserRound, label: "BD", value: o.owner?.name ?? "Unassigned" },
              { icon: Handshake, label: "Client Servicing", value: o.csAssignee?.name ?? "-" },
              { icon: Building2, label: "City", value: o.client.city || "-" },
              { icon: CalendarDays, label: "Created", value: formatDate(o.createdAt) },
            ].map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <d.icon className="size-4 text-muted-foreground" aria-hidden />
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="font-medium text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Tabs idPrefix="ow" className="px-3" items={tabs} value={tab} onChange={setTab} />
      </Card>

      <div id="ow-panel" role="tabpanel">
        {tab === "ratecard" && <RateCardStage orderId={o._id} />}
        {tab === "handover" && <HandoverTab order={o} />}
        {tab === "comments" && <OrderComments orderId={o._id} />}
        {tab === "history" && <PipelineHistory orderId={o._id} />}
      </div>
    </div>
  );
}
