"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, GitBranch, Handshake, MessageSquare, Route, UserRound } from "lucide-react";
import { CompanyDetailsCard, ContactsCard } from "@/components/clients/client-info";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { CsWorkflow } from "@/components/orders/cs-workflow";
import { HandoverTab } from "@/components/orders/handover-tab";
import { OrderComments } from "@/components/sales/order-comments";
import { PipelineHistory } from "@/components/sales/pipeline-history";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useOrder } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { leadBase } from "@/lib/role-routes";
import { formatDate } from "@/lib/format";
import { clientIdOf } from "@/lib/api/clients";

type Tab = "workflow" | "client" | "handover" | "comments" | "history";

/**
 * One order (Order Management > View): the order, its New / Existing client flag and the client's full details.
 * Rate cards and the BD -> Client Servicing assignment live in Lead Management; Client Servicing still opens
 * the handover details here, read-only.
 */
export function OrderWorkspace() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const isCs = user?.role === "CLIENT_SERVICING";
  // Active flow: Client Servicing opens the same order in Create Project (old links and notifications land there, query kept).
  useEffect(() => {
    if (!isCs) return;
    const qs = params.toString();
    router.replace(`${leadBase(user?.role)}/${id}${qs ? `?${qs}` : ""}`);
  }, [isCs, id, router, params, user?.role]);
  const q = useOrder(id);
  // Client Servicing: the workflow (Assign to Recce Team) first, then what the BD handed over.
  // Comments are not shown to Client Servicing (they use Communication & Attachments in the handover).
  const tabKeys: Tab[] = isCs ? ["workflow", "handover", "client", "history"] : ["client", "comments", "history"];
  // The tab lives in the URL (?tab=), so notification links and Back land on the right tab even when this page was kept alive.
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && tabKeys.includes(asked) ? asked : tabKeys[0]!;
  const setTab = (t: Tab) => router.replace(`/orders/${id}?tab=${t}`, { scroll: false });
  // A tab this role does not have (e.g. ?tab=comments for Client Servicing): replace it in the URL with the default.
  const invalidTab = !!asked && !tabKeys.includes(asked);
  useEffect(() => {
    if (invalidTab) router.replace(`/orders/${id}?tab=${tabKeys[0]}`, { scroll: false });
  }, [invalidTab, id, router, tabKeys]);

  if (q.isPending)
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this order" />;
  const o = q.data;
  const allTabs: Record<Tab, TabItem<Tab>> = {
    workflow: { key: "workflow", label: "Workflow", icon: Route },
    handover: { key: "handover", label: "Handover Details", icon: Handshake },
    client: { key: "client", label: "Client Details", icon: Building2 },
    comments: { key: "comments", label: "Comments", icon: MessageSquare },
    history: { key: "history", label: "History", icon: GitBranch },
  };

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
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/clients/${o.client._id}`} className="font-semibold text-foreground hover:text-brand hover:underline">
                {o.client.name}
              </Link>
              {o.client.clientName && <> · {o.client.clientName}</>} · {clientIdOf(o.client, o.clientType)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {o.clientType === "NEW" ? "First order of a newly registered client." : "Repeat order of an already registered client."}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {[
              { icon: UserRound, label: "BD", value: o.owner?.name ?? "Unassigned" },
              ...(isCs ? [{ icon: Handshake, label: "Client Servicing", value: o.csAssignee?.name ?? "-" }] : []),
              { icon: Building2, label: "City", value: o.client.city || "-" },
              { icon: CalendarDays, label: "Created", value: `${formatDate(o.createdAt)}${o.createdBy?.name ? ` by ${o.createdBy.name}` : ""}` },
            ].map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <d.icon className="size-4 text-muted-foreground" aria-hidden />
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="font-medium text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Tabs idPrefix="ow" className="px-3" items={tabKeys.map((k) => allTabs[k])} value={tab} onChange={setTab} />
      </Card>

      <div id="ow-panel" role="tabpanel">
        {tab === "client" && (
          <div className="space-y-4">
            <CompanyDetailsCard client={o.client} />
            <ContactsCard contacts={o.client.contacts ?? []} />
          </div>
        )}
        {tab === "workflow" && <CsWorkflow order={o} />}
        {tab === "handover" && <HandoverTab order={o} />}
        {tab === "comments" && <OrderComments orderId={o._id} />}
        {tab === "history" && <PipelineHistory orderId={o._id} />}
      </div>
    </div>
  );
}
