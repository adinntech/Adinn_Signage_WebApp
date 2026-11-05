import { BadgeCheck, Building2, ClipboardCheck, Flag, FolderKanban, HardHat, Handshake, ListChecks, type LucideIcon } from "lucide-react";
import type { StageKey, StageState } from "@/lib/api/journey";

export const STAGE_ICON: Record<StageKey, LucideIcon> = {
  HANDOVER: Handshake,
  CLIENT_CODE: Building2,
  PROJECT_CODE: FolderKanban,
  RECCE_ASSIGNED: ClipboardCheck,
  PLANNING: ListChecks,
  FIELD_RECCE: HardHat,
  CLIENT_APPROVAL: BadgeCheck,
  COMPLETED: Flag,
};

/** One colour language for every journey view: green done, orange current, purple waiting, red blocked, grey not applicable. */
export const STATE_META: Record<StageState, { label: string; color: string; soft: string; ring: string }> = {
  COMPLETED: { label: "Completed", color: "#059669", soft: "#e2f8ea", ring: "#bdebcc" },
  IN_PROGRESS: { label: "In Progress", color: "#F59E0B", soft: "#fff3dc", ring: "#ffd9b0" },
  PENDING: { label: "Pending", color: "#7c5cd6", soft: "#f1e6ff", ring: "#ddc4fb" },
  BLOCKED: { label: "Blocked", color: "#DC2626", soft: "#ffe8e8", ring: "#ffc9c9" },
  NOT_APPLICABLE: { label: "Not applicable", color: "#94a3b8", soft: "#f1f5f9", ring: "#e2e8f0" },
};

export const dayLabel = (n: number | null) => (n === null ? "-" : n === 0 ? "Today" : `${n} day${n === 1 ? "" : "s"}`);
