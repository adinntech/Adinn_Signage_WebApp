"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Ban,
  Building2,
  CalendarDays,
  Check,
  Download,
  Eye,
  History,
  MapPin,
  MousePointerClick,
  PartyPopper,
  RotateCcw,
  Undo2,
  UserRound,
} from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import type { SearchOption } from "@/components/ui/search-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile } from "@/lib/api/files";
import {
  LEAD_STAGES,
  useCloseLead,
  useCompleteLeadStage,
  useLead,
  usePreviousLeadStage,
  useReopenLead,
  useStartLead,
  type LeadDetail,
  type LeadHistoryEntry,
  type LeadStage,
  type LeadStageState,
} from "@/lib/api/leads";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LeadMindMap, type MapNode } from "./lead-mind-map";
import { HANDOVER_META, STAGE_META } from "./stage-meta";
import { ApprovalTab } from "@/components/sales/approval-tab";
import { NegotiationPanel } from "./negotiation-panel";
import { ClientRegisteredPanel, HandoverPanel, MissingList, NewLeadDone, NewLeadPicker, RateCardPanel, RequirementPanel, StageInfo } from "./stage-panels";

const CELEBRATE_MS = 2600;

/** Before a lead exists (New Lead screen): stage 1 in progress, the rest waiting. */
const BLANK_STAGES: LeadStageState[] = LEAD_STAGES.map((key, i) => ({
  key,
  label: STAGE_META[key].label,
  number: i + 1,
  status: key === "NEW_LEAD" ? "CURRENT" : "PENDING",
  available: true,
  startedAt: null,
  completedAt: null,
  completedBy: null,
}));

function historyText(h: LeadHistoryEntry) {
  const to = h.toStage ? STAGE_META[h.toStage].short : "";
  const from = h.fromStage ? STAGE_META[h.fromStage].short : "";
  if (h.action === "START") return "Lead created";
  if (h.action === "COMPLETE") return h.toStage ? `${from} completed → ${to}` : "Client approved the rate card: lead completed";
  if (h.action === "BACK") return `Moved back: ${from} → ${to}`;
  if (h.action === "CLOSE") return `Lead closed${h.note ? `: ${h.note}` : ""}`;
  if (h.action === "REOPEN") return "Lead reopened";
  return h.action;
}

export function LeadStatusBadge({ status }: { status: LeadDetail["lead"]["status"] }) {
  if (status === "COMPLETED")
    return (
      <Badge tone="success">
        <BadgeCheck className="size-3.5" aria-hidden /> Completed
      </Badge>
    );
  return status === "CLOSED" ? <Badge tone="danger">Closed</Badge> : <Badge tone="info">In Progress</Badge>;
}

/** Shown once the client approved the rate card. */
function CompletedBanner({ detail }: { detail: LeadDetail }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-success/30 bg-gradient-to-r from-success-soft to-white p-4"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-success text-white">
        <PartyPopper className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-success">Lead completed: the client approved the rate card</p>
        <p className="text-sm text-muted-foreground">
          {detail.lead.completedBy?.name ?? "-"} · {formatDateTime(detail.lead.completedAt)} · final rate card {detail.summary.rateCardLabel ?? "-"}
          {detail.summary.negotiationRounds ? ` after ${detail.summary.negotiationRounds} negotiation round${detail.summary.negotiationRounds === 1 ? "" : "s"}` : ""}. The rate card and approval proof are locked.
        </p>
      </div>
    </motion.div>
  );
}

function SidePanel({
  detail,
  canWrite,
  onOpen,
  onBack,
  onClose,
  onReopen,
}: {
  detail: LeadDetail;
  canWrite: boolean;
  onOpen: (k: MapNode) => void;
  onBack: () => void;
  onClose: () => void;
  onReopen: () => void;
}) {
  const toast = useToast();
  const { order, lead } = detail;
  const open = lead.status === "OPEN";
  const current = detail.stages.find((s) => s.status === "CURRENT");
  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-primary">Current Lead</h2>
          <LeadStatusBadge status={lead.status} />
        </div>
        <p className="font-mono text-sm font-bold text-brand">{order.orderNo}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold">
          {order.client.name} <ClientTypeBadge type={order.clientType} />
        </p>
        {order.client.clientName && <p className="text-xs text-muted-foreground">{order.client.clientName}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
          {[
            { icon: UserRound, label: "Created By", value: lead.startedBy?.name ?? order.owner?.name ?? "-" },
            { icon: CalendarDays, label: "Created Date", value: formatDate(lead.startedAt) },
            { icon: Building2, label: "Industry", value: order.client.industry || "-" },
            { icon: MapPin, label: "Location", value: [order.client.city, order.client.state].filter(Boolean).join(", ") || "-" },
          ].map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="flex items-center gap-1 text-muted-foreground">
                <d.icon className="size-3.5" aria-hidden /> {d.label}
              </dt>
              <dd className="mt-0.5 truncate font-medium text-foreground">{d.value}</dd>
            </div>
          ))}
        </dl>
        {!open && lead.closeReason && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">Closed {formatDate(lead.closedAt)}: {lead.closeReason}</p>}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-primary">Stage Progress</h2>
        <ol className="space-y-2">
          {detail.stages.map((s) => {
            const m = STAGE_META[s.key];
            return (
              <li key={s.key}>
                <button type="button" onClick={() => onOpen(s.key)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-muted">
                  <span
                    className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", s.status === "PENDING" || s.status === "SKIPPED" ? "border border-border text-muted-foreground" : "text-white")}
                    style={s.status === "DONE" ? { background: "var(--color-success)" } : s.status === "CURRENT" ? { background: m.color } : undefined}
                  >
                    {s.status === "DONE" ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : s.number}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", s.status === "SKIPPED" && "text-muted-foreground line-through")}>{m.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {s.status === "DONE" ? formatDate(s.completedAt) : s.status === "CURRENT" ? <span style={{ color: m.color }}>In Progress</span> : s.status === "SKIPPED" ? "Skipped" : "Pending"}
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => onOpen("HANDOVER")} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-muted">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: detail.handover.unlocked ? HANDOVER_META.color : "#94a3b8" }}>
                <HANDOVER_META.icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">Client Servicing Handover</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{detail.handover.assignee ? detail.handover.assignee.name : detail.handover.unlocked ? "Ready" : "Locked"}</span>
            </button>
          </li>
        </ol>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-primary">Quick Actions</h2>
        <div className="grid gap-2">
          {open && current && (
            <Button variant="brand" className="justify-start" onClick={() => onOpen(current.key)}>
              <MousePointerClick className="size-4" aria-hidden /> Continue: {STAGE_META[current.key].short}
            </Button>
          )}
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/orders/${order._id}`}>
              <Eye className="size-4" aria-hidden /> View Full Details
            </Link>
          </Button>
          {order.rateCardPdf?.fileId && (
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => downloadFile(order.rateCardPdf!.fileId, { orderId: order._id }, `${order.orderNo}_Rate_Card.pdf`).catch((e) => toast(errorMessage(e), "error"))}
            >
              <Download className="size-4" aria-hidden /> Download Rate Card PDF
            </Button>
          )}
          {canWrite && open && detail.previousStage && (
            <Button variant="outline" className="justify-start" onClick={onBack}>
              <Undo2 className="size-4" aria-hidden /> Move to Previous Stage
            </Button>
          )}
          {canWrite &&
            (open ? (
              <Button variant="outline" className="justify-start border-danger/30 text-danger hover:bg-danger-soft" onClick={onClose}>
                <Ban className="size-4" aria-hidden /> Cancel / Close Lead
              </Button>
            ) : lead.status === "CLOSED" ? (
              <Button variant="brand-outline" className="justify-start" onClick={onReopen}>
                <RotateCcw className="size-4" aria-hidden /> Reopen Lead
              </Button>
            ) : null)}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
          <History className="size-4" aria-hidden /> Lead History
        </h2>
        <HistoryList history={detail.history.slice(0, 8)} />
      </Card>
    </div>
  );
}

/** Below 2xl the side panel would push the mind map off screen: one compact row with the lead and its quick actions. */
function LeadStrip({
  detail,
  canWrite,
  onOpen,
  onBack,
  onClose,
  onReopen,
  onHistory,
}: {
  detail: LeadDetail;
  canWrite: boolean;
  onOpen: (k: MapNode) => void;
  onBack: () => void;
  onClose: () => void;
  onReopen: () => void;
  onHistory: () => void;
}) {
  const toast = useToast();
  const { order, lead } = detail;
  const open = lead.status === "OPEN";
  const current = detail.stages.find((s) => s.status === "CURRENT");
  const flow = detail.stages.filter((s) => s.status !== "SKIPPED");
  const at = flow.findIndex((s) => s.status === "CURRENT");
  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        {[
          { icon: UserRound, label: "Created By", value: lead.startedBy?.name ?? order.owner?.name ?? "-" },
          { icon: CalendarDays, label: "Created", value: formatDate(lead.startedAt) },
          { icon: Building2, label: "Industry", value: order.client.industry || "-" },
          { icon: MapPin, label: "Location", value: [order.client.city, order.client.state].filter(Boolean).join(", ") || "-" },
        ].map((d) => (
          <div key={d.label}>
            <dt className="flex items-center gap-1 text-muted-foreground">
              <d.icon className="size-3.5" aria-hidden /> {d.label}
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">{d.value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-muted-foreground">Progress</dt>
          <dd className="mt-1 flex gap-1" aria-label={`Stage ${at + 1} of ${flow.length}`}>
            {flow.map((s) => (
              <span key={s.key} className={cn("h-1.5 w-5 rounded-full", s.status === "DONE" ? "bg-success" : s.status === "PENDING" && "bg-border")} style={s.status === "CURRENT" ? { background: STAGE_META[s.key].color } : undefined} />
            ))}
          </dd>
        </div>
      </dl>
      <div className="ml-auto flex flex-wrap gap-2">
        {open && current && (
          <Button variant="brand" size="sm" onClick={() => onOpen(current.key)}>
            <MousePointerClick className="size-4" aria-hidden /> Continue: {STAGE_META[current.key].short}
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/orders/${order._id}`}>
            <Eye className="size-4" aria-hidden /> Full Details
          </Link>
        </Button>
        {order.rateCardPdf?.fileId && (
          <Button variant="outline" size="sm" onClick={() => downloadFile(order.rateCardPdf!.fileId, { orderId: order._id }, `${order.orderNo}_Rate_Card.pdf`).catch((e) => toast(errorMessage(e), "error"))}>
            <Download className="size-4" aria-hidden /> PDF
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onHistory}>
          <History className="size-4" aria-hidden /> History
        </Button>
        {canWrite && open && detail.previousStage && (
          <Button variant="outline" size="sm" onClick={onBack}>
            <Undo2 className="size-4" aria-hidden /> Previous Stage
          </Button>
        )}
        {canWrite &&
          (open ? (
            <Button variant="outline" size="sm" className="border-danger/30 text-danger hover:bg-danger-soft" onClick={onClose}>
              <Ban className="size-4" aria-hidden /> Close Lead
            </Button>
          ) : lead.status === "CLOSED" ? (
            <Button variant="brand-outline" size="sm" onClick={onReopen}>
              <RotateCcw className="size-4" aria-hidden /> Reopen
            </Button>
          ) : null)}
      </div>
      {!open && lead.closeReason && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">Closed {formatDate(lead.closedAt)}: {lead.closeReason}</p>}
    </Card>
  );
}

function HistoryList({ history }: { history: LeadHistoryEntry[] }) {
  return (
    <ol className="space-y-2.5">
      {history.map((h) => (
        <li key={h.id} className="border-l-2 border-border pl-3 text-xs">
          <p className="font-medium text-foreground">{historyText(h)}</p>
          {h.action === "BACK" && h.note && <p className="text-muted-foreground">Reason: {h.note}</p>}
          <p className="text-muted-foreground">
            {h.by || "-"} · {formatDateTime(h.at)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Stage drawer footer for the lead's current stage: back one stage, or complete it and move on. */
function StageFooter({
  detail,
  stage,
  onComplete,
  onBack,
  completing,
}: {
  detail: LeadDetail;
  stage: LeadStage;
  onComplete: () => void;
  onBack: () => void;
  completing: boolean;
}) {
  const next = detail.nextStage;
  const last = detail.lastStage;
  const blocked = detail.missing.length > 0 || (!last && !detail.nextAvailable);
  return (
    <>
      <span className="mr-auto self-center text-xs text-muted-foreground">
        {detail.missing[0] ??
          (last ? "Completing this stage completes the lead and locks the rate card." : next && !detail.nextAvailable ? `${STAGE_META[next].label} opens in the next Lead Management update.` : next ? `Next: ${STAGE_META[next].label}` : "")}
      </span>
      {detail.previousStage && (
        <Button variant="outline" onClick={onBack}>
          <Undo2 className="size-4" aria-hidden /> Previous Stage
        </Button>
      )}
      {(next || last) && (
        <Button variant="brand" onClick={onComplete} loading={completing} disabled={blocked} style={!blocked ? { background: STAGE_META[stage].color } : undefined}>
          {last ? (
            <>
              <BadgeCheck className="size-4" aria-hidden /> Approve & Complete Lead
            </>
          ) : (
            <>
              <Check className="size-4" aria-hidden /> Save & Complete <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      )}
    </>
  );
}

function LeadHeader({ detail }: { detail: LeadDetail | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Link href="/leads" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-brand">
          <ArrowLeft className="size-4" aria-hidden /> Lead Management
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-primary">
          {detail ? (
            <>
              <span className="font-mono">{detail.order.orderNo}</span>
              <span className="text-base font-semibold text-foreground">{detail.order.client.name}</span>
              <ClientTypeBadge type={detail.order.clientType} full />
              {detail.lead.status !== "OPEN" && <LeadStatusBadge status={detail.lead.status} />}
            </>
          ) : (
            "New Lead"
          )}
        </h1>
        <p className="text-sm text-muted-foreground">Complete journey from new lead to client approval and handover, as a mind map. Click a stage to work on it.</p>
      </div>
    </div>
  );
}

/** Mind map canvas with a soft dotted background. */
function Canvas({ children }: { children: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden p-4 sm:p-6" style={{ backgroundImage: "radial-gradient(circle, #dbe3ef 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      {children}
    </Card>
  );
}

/** New Lead: stage 1 opens straight away; saving it creates the lead and moves to its page. */
export function NewLeadWorkspace() {
  const router = useRouter();
  const toast = useToast();
  const start = useStartLead();
  const [drawer, setDrawer] = useState(true);
  const [order, setOrder] = useState<SearchOption | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();

  const save = async () => {
    if (!order) return setError("Select an order or create a new one");
    try {
      const d = await start.mutateAsync({ orderId: order.value, initialNotes: notes.trim() || undefined });
      toast(`${d.order.orderNo} is now a lead. ${STAGE_META[d.lead.stage].label} is next.`);
      setDrawer(false);
      router.replace(`/leads/${d.order._id}?fresh=1`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <LeadHeader detail={null} />
      <Canvas>
        <LeadMindMap stages={BLANK_STAGES} handover={{ unlocked: false, assignee: null, assignedAt: null }} onOpen={(k) => k === "NEW_LEAD" && setDrawer(true)} />
      </Canvas>
      <Modal
        open={drawer}
        onOpenChange={setDrawer}
        variant="drawer"
        className="max-w-3xl"
        title="1. New Lead / Client Approach"
        description="Select the order (or create one). The client's details and New / Existing flag come with it."
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={save} loading={start.isPending} style={{ background: STAGE_META.NEW_LEAD.color }}>
              <Check className="size-4" aria-hidden /> Save & Start Lead <ArrowRight className="size-4" aria-hidden />
            </Button>
          </>
        }
      >
        <NewLeadPicker
          orderId={order}
          onOrder={(o) => {
            setOrder(o);
            setError(undefined);
          }}
          notes={notes}
          onNotes={setNotes}
          error={error}
        />
      </Modal>
    </div>
  );
}

/** One lead: the mind map, the side panel and a drawer for the stage being worked on (kept in the URL as ?stage=). */
export function LeadWorkspace() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("sales:write");
  const q = useLead(id);
  const complete = useCompleteLeadStage(id);
  const back = usePreviousLeadStage(id);
  const close = useCloseLead(id);
  const reopen = useReopenLead(id);
  const [celebrate, setCelebrate] = useState<LeadStage | null>(null);
  const [backOpen, setBackOpen] = useState(false);
  const [backNote, setBackNote] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  const asked = params.get("stage") as MapNode | null;
  const selected: MapNode | null = asked && (asked === "HANDOVER" || (LEAD_STAGES as readonly string[]).includes(asked)) ? asked : null;
  const openNode = (k: MapNode | null) => router.replace(k ? `/leads/${id}?stage=${k}` : `/leads/${id}`, { scroll: false });
  const fresh = params.get("fresh") === "1";

  // Arriving from New Lead: play the stage 1 completion once, then drop the flag from the URL.
  const [freshSeen, setFreshSeen] = useState(false);
  if (fresh && !freshSeen) {
    setFreshSeen(true);
    setCelebrate("NEW_LEAD");
  }
  useEffect(() => {
    if (fresh) router.replace(`/leads/${id}`, { scroll: false });
  }, [fresh, id, router]);
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(null), CELEBRATE_MS);
    return () => clearTimeout(t);
  }, [celebrate]);

  if (q.isPending)
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 2xl:grid-cols-[1fr_320px]">
          <Skeleton className="h-[760px]" />
          <Skeleton className="h-[760px]" />
        </div>
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this lead" />;
  const d = q.data;
  const open = d.lead.status === "OPEN";
  const current = d.stages.find((s) => s.status === "CURRENT")?.key ?? null;

  const doComplete = async (stage: LeadStage) => {
    try {
      const r = await complete.mutateAsync({ stage });
      setFinishOpen(false);
      openNode(null);
      // Let the drawer slide away first, so the chain animation is seen.
      setTimeout(() => setCelebrate(stage), 220);
      toast(r.lead.status === "COMPLETED" ? `${r.order.orderNo} completed: the client approved the rate card.` : `${STAGE_META[stage].label} completed. ${STAGE_META[r.lead.stage].label} is next.`);
    } catch (e) {
      toast(errorMessage(e), "error");
      q.refetch();
    }
  };
  const doBack = async () => {
    if (!current) return;
    try {
      const r = await back.mutateAsync({ stage: current, note: backNote.trim() || undefined });
      setBackOpen(false);
      setBackNote("");
      openNode(null);
      toast(`Moved back to ${STAGE_META[r.lead.stage].label}.`);
    } catch (e) {
      toast(errorMessage(e), "error");
      q.refetch();
    }
  };

  const doReopen = () => reopen.mutateAsync().then(() => toast("Lead reopened"), (e) => toast(errorMessage(e), "error"));

  const stageState = selected && selected !== "HANDOVER" ? d.stages.find((s) => s.key === selected) : undefined;
  const isCurrent = !!stageState && stageState.status === "CURRENT" && open;
  const wide = selected === "RATE_CARD" || selected === "NEGOTIATION";
  const title = selected === "HANDOVER" ? HANDOVER_META.label : selected ? `${stageState?.number}. ${STAGE_META[selected].label}` : "";

  const body = (() => {
    if (!selected) return null;
    if (selected === "HANDOVER") return <HandoverPanel detail={d} />;
    const reached = stageState && (stageState.status === "DONE" || stageState.status === "CURRENT");
    if (selected === "NEW_LEAD") return <NewLeadDone detail={d} canWrite={canWrite} />;
    if (!reached || !stageState.available) return <StageInfo stage={selected} detail={d} />;
    if (selected === "CLIENT_REGISTERED") return <ClientRegisteredPanel detail={d} canWrite={canWrite} />;
    if (selected === "REQUIREMENT_DISCUSSION") return <RequirementPanel detail={d} canWrite={canWrite} />;
    if (selected === "RATE_CARD") return <RateCardPanel detail={d} />;
    if (selected === "NEGOTIATION") return <NegotiationPanel orderId={d.order._id} />;
    if (selected === "CLIENT_APPROVAL") return <ApprovalTab orderId={d.order._id} inLead />;
    return <StageInfo stage={selected} detail={d} />;
  })();

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <LeadHeader detail={d} />
      {d.lead.status === "COMPLETED" && <CompletedBanner detail={d} />}
      <div className="2xl:hidden">
        <LeadStrip
          detail={d}
          canWrite={canWrite}
          onOpen={openNode}
          onBack={() => setBackOpen(true)}
          onClose={() => setCloseOpen(true)}
          onReopen={doReopen}
          onHistory={() => setHistoryOpen(true)}
        />
      </div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
        <motion.div layout className="min-w-0">
          <Canvas>
            <LeadMindMap
              stages={d.stages}
              handover={d.handover}
              closed={d.lead.status === "CLOSED"}
              celebrate={celebrate}
              badges={{
                REQUIREMENT_DISCUSSION: d.summary.notes ? String(d.summary.notes) : undefined,
                RATE_CARD: d.summary.rateCardLabel ?? undefined,
                NEGOTIATION: d.summary.negotiationRounds ? `${d.summary.negotiationRounds} round${d.summary.negotiationRounds === 1 ? "" : "s"}` : undefined,
                CLIENT_APPROVAL: d.summary.approvalDocuments ? `${d.summary.approvalDocuments} doc${d.summary.approvalDocuments === 1 ? "" : "s"}` : undefined,
              }}
              onOpen={openNode}
            />
          </Canvas>
        </motion.div>
        <div className="hidden 2xl:block">
          <SidePanel detail={d} canWrite={canWrite} onOpen={openNode} onBack={() => setBackOpen(true)} onClose={() => setCloseOpen(true)} onReopen={doReopen} />
        </div>
      </div>

      <Modal open={historyOpen} onOpenChange={setHistoryOpen} title="Lead History" description={`${d.order.orderNo} · every stage move, newest first`}>
        <HistoryList history={d.history} />
      </Modal>

      <Modal
        open={!!selected}
        onOpenChange={(o) => {
          if (o) return;
          openNode(null);
          // The handover tab updates the order; refresh the lead so its branch shows the assignment.
          if (selected === "HANDOVER") q.refetch();
        }}
        variant="drawer"
        className={wide ? "max-w-[min(1500px,100vw)]" : selected === "CLIENT_REGISTERED" || selected === "CLIENT_APPROVAL" ? "max-w-6xl" : "max-w-4xl"}
        title={title}
        description={selected === "HANDOVER" ? "Client, contact persons, shop list and documents for Client Servicing. Runs alongside the rate card." : d.order.orderNo + " · " + d.order.client.name}
        footer={
          isCurrent && canWrite && selected && selected !== "HANDOVER" && selected !== "NEW_LEAD" ? (
            <StageFooter
              detail={d}
              stage={selected}
              completing={complete.isPending}
              onComplete={() => (d.lastStage ? setFinishOpen(true) : doComplete(selected))}
              onBack={() => setBackOpen(true)}
            />
          ) : undefined
        }
      >
        {isCurrent && selected !== "RATE_CARD" && <div className="mb-4"><MissingList missing={d.missing} /></div>}
        {body}
      </Modal>

      <ConfirmDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title={`Complete ${d.order.orderNo}?`}
        description={`The client approved rate card ${d.summary.rateCardLabel ?? ""}. The lead is marked completed and the rate card and approval documents are locked.`}
        confirmLabel="Approve & Complete Lead"
        loading={complete.isPending}
        autoClose={false}
        onConfirm={() => current && doComplete(current)}
      />

      <ConfirmDialog
        open={backOpen}
        onOpenChange={setBackOpen}
        title={d.previousStage ? `Move back to ${STAGE_META[d.previousStage].label}?` : "Move back?"}
        description="The lead goes back one stage. Saved notes, files and rate cards are kept, and the move is recorded in the lead history."
        confirmLabel="Move Back"
        loading={back.isPending}
        autoClose={false}
        onConfirm={doBack}
      >
        <Field label="Reason (optional)" htmlFor="back-note">
          <Textarea id="back-note" maxLength={1000} value={backNote} onChange={(e) => setBackNote(e.target.value)} placeholder="e.g. Client changed the requirement" />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={`Close ${d.order.orderNo}?`}
        description="A closed lead cannot move or take notes until it is reopened. Everything saved on it is kept."
        confirmLabel="Close Lead"
        destructive
        loading={close.isPending}
        autoClose={false}
        onConfirm={async () => {
          if (closeReason.trim().length < 3) return toast("Enter why the lead is closed", "error");
          try {
            await close.mutateAsync(closeReason.trim());
            setCloseOpen(false);
            setCloseReason("");
            toast("Lead closed");
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      >
        <Field label="Reason" htmlFor="close-reason" required>
          <Textarea id="close-reason" maxLength={1000} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="e.g. Client postponed the project" />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
