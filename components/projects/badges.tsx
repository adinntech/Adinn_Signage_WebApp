import { Badge, type Tone } from "@/components/ui/badge";
import { label } from "@/lib/format";

const STATUS_TONE: Record<string, Tone> = {
  NEW: "info",
  ACTIVE: "success",
  ON_HOLD: "warning",
  COMPLETED: "primary",
  CANCELLED: "danger",
};
const PRIORITY_TONE: Record<string, Tone> = {
  LOW: "neutral",
  MEDIUM: "primary",
  HIGH: "warning",
  URGENT: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{label(status)}</Badge>;
}
export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"}>{label(priority)}</Badge>;
}
