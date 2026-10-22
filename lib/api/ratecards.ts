import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import type { ClientContact } from "./clients";
import { qs } from "./common";
import type { FileRef } from "./files";

export const RATE_UNITS = { SQFT: "Sq.ft", RFT: "Running Feet", UNIT: "Unit", KM: "KM" } as const;
export type RateUnit = keyof typeof RATE_UNITS;

export interface RateItem {
  _id: string;
  particulars: string;
  specifications?: string;
  unit: RateUnit;
  rate: number;
  createdAt: string;
  updatedAt: string;
}
export interface RateItemInput {
  particulars: string;
  specifications?: string;
  unit: RateUnit;
  rate: number;
}
export interface RateItemParams {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  unit?: string;
}

export function useRateItems(params: RateItemParams, enabled = true) {
  return useQuery({
    queryKey: ["rate-items", params],
    queryFn: () => apiPage<RateItem>(`/rate-items${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSaveRateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: RateItemInput }) =>
      id
        ? api<RateItem>(`/rate-items/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api<RateItem>("/rate-items", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate-items"] }),
  });
}

export function useDeleteRateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string; archived: boolean }>(`/rate-items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate-items"] }),
  });
}

/* --------------------------------- quotation --------------------------------- */

export interface QuotationLine {
  masterItemId?: string | null;
  particulars: string;
  specifications?: string;
  unit: RateUnit;
  masterRate?: number | null;
  quotedRate: number;
  overrideReason?: string;
}
export interface QuotationValues {
  clientAddress?: string;
  contact: { name: string; designation?: string; phone?: string; email?: string };
  quotationDate: string;
  subject: string;
  items: QuotationLine[];
  terms: string;
  regards: { name: string; designation: string; mobile: string; email: string };
}
export interface RevisionChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: "ADDED" | "UPDATED" | "REMOVED";
}
export interface Revision {
  _id: string;
  revision: number;
  label: string;
  quotationRef: string;
  clientName: string;
  clientAddress?: string | null;
  contact?: { name?: string; designation?: string | null; phone?: string | null; email?: string | null };
  quotationDate: string;
  subject: string;
  items: (Omit<QuotationLine, "masterItemId"> & { masterItem?: string | null })[];
  terms?: string;
  regards?: { name?: string; designation?: string; mobile?: string; email?: string };
  changes: RevisionChange[];
  pdf?: FileRef;
  editedBy?: { _id: string; name: string; role?: string };
  createdAt: string;
}
export interface QuotationState {
  orderId: string;
  orderNo: string;
  stage: string;
  editable: boolean;
  quotationRef: string;
  clientName: string;
  contacts: ClientContact[];
  latest: Revision | null;
  draft: (Omit<QuotationValues, "quotationDate"> & { clientName: string; quotationDate: string }) | null;
  revisions: Revision[];
  emailDraft: { to: string[]; cc: string[]; subject: string; body: string } | null;
  from: string | null;
  mailEnabled: boolean;
}

export function useQuotation(orderId: string) {
  return useQuery({ queryKey: ["sales", "order", orderId, "rate-card"], queryFn: () => api<QuotationState>(`/sales/orders/${orderId}/rate-card`) });
}

export function useSaveQuotation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuotationValues) => api<{ saved: boolean; revision: Revision }>(`/sales/orders/${orderId}/rate-card`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "order", orderId] });
    },
  });
}
