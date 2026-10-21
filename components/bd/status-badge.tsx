import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/pipeline";

export function ProjectStatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge tone={m.tone}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {m.label}
    </Badge>
  );
}
