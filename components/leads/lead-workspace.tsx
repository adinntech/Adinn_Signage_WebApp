"use client";

import { useEffect, useLayoutEffect, useState } from "react";
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
  LockKeyhole,
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
import { OrderClientForm } from "@/components/orders/create-order-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { downloadFile } from "@/lib/api/files";
import {
  LEAD_FLOW,
  LEAD_STAGES,
  useCloseLead,
  useCompleteLeadStage,
  useLead,
  usePreviousLeadStage,
  useReopenLead,
  type LeadDetail,
  type LeadHistoryEntry,
  type LeadStage,
  type LeadStageState,
} from "@/lib/api/leads";
import { useAuth } from "@/lib/auth";
import type { ClientType } from "@/lib/api/clients";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AssignChooser } from "./assign-panels";
import { RecceBranchPanel, type RecceStep } from "./recce-panel";
import { LeadMindMap, type AssignState, type MapNode } from "./lead-mind-map";
import { nextStepOf, resolveStep } from "./assign-steps";
import { ASSIGN_META, CLIENT_META, STAGE_META } from "./stage-meta";
import { ApprovalTab } from "@/components/sales/approval-tab";
import { NegotiationPanel } from "./negotiation-panel";
import { ClientRegisteredPanel, HandoverPanel, MissingList, NewLeadDone, RateCardPanel, RequirementPanel, StageInfo } from "./stage-panels";

const CELEBRATE_MS = 2600;

/** Before a lead exists (Create Project screen): stage 1 in progress, the rest waiting. */
const BLANK_STAGES: LeadStageState[] = LEAD_FLOW.map((key, i) => ({
  key,
  label: STAGE_META[key].label,
  number: i + 1,
  status: key === "NEW_LEAD" ? "CURRENT" : "PENDING",
  available: true,
  startedAt: null,
  completedAt: null,
  completedBy: null,
}));
const BLANK_ASSIGN: AssignState = { unlocked: false, completed: false, cs: { assignee: null, assignedAt: null }, recce: { available: true, assignee: null, assignedAt: null } };

/** Project Assign branches of a lead, for the mind map. */
const assignOf = (d: LeadDetail): AssignState => ({
  unlocked: d.lead.status === "OPEN" && d.lead.stage === "PROJECT_ASSIGN",
  completed: d.lead.status === "COMPLETED",
  completedAt: d.lead.completedAt ?? null,
  cs: {
    assignee: d.handover.assignee,
    assignedAt: d.handover.assignedAt,
    updatedAt: d.handover.updatedAt ?? null,
    type: d.handover.type,
    full: d.handover.full,
    shops: d.handover.shops,
    ready: d.handover.ready,
    missing: d.handover.missing,
  },
  recce: d.recce,
  route: d.route ?? null,
});
const isBranch = (k: string | null): k is "HANDOVER" | "RECCE" => k === "HANDOVER" || k === "RECCE";

function historyText(h: LeadHistoryEntry) {
  const to = h.toStage ? STAGE_META[h.toStage].short : "";
  const from = h.fromStage ? STAGE_META[h.fromStage].short : "";
  if (h.action === "START") {
    // The client branch the user selected (saved on the entry, or from saved client data for older entries).
    const sel = (h.newValue ?? null) as { clientType?: string | null; name?: string | null } | null;
    const branch = sel?.clientType === "NEW" ? "New Client" : sel?.clientType === "EXISTING" ? "Existing Client" : "Client";
    return `${branch} selected${sel?.name ? `: ${sel.name}` : ""}`;
  }
  if (h.action === "COMPLETE" && h.fromStage === "NEW_LEAD") return "Project created";
  if (h.action === "COMPLETE") return h.toStage ? `${from} completed → ${to}` : "Project assigned: lead completed";
  if (h.action === "BACK") return `Moved back: ${from} → ${to}`;
  if (h.action === "CLOSE") return `Lead closed${h.note ? `: ${h.note}` : ""}`;
  if (h.action === "REOPEN") return "Lead reopened";
  if (h.action === "STEP" || h.action === "CLIENT_CHANGE") return h.note ?? h.action;
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

/** Shown once the project is assigned (lead completed). */
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
        <p className="font-semibold text-success">Lead completed: the project is assigned</p>
        <p className="text-sm text-muted-foreground">
          {detail.lead.completedBy?.name ?? "-"} · {formatDateTimeIST(detail.lead.completedAt)}
          {detail.handover.assignee ? ` · assigned to Client Servicing (${detail.handover.assignee.name})` : detail.recce.assignee ? ` · assigned to the Recce team (${detail.recce.assignee.name})` : ""}
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
            { icon: CalendarDays, label: "Created Date", value: formatDateTimeIST(lead.startedAt) },
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
        {!open && lead.closeReason && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">Closed {formatDateTimeIST(lead.closedAt)}: {lead.closeReason}</p>}
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
                    {s.status === "DONE" ? formatDateTimeIST(s.completedAt) : s.status === "CURRENT" ? <span style={{ color: m.color }}>In Progress</span> : s.status === "SKIPPED" ? "Skipped" : "Pending"}
                  </span>
                </button>
              </li>
            );
          })}
          {(["HANDOVER", "RECCE"] as const).map((k) => {
            const m = ASSIGN_META[k];
            const b = k === "HANDOVER" ? detail.handover : detail.recce;
            const ready = k === "HANDOVER" ? detail.handover.unlocked : detail.recce.available && detail.handover.unlocked;
            const other = k === "HANDOVER" ? detail.recce.assignee : detail.handover.assignee;
            return (
              <li key={k} className="pl-4">
                <button type="button" onClick={() => onOpen(k)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-muted">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: b.assignee || (ready && !other) ? m.color : "#94a3b8" }}>
                    <m.icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.short}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{b.assignee ? b.assignee.name : other ? "Not needed" : ready ? "Ready" : "Locked"}</span>
                </button>
              </li>
            );
          })}
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
          { icon: CalendarDays, label: "Created", value: formatDateTimeIST(lead.startedAt) },
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
      {!open && lead.closeReason && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">Closed {formatDateTimeIST(lead.closedAt)}: {lead.closeReason}</p>}
    </Card>
  );
}

/** `large`: the Lead History window (readable sizes); the side panel keeps the compact list. */
function HistoryList({ history, large = false }: { history: LeadHistoryEntry[]; large?: boolean }) {
  return (
    <ol className={large ? "space-y-4" : "space-y-2.5"}>
      {history.map((h) => (
        <li key={h.id} className={large ? "border-l-2 border-border pl-4 leading-relaxed" : "border-l-2 border-border pl-3 text-xs"}>
          <p className={cn("font-medium text-foreground", large && "break-words text-[15px]")}>{historyText(h)}</p>
          {h.action === "BACK" && h.note && <p className={cn("text-muted-foreground", large && "text-sm")}>Reason: {h.note}</p>}
          <p className={cn("text-muted-foreground", large && "mt-0.5 text-sm")}>
            {h.by || "-"} · {formatDateTimeIST(h.at)}
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
          (last ? "Completing this stage completes the lead." : next && !detail.nextAvailable ? `${STAGE_META[next].label} opens in the next Lead Management update.` : next ? `Next: ${STAGE_META[next].label}` : "")}
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
              <BadgeCheck className="size-4" aria-hidden /> Complete Lead
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
            "Create Project"
          )}
        </h1>
        <p className="text-sm text-muted-foreground">From creating the project to assigning it to Client Servicing or the Recce team, as a mind map. Click a stage to work on it.</p>
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

/** Create Project drawer, first step: New Client or Existing Client. */
function ClientChooser({ onPick }: { onPick: (f: ClientType) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Who is the project for? Choose the client type, then select the company.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["NEW", "EXISTING"] as const).map((f, i) => {
          const m = CLIENT_META[f];
          return (
            <motion.button
              key={f}
              type="button"
              onClick={() => onPick(f)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="group flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: m.color, background: `linear-gradient(135deg, ${m.soft}, #ffffff 70%)` }}
            >
              <span className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full text-white" style={{ background: m.color }}>
                  <m.icon className="size-6" aria-hidden />
                </span>
                <span className="text-base font-semibold text-primary">{m.label}</span>
              </span>
              <ul className="space-y-1.5">
                {m.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 shrink-0" style={{ color: m.color }} aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold" style={{ color: m.color }}>
                Select <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Create Project (NEW_LEAD): New Client (Client Management) or Existing Client (Zoho), then the company; saving creates
 * the order and its lead, completes Create Project and opens the lead at Project Assign.
 */
export function NewLeadWorkspace() {
  const router = useRouter();
  const [drawer, setDrawer] = useState(true);
  const [flag, setFlag] = useState<ClientType | null>(null);
  /** Client to pre-pick after a switch (a New Client GSTIN that is a Zoho customer -> Existing Client). */
  const [seed, setSeed] = useState<SearchOption>();

  // Next keeps visited routes mounted (React Activity): start again from the client choice on every visit.
  useLayoutEffect(
    () => () => {
      setDrawer(true);
      setFlag(null);
    },
    [],
  );

  const pick = (f: ClientType) => {
    setSeed(undefined);
    setFlag(f);
    setDrawer(true);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <LeadHeader detail={null} />
      <Canvas>
        <LeadMindMap
          stages={BLANK_STAGES}
          assign={BLANK_ASSIGN}
          client={{ flag, done: false }}
          onOpen={(k) => k === "NEW_LEAD" && setDrawer(true)}
          onClientOpen={pick}
        />
      </Canvas>
      <Modal
        open={drawer}
        onOpenChange={setDrawer}
        variant="drawer"
        className="max-w-3xl"
        title={flag ? `1. Create Project · ${CLIENT_META[flag].label}` : "1. Create Project"}
        description={
          flag
            ? "Select the company. Saving creates the order and moves the lead to Project Assign."
            : "Choose New Client or Existing Client to start."
        }
      >
        {flag ? (
          <OrderClientForm
            key={flag}
            fixedFlag={flag}
            onChangeFlag={() => {
              setSeed(undefined);
              setFlag(null);
            }}
            onFlagChange={(f, p) => {
              setSeed(p);
              setFlag(f);
            }}
            initialPick={seed}
            withNotes
            submitLabel="Save & Create Order"
            onCancel={() => setDrawer(false)}
            onCreated={(o) => {
              setDrawer(false);
              // Straight on to Project Assign: the lead opens with its drawer, so the BD picks a route without extra clicks.
              router.replace(`/leads/${o._id}?fresh=1&stage=PROJECT_ASSIGN`);
            }}
          />
        ) : (
          <ClientChooser onPick={setFlag} />
        )}
      </Modal>
    </div>
  );
}

/** When the lead's client was last saved: the order's creation (Create Project done), or a later Change Client. */
const clientSavedAt = (d: LeadDetail) =>
  [d.stages.find((s) => s.key === "NEW_LEAD")?.completedAt, ...d.history.filter((h) => h.action === "CLIENT_CHANGE").map((h) => h.at)]
    .filter((x): x is string => !!x)
    .sort()
    .at(-1) ?? null;

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
  const selected: MapNode | null = asked && (isBranch(asked) || (LEAD_STAGES as readonly string[]).includes(asked)) ? asked : null;
  // `step`: a step of a Project Assign branch; its drawer opens scrolled to that section.
  const openNode = (k: MapNode | null, step?: string) =>
    router.replace(k ? `/leads/${id}?stage=${k}${step && isBranch(k) ? `&step=${encodeURIComponent(step)}` : ""}` : `/leads/${id}`, { scroll: false });
  const step = isBranch(selected) ? params.get("step") : null;
  const blocked = (why: string) => toast(why, "info");
  const fresh = params.get("fresh") === "1";

  // Arriving from Create Project: play the stage 1 completion once, then drop the flag (keeping the open drawer).
  const [freshSeen, setFreshSeen] = useState(false);
  if (fresh && !freshSeen) {
    setFreshSeen(true);
    setCelebrate("NEW_LEAD");
  }
  useEffect(() => {
    if (fresh) router.replace(`/leads/${id}${asked ? `?stage=${asked}` : ""}`, { scroll: false });
  }, [fresh, id, router, asked]);
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
      toast(r.lead.status === "COMPLETED" ? `${r.order.orderNo} completed: the project is assigned.` : `${STAGE_META[stage].label} completed. ${STAGE_META[r.lead.stage].label} is next.`);
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

  const stageState = selected && !isBranch(selected) ? d.stages.find((s) => s.key === selected) : undefined;
  const isCurrent = !!stageState && stageState.status === "CURRENT" && open;
  const wide = selected === "RATE_CARD" || selected === "NEGOTIATION";
  // A branch drawer shows one step: the one asked for when it may be opened, else why not.
  const branchStep = isBranch(selected) ? resolveStep(assignOf(d), selected, step) : null;
  const title =
    isBranch(selected) && branchStep
      ? `${ASSIGN_META[selected].short} · ${branchStep.history ? "Email History" : branchStep.step.label}`
      : selected && !isBranch(selected)
        ? `${stageState?.number ?? ""}. ${STAGE_META[selected].label}`
        : "";

  /** A branch step is complete: reload, then open the next step (Continue) or close and say what is next. */
  const finishStep = async (k: "HANDOVER" | "RECCE", from: string, openNext: boolean) => {
    const r = await q.refetch();
    const next = r.data ? nextStepOf(assignOf(r.data), k, from) : null;
    openNode(openNext && next ? k : null, openNext && next ? next.step : undefined);
    if (next) toast(`Next: ${next.label}`);
  };
  const assigned = () => {
    // Assigning completes the lead: close the drawer and run the branch into Lead Completed.
    openNode(null);
    void q.refetch().then(() => setCelebrate("PROJECT_ASSIGN"));
  };

  const body = (() => {
    if (!selected) return null;
    if (isBranch(selected)) {
      if (!branchStep) return null;
      if (branchStep.blocked) return <EmptyState icon={LockKeyhole} title="Not open yet" description={branchStep.blocked} />;
      if (selected === "RECCE") {
        const s = (branchStep.history ? "history" : branchStep.step.step) as RecceStep;
        return <RecceBranchPanel key={s} detail={d} step={s} onDone={() => void finishStep("RECCE", s, s === "handover" || s === "email" || s === "codes")} onAssigned={assigned} />;
      }
      return (
<HandoverPanel key={branchStep.step.step} detail={d} onAssigned={assigned} />
      );
    }
    const reached = stageState && (stageState.status === "DONE" || stageState.status === "CURRENT");
    if (selected === "NEW_LEAD") return <NewLeadDone detail={d} canWrite={canWrite} />;
    if (selected === "PROJECT_ASSIGN") return <AssignChooser detail={d} onOpen={openNode} />;
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
              assign={assignOf(d)}
              client={{ flag: d.order.clientType, done: true, name: d.order.client.name, at: clientSavedAt(d) }}
              closed={d.lead.status === "CLOSED"}
              celebrate={celebrate}
              badges={{
                REQUIREMENT_DISCUSSION: d.summary.notes ? String(d.summary.notes) : undefined,
                RATE_CARD: d.summary.rateCardLabel ?? undefined,
                NEGOTIATION: d.summary.negotiationRounds ? `${d.summary.negotiationRounds} round${d.summary.negotiationRounds === 1 ? "" : "s"}` : undefined,
                CLIENT_APPROVAL: d.summary.approvalDocuments ? `${d.summary.approvalDocuments} doc${d.summary.approvalDocuments === 1 ? "" : "s"}` : undefined,
              }}
              onOpen={openNode}
              onBlocked={blocked}
            />
          </Canvas>
        </motion.div>
        <div className="hidden 2xl:block">
          <SidePanel detail={d} canWrite={canWrite} onOpen={openNode} onBack={() => setBackOpen(true)} onClose={() => setCloseOpen(true)} onReopen={doReopen} />
        </div>
      </div>

      <Modal open={historyOpen} onOpenChange={setHistoryOpen} title="Lead History" titleClassName="text-lg" className="max-w-2xl" description={`${d.order.orderNo} · every stage move, newest first`}>
        <HistoryList history={d.history} large />
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
        className={wide ? "max-w-[min(1500px,100vw)]" : selected === "CLIENT_REGISTERED" || selected === "CLIENT_APPROVAL" || selected === "HANDOVER" || selected === "RECCE" ? "max-w-6xl" : "max-w-4xl"}
        title={title}
        description={
          selected === "HANDOVER"
            ? `${d.order.orderNo} · client, contact persons, shop list and documents for Client Servicing`
            : selected === "RECCE"
              ? `${d.order.orderNo} · project code request, codes, handover and the Recce person`
              : d.order.orderNo + " · " + d.order.client.name
        }
        footer={
          // Project Assign completes itself when a branch is assigned, so it has no Complete button.
          isCurrent && canWrite && selected && !isBranch(selected) && selected !== "NEW_LEAD" && selected !== "PROJECT_ASSIGN" ? (
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
        description="The project is assigned, so the lead is marked completed."
        confirmLabel="Complete Lead"
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
