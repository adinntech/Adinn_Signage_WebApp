import { ROLE_LABELS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground",
        className,
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
