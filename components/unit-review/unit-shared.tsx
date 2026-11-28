import type { ReviewBoard, ReviewUnit, UnitReviewEntry, UnitStatus, Workspace } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";

/** What the unit review needs from a review workspace (Recce Review and Project Approval both send it). */
export type UnitWs = Pick<Workspace, "id" | "status" | "me" | "project" | "categories" | "boards" | "unitPhotoCategories"> & {
  checklist: { key: string; label: string; required?: boolean }[];
};

const REVIEWABLE = ["SUBMITTED", "UNDER_REVIEW"];

export const unitTitle = (b: ReviewBoard, u: ReviewUnit) => `${b.name} · ${u.unitId ?? u.key ?? `Unit ${u.unitNo}`}`;
export const catLabel = (w: Pick<Workspace, "categories">, key: string) => w.categories.find((c) => c.key === key)?.label ?? key;
export const allUnits = (w: Pick<Workspace, "boards">) => (w.boards ?? []).flatMap((board) => board.units.map((unit) => ({ board, unit })));

/** My stage's review on the unit's current version. */
export const myReviewOf = (w: UnitWs, u: ReviewUnit) => (w.me.stage ? u.versions.at(-1)?.reviews.find((r) => r.stage === w.me.stage) : undefined);
/** Can the signed-in reviewer decide this unit now? */
export const canDecide = (w: UnitWs, u: ReviewUnit) =>
  !!w.me.stage && REVIEWABLE.includes(w.status) && !w.project.closed && ["SUBMITTED", "UNDER_REVIEW"].includes(u.status) && myReviewOf(w, u)?.decision === "PENDING";

export const UNIT_LOOK: Record<UnitStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Not submitted", color: "#64748B", bg: "#F1F5F9" },
  SUBMITTED: { label: "Yet to Review", color: "#1D4ED8", bg: "#EFF6FF" },
  UNDER_REVIEW: { label: "Under review", color: "#B45309", bg: "#FFFBEB" },
  APPROVED: { label: "Approved", color: "#047857", bg: "#ECFDF5" },
  REWORK: { label: "Rework", color: "#B91C1C", bg: "#FEF2F2" },
  REJECTED: { label: "Rejected", color: "#B91C1C", bg: "#FEF2F2" },
};
export const DECISION_LOOK: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-[#FFFBEB] text-[#B45309]" },
  APPROVED: { label: "Approved", cls: "bg-[#ECFDF5] text-[#047857]" },
  REJECTED: { label: "Rejected", cls: "bg-[#FEF2F2] text-[#B91C1C]" },
  VOID: { label: "Not needed", cls: "bg-[#F3F4F6] text-[#6B7280]" },
  REVERTED: { label: "Reverted", cls: "bg-[#FFF7ED] text-[#C2410C]" },
};
const VERB: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", REVERTED: "Reverted" };

/** 18 Nov 2026, 06:13 PM in India time. */
export const fmtIst = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase()) : "Not recorded";
/** A person's name without the technical "(login)" suffix of field logins. */
export const personName = (n: string | null | undefined) => (n ? n.replace(/\s*\(login\)\s*$/i, "").trim() || null : null);
/** The real decisions on a review list (no pending / "not needed" entries), oldest first. */
export const decisionsOf = (reviews: UnitReviewEntry[]) => reviews.filter((r) => VERB[r.decision]);
/** The decision that sets the unit's current state: the latest real decision on its current version. */
export const latestDecision = (u: ReviewUnit) => decisionsOf(u.versions.at(-1)?.reviews ?? []).at(-1);
/** Can the signed-in reviewer take back this unit's approval? */
// Any CS / OPS reviewer, whoever approved it, and whatever the other boards of the shop are doing (the shop can be in rework).
export const canRevert = (w: UnitWs, u: ReviewUnit) => !!w.me.stage && !w.project.closed && u.status === "APPROVED";

/**
 * Who decided the unit, as stored: "CS Approved · Approved by Vignesh · 28 Nov 2026, 12:34 PM". Nothing for a unit still
 * waiting (its status badge says Yet to Review). Same for CS and OPS logins.
 */
export function ReviewerInfo({ unit, compact, className }: { unit: ReviewUnit; compact?: boolean; className?: string }) {
  const r = latestDecision(unit);
  if (!r) return null;
  const verb = VERB[r.decision]!;
  const who = personName(r.reviewer) ?? "Not recorded";
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#6B7280]", className)}>
      <DecisionChip stage={r.stage} decision={r.decision} />
      {compact ? (
        <span className="min-w-0 break-words">{who} · {fmtIst(r.decidedAt)}</span>
      ) : (
        <>
          <span><span className="font-medium text-[#374151]">{verb} by:</span> {who}</span>
          <span><span className="font-medium text-[#374151]">{verb} on:</span> {fmtIst(r.decidedAt)}</span>
        </>
      )}
    </span>
  );
}

export function UnitBadge({ status, className }: { status: UnitStatus; className?: string }) {
  const s = UNIT_LOOK[status] ?? UNIT_LOOK.DRAFT;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", className)} style={{ color: s.color, background: s.bg }}>
      <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden />{s.label}
    </span>
  );
}
export function DecisionChip({ stage, decision }: { stage: string; decision: string }) {
  const d = DECISION_LOOK[decision] ?? DECISION_LOOK.PENDING!;
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", d.cls)}>{stage} {d.label}</span>;
}
export const fmtAt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
