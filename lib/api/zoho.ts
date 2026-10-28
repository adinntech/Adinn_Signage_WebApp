import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";
import type { Client, ClientContact } from "./clients";

export interface ZohoSearchRow {
  contactId: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  imported: boolean;
  clientNo?: string;
}
export interface ZohoPayment {
  id: string;
  number?: string;
  date?: string;
  amount?: number;
  mode?: string;
  reference?: string;
  invoices?: string;
}
export interface ZohoPreview {
  contactId: string;
  zohoCustomerNo?: string;
  /** IMPORTED: already synced; LINK: matches an existing client by name/GSTIN; NEW: a fresh client (ID is the next free number). */
  identity: { mode: "IMPORTED" | "LINK" | "NEW"; clientNo?: string; code: string };
  client: {
    name: string;
    email?: string;
    industry?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    contacts: ClientContact[];
    status: "ACTIVE" | "INACTIVE";
  };
  payments: ZohoPayment[];
  tasks: { available: boolean; items: { id: string; title?: string; status?: string; dueDate?: string; assignee?: string }[] };
  imported: boolean;
  clientNo?: string;
}
export interface ZohoImportResult {
  client: Client;
  outcome: "CREATED" | "UPDATED" | "LINKED";
}

export const ZOHO_PAGE_SIZE = 25;

/** One page of active Zoho customers; q (2+ letters) narrows by name. */
export function useZohoClients(q: string, page: number) {
  return useQuery({
    queryKey: ["zoho", "list", q, page],
    queryFn: async () => {
      const r = await apiPage<ZohoSearchRow>(`/zoho/clients${qs({ q: q.length >= 2 ? q : undefined, page, perPage: ZOHO_PAGE_SIZE })}`);
      return { rows: r.data, hasMore: !!(r.meta as unknown as { hasMore?: boolean }).hasMore };
    },
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useZohoPreview(contactId: string | undefined) {
  return useQuery({ queryKey: ["zoho", "preview", contactId], queryFn: () => api<ZohoPreview>(`/zoho/clients/${contactId}`), enabled: !!contactId, retry: false });
}

export function useZohoImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => api<ZohoImportResult>(`/zoho/clients/${contactId}/import`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["zoho"] });
    },
  });
}
