import { AlertTriangle, BadgeCheck, CircleDashed, Clock, Eye, RotateCcw, ShieldX } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Decision, RecceStatus, ReviewStage } from "@/lib/api/recceReview";

/** One look for each status everywhere: a colour AND a text label (never colour alone). */
export const STATUS: Record<RecceStatus, { label: string; tone: Tone; icon: typeof Clock }> = {
  IN_PROGRESS: { label: "In progress", tone: "neutral", icon: CircleDashed },
  SUBMITTED: { label: "Submitted", tone: "info", icon: Clock },
  UNDER_REVIEW: { label: "Under review", tone: "primary", icon: Eye },
  APPROVED: { label: "Approved", tone: "success", icon: BadgeCheck },
  REWORK_REQUIRED: { label: "Rework required", tone: "warning", icon: RotateCcw },
  REJECTED: { label: "Rejected", tone: "danger", icon: ShieldX },
};
export const STAGE_LABEL: Record<ReviewStage, string> = { OPS: "Recce Operations", CS: "Client Servicing" };
export const DECISION: Record<Decision, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REWORK: { label: "Rework", tone: "warning" },
  VOID: { label: "Not needed", tone: "neutral" },
};

export function StatusBadge({ status }: { status: RecceStatus }) {
  const m = STATUS[status];
  const Icon = m.icon;
  return (
    <Badge tone={m.tone}>
      <Icon className="size-3" aria-hidden /> {m.label}
    </Badge>
  );
}
export function DecisionBadge({ decision }: { decision: Decision }) {
  const m = DECISION[decision];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
export function OverdueBadge() {
  return (
    <Badge tone="danger">
      <AlertTriangle className="size-3" aria-hidden /> Overdue
    </Badge>
  );
}

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");
export const fmtDay = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
