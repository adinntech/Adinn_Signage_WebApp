"use client";

import { CheckCircle2, Clock3, XCircle, type LucideIcon } from "lucide-react";
import type { TrackStatus } from "@/lib/api/projectTracking";
import { cn } from "@/lib/utils";

/** Project Tracking accent (first reference design): professional red on white, charcoal text. */
export const RED = "#D92D20";
export const VENDOR = "#7C3AED";
export const INHOUSE = "#2563EB";

export const STATUS: Record<TrackStatus, { label: string; color: string; bg: string }> = {
  NOT_ALLOCATED: { label: "Not allocated", color: "#64748B", bg: "#F1F5F9" },
  NOT_STARTED: { label: "Yet to Start", color: "#64748B", bg: "#F1F5F9" },
  IN_PROGRESS: { label: "In Progress", color: "#B45309", bg: "#FFFBEB" },
  SUBMITTED: { label: "Yet to Review", color: "#1D4ED8", bg: "#EFF6FF" },
  REWORK: { label: "Rework Required", color: "#B91C1C", bg: "#FEF2F2" },
  REJECTED: { label: "Rejected", color: "#B91C1C", bg: "#FEF2F2" },
  COMPLETED: { label: "Approved", color: "#047857", bg: "#ECFDF5" },
};

export function StatusBadge({ status, className }: { status: TrackStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", className)} style={{ color: s.color, background: s.bg }}>
      <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}

/** Member / branch state icon: all done (green tick), any rejected (red cross), otherwise pending (amber clock). */
export function stateOf(t: { assigned: number; completed: number; rejected: number }): { Icon: LucideIcon; color: string; label: string } {
  if (t.assigned > 0 && t.completed === t.assigned) return { Icon: CheckCircle2, color: "#16A34A", label: "All completed" };
  if (t.rejected > 0) return { Icon: XCircle, color: "#DC2626", label: "Has rejected shops" };
  return { Icon: Clock3, color: "#F59E0B", label: "Pending" };
}

export const fmtAt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
/** "Today, 11:42 AM" / "Yesterday, …" / date. */
export function fmtWhen(d: string) {
  const t = new Date(d);
  const day = (x: Date) => x.toDateString();
  const time = t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const y = new Date(now.getTime() - 86400_000);
  return day(t) === day(now) ? `Today, ${time}` : day(t) === day(y) ? `Yesterday, ${time}` : `${fmtDate(d)}, ${time}`;
}

export function Bar({ value, color = "#16A34A", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[#EEF2F6]", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}
