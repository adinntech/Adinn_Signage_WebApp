import type { Project, RequirementType } from "@/lib/api/projects";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

/** One status vocabulary for BD and Operations. Operations stages are just these statuses. */
export const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  NEW: { label: "Enquiry", tone: "warning" },
  ENQUIRY: { label: "Enquiry", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  RECCE_ASSIGNED: { label: "Recce Assigned", tone: "primary" },
  PLANNING: { label: "In Planning", tone: "warning" },
  IN_PROGRESS: { label: "In Progress", tone: "success" },
  CLIENT_APPROVAL: { label: "Client Approval", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "info" },
  ON_HOLD: { label: "On Hold", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  LOSS: { label: "Loss", tone: "danger" },
};
export const statusLabel = (s: string) => STATUS_META[s]?.label ?? s;

/** Operations wording for the same statuses. */
export const OPS_STAGE_LABEL: Record<string, string> = {
  RECCE_ASSIGNED: "New Assigned",
  PLANNING: "In Planning",
  IN_PROGRESS: "In Progress",
  CLIENT_APPROVAL: "Pending Approval",
  COMPLETED: "Completed",
};
export const OPS_NEXT: Record<string, { to: "PLANNING" | "IN_PROGRESS" | "CLIENT_APPROVAL" | "COMPLETED"; label: string }> = {
  RECCE_ASSIGNED: { to: "PLANNING", label: "Start Planning" },
  PLANNING: { to: "IN_PROGRESS", label: "Start Recce" },
  IN_PROGRESS: { to: "CLIENT_APPROVAL", label: "Send for Approval" },
  CLIENT_APPROVAL: { to: "COMPLETED", label: "Mark Completed" },
};

export const REQUIREMENT_LABEL: Record<RequirementType, string> = {
  ASO: "ASO area survey",
  SHOP_DETAILS: "Shop details only",
  SHOP_MEASUREMENT: "Shop + measurement",
};
/** The client's shop count plus any extra shops found during the recce. */
export const totalExpected = (p: { expectedShops?: number | null; additionalShops?: number }) => (p.expectedShops ?? 0) + (p.additionalShops ?? 0);
export const reqLabel =(t?: RequirementType) => (t ? REQUIREMENT_LABEL[t] : "Not set");

export const PRIORITY_LABEL: Record<string, string> = { URGENT: "Urgent", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
export const PRIORITY_CLASS: Record<string, string> = {
  URGENT: "bg-[#ffe8e8] text-loss",
  HIGH: "bg-[#ffe8e8] text-loss",
  MEDIUM: "bg-[#fff0e0] text-approval",
  LOW: "bg-[#e2f8ea] text-finance",
};

const LIVE = new Set(["RECCE_ASSIGNED", "PLANNING", "IN_PROGRESS", "CLIENT_APPROVAL"]);
export const isOverdue = (p: Pick<Project, "status" | "targetDate">) =>
  !!p.targetDate && LIVE.has(p.status) && p.targetDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

/** Mirrors the backend rule for what must be filled before a project can be assigned. */
export function missingForAssignment(p: Pick<Project, "requirementType" | "startDate" | "targetDate" | "district" | "expectedShops" | "contacts">): string[] {
  const m: string[] = [];
  if (!p.requirementType) m.push("requirement type");
  if (!p.startDate) m.push("start date");
  if (!p.targetDate) m.push("expected end date");
  if (!p.district) m.push("district / location");
  if (!p.contacts?.length) m.push("a client contact");
  if (p.requirementType && p.requirementType !== "ASO" && !p.expectedShops) m.push("number of shops");
  return m;
}

export const dateOnly = (v?: string | null) => (v ? v.slice(0, 10) : "");
