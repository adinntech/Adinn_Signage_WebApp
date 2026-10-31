"use client";

import { Badge } from "@/components/ui/badge";
import type { ClientType } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth";

/**
 * New / Existing client flag. `full` reads "New Client" / "Existing Client" (Order Management). Client Servicing
 * (active Create Project flow, Zoho clients only) sees an Existing client as plain "Client".
 */
export function ClientTypeBadge({ type, full }: { type: ClientType; full?: boolean }) {
  const { user } = useAuth();
  const suffix = full ? " Client" : "";
  if (type === "EXISTING" && user?.role === "CLIENT_SERVICING") return <Badge tone="success">Client</Badge>;
  return type === "NEW" ? <Badge className="bg-warning-soft text-warning">New{suffix}</Badge> : <Badge tone="success">Existing{suffix}</Badge>;
}
