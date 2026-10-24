"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ClipboardCheck, FileText, GitBranch, LayoutGrid, MessageSquare, ReceiptText, X } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { nextStage, STAGE_META, stageReached, useMoveStage, useOrder, useOrderEmails, type Order, type OrderStage } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ApprovalTab } from "./approval-tab";
import { CompanyProfileTab } from "./company-profile-tab";
import { OrderComments } from "./order-comments";
import { OrderOverview } from "./order-overview";
import { PipelineHistory } from "./pipeline-history";
import { RateCardStage } from "./rate-card/rate-card-stage";
import { StageBadge } from "./stage";

export type OrderTab = "overview" | "profile" | "ratecard" | "approval" | "comments" | "history";
export const STAGE_TAB: Record<OrderStage, OrderTab> = { NEW_ORDER: "overview", COMPANY_PROFILE: "profile", RATE_CARD: "ratecard", CLIENT_APPROVAL: "approval" };

function MoveButton({ order, onMoved }: { order: Order; onMoved: (s: OrderStage) => void }) {
  const toast = useToast();
  const move = useMoveStage(order._id);
  const [open, setOpen] = useState(false);
  const next = nextStage(order.stage);
  const profileEmails = useOrderEmails(order._id, "COMPANY_PROFILE");
  if (!next) return null;
  const noProfileSent = order.stage === "COMPANY_PROFILE" && !profileEmails.data?.some((e) => e.status === "SENT");
  const noRateCard = order.stage === "RATE_CARD" && !order.latestRevision;

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)} disabled={noRateCard} title={noRateCard ? "Save the rate card first" : undefined}>
        Move to {STAGE_META[next].label} <ArrowRight className="size-4" aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Move to ${STAGE_META[next].label}?`}
        confirmLabel="Move"
        loading={move.isPending}
        onConfirm={async () => {
          try {
            await move.mutateAsync(next);
            toast(`${order.orderNo} moved to ${STAGE_META[next].label}`);
            setOpen(false);
            onMoved(next);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          {order.orderNo} moves from <b>{STAGE_META[order.stage].label}</b> to <b>{STAGE_META[next].label}</b>. This is recorded in Pipeline History.
        </p>
        {noProfileSent && <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">The company profile email has not been sent successfully for this order yet.</p>}
      </ConfirmDialog>
    </>
  );
}

/**
 * Order details with the common tabs (Overview, Comments, Pipeline History) plus one tab per reached stage.
 * `modal`: fixed header and tabs with a scrolling body (Kanban popup); otherwise a normal page section.
 */
export function OrderDetailView({
  id,
  modal,
  initialTab,
  onTabChange,
  onClose,
}: {
  id: string;
  modal?: boolean;
  initialTab?: OrderTab | null;
  onTabChange?: (t: OrderTab) => void;
  onClose?: () => void;
}) {
  const { can } = useAuth();
  const q = useOrder(id);
  const [tab, setTab] = useState<OrderTab | null>(initialTab ?? null);

  if (q.isPending)
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    );
  if (q.isError)
    return (
      <div className="relative">
        {modal && onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="absolute right-3 top-3">
            <X className="size-5" aria-hidden />
          </Button>
        )}
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this order" />
      </div>
    );
  const o = q.data;

  const items: TabItem<OrderTab>[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    ...(stageReached(o.stage, "COMPANY_PROFILE") ? [{ key: "profile" as const, label: "Company Profile", icon: FileText }] : []),
    ...(stageReached(o.stage, "RATE_CARD") ? [{ key: "ratecard" as const, label: "Rate Card", icon: ReceiptText }] : []),
    ...(stageReached(o.stage, "CLIENT_APPROVAL") ? [{ key: "approval" as const, label: "Client Approval Proof", icon: ClipboardCheck }] : []),
    { key: "comments", label: "Comments", icon: MessageSquare },
    { key: "history", label: "Pipeline History", icon: GitBranch },
  ];
  const active: OrderTab = tab && items.some((t) => t.key === tab) ? tab : STAGE_TAB[o.stage];
  const select = (t: OrderTab) => {
    setTab(t);
    onTabChange?.(t);
  };

  const header = (
    <div className={cn("bg-surface", !modal && "overflow-hidden rounded-xl border border-border shadow-soft")}>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-bold text-foreground">{o.orderNo}</h1>
            <StageBadge stage={o.stage} />
            <ClientTypeBadge type={o.clientType} />
            {o.approvalStatus === "COMPLETED" && (
              <Badge tone="success">
                <BadgeCheck className="size-3.5" aria-hidden /> Approved
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{o.client.name}</span> · {o.client.clientNo ?? o.client.code} · BD: {o.owner?.name ?? "Unassigned"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("sales:write") && <MoveButton order={o} onMoved={(s) => select(STAGE_TAB[s])} />}
          {modal && onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="size-5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      {modal && <Tabs idPrefix="order-m" className="px-3" items={items} value={active} onChange={select} />}
    </div>
  );

  const body = (
    <AnimatePresence mode="wait">
      <motion.div
        key={active}
        id={modal ? "order-m-panel" : "order-panel"}
        role="tabpanel"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {active === "overview" && <OrderOverview order={o} onOpenTab={select} />}
        {active === "profile" && <CompanyProfileTab orderId={o._id} />}
        {active === "ratecard" && <RateCardStage orderId={o._id} withEmail />}
        {active === "approval" && <ApprovalTab orderId={o._id} />}
        {active === "comments" && <OrderComments orderId={o._id} />}
        {active === "history" && <PipelineHistory orderId={o._id} />}
      </motion.div>
    </AnimatePresence>
  );

  if (modal)
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-border">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 sm:p-5">{body}</div>
      </div>
    );
  return (
    <div className="space-y-5">
      {header}
      <Tabs idPrefix="order" items={items} value={active} onChange={select} />
      {body}
    </div>
  );
}
