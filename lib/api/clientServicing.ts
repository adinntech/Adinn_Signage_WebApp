import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrderRow } from "./sales";

/** Dashboard counts for the orders BD handed to the signed-in Client Servicing user. */
export interface CsSummary {
  total: number;
  unseen: number;
  newClient: number;
  existingClient: number;
  thisWeek: number;
  recent: OrderRow[];
}

export function useCsSummary() {
  return useQuery({ queryKey: ["sales", "cs-summary"], queryFn: () => api<CsSummary>("/sales/cs/summary"), refetchInterval: 60_000 });
}
