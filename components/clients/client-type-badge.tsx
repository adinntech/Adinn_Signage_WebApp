import { Badge } from "@/components/ui/badge";
import type { ClientType } from "@/lib/api/clients";

export function ClientTypeBadge({ type }: { type: ClientType }) {
  return type === "NEW" ? <Badge className="bg-warning-soft text-warning">New</Badge> : <Badge tone="success">Existing</Badge>;
}
