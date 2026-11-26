import type { ReactNode } from "react";
import { CheckCircle2, Clock, Eye, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section card of the Project Approval screens: white, thin border, red accent bar before the title (Adinn accent). */
export function Section({ title, extra, action, children, className, bodyClassName }: { title: string; extra?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(16,36,73,0.04)]", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#172B4D]">
          <span className="h-4 w-1 rounded-full bg-loss" aria-hidden />
          {title}
          {extra && <span className="text-xs font-normal text-muted-foreground">{extra}</span>}
        </h2>
        {action}
      </header>
      <div className={cn("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

type Look = { label: string; cls: string; icon: LucideIcon };
const GREEN = "bg-[#ECFDF5] text-[#047857] ring-[#A7F3D0]";
const AMBER = "bg-[#FFFBEB] text-[#B45309] ring-[#FDE68A]";
const RED = "bg-[#FEF2F2] text-[#B91C1C] ring-[#FECACA]";
const BLUE = "bg-[#EFF6FF] text-[#1D4ED8] ring-[#BFDBFE]";
const GREY = "bg-[#F1F5F9] text-[#475569] ring-[#E2E8F0]";

/** One stage's decision (Client Servicing or Operations) on the current version. REWORK = rejected and sent back for correction. */
export const DECISION_LOOK: Record<string, Look> = {
  APPROVED: { label: "Approved", cls: GREEN, icon: CheckCircle2 },
  PENDING: { label: "Pending", cls: AMBER, icon: Clock },
  REJECTED: { label: "Rejected", cls: RED, icon: XCircle },
  REWORK: { label: "Rejected", cls: RED, icon: RotateCcw },
  VOID: { label: "Not needed", cls: GREY, icon: Clock },
};
/** Overall shop status. */
export const STATUS_LOOK: Record<string, Look> = {
  IN_PROGRESS: { label: "In Progress", cls: GREY, icon: Clock },
  SUBMITTED: { label: "Submitted", cls: BLUE, icon: Eye },
  UNDER_REVIEW: { label: "Under Review", cls: BLUE, icon: Eye },
  APPROVED: { label: "Approved", cls: GREEN, icon: CheckCircle2 },
  REWORK_REQUIRED: { label: "Sent back", cls: RED, icon: RotateCcw },
  REJECTED: { label: "Rejected", cls: RED, icon: XCircle },
};
export const VISIT_LOOK: Record<string, Look> = {
  NOT_ALLOCATED: { label: "Not allocated", cls: GREY, icon: Clock },
  NOT_STARTED: { label: "Not started", cls: GREY, icon: Clock },
  VISITED: { label: "Visited", cls: BLUE, icon: Eye },
  IN_PROGRESS: { label: "In progress", cls: BLUE, icon: Clock },
  SUBMITTED: { label: "Submitted", cls: BLUE, icon: Eye },
  COMPLETED: { label: "Completed", cls: GREEN, icon: CheckCircle2 },
  REWORK: { label: "Rework", cls: AMBER, icon: RotateCcw },
  REJECTED: { label: "Rejected", cls: RED, icon: XCircle },
};

export function Pill({ look, title, className }: { look?: Look; title?: string; className?: string }) {
  if (!look) return <span className="text-muted-foreground">-</span>;
  const Icon = look.icon;
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", look.cls, className)}>
      <Icon className="size-3.5" aria-hidden />
      {look.label}
    </span>
  );
}

export const STAGE_NAME = { CS: "Client Servicing", OPS: "Operations" } as const;

export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
export const fmtDay = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
export const fmtGps = (lat?: number | null, lng?: number | null) => (lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "-");

/** Thin progress bar with a percentage. */
export function Progress({ value, className, color = "bg-finance" }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-[#EEF2F7]" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${v}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-medium tabular-nums text-[#334155]">{v}%</span>
    </div>
  );
}
