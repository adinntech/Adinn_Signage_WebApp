import { Badge } from "@/components/ui/badge";
import type { ClientType } from "@/lib/api/clients";

/** New / Existing client flag. `full` reads "New Client" / "Existing Client" (Order Management). */
export function ClientTypeBadge({ type, full }: { type: ClientType; full?: boolean }) {
  const suffix = full ? " Client" : "";
  return type === "NEW" ? <Badge className="bg-warning-soft text-warning">New{suffix}</Badge> : <Badge tone="success">Existing{suffix}</Badge>;
}
