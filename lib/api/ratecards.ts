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
  /** Saved while preparing the rate card or during negotiation (Lead Management). */
  phase?: "PREPARATION" | "NEGOTIATION";
  editedBy?: { _id: string; name: string; role?: string };
  createdAt: string;
}
/** ADINN's own details printed on the rate card (from the backend, so the preview and the PDF always agree). */
export interface CompanyInfo {
  name: string;
  gstin: string;
  address: string[];
  website: string;
}
export interface QuotationState {
  orderId: string;
  orderNo: string;
  stage: string;
  editable: boolean;
  /** Why it cannot be edited now (null when editable). */
  lockedReason: string | null;
  /** Lead Management stage of the order, or null outside Lead Management. */
  leadStage: string | null;
  quotationRef: string;
  company: CompanyInfo;
  clientName: string;
  contacts: ClientContact[];
  latest: Revision | null;
  draft: (Omit<QuotationValues, "quotationDate"> & { clientName: string; quotationDate: string }) | null;
  revisions: Revision[];
  emailDraft: { to: string[]; cc: string[]; subject: string; body: string } | null;
  from: string | null;
  mailEnabled: boolean;
}

/* Same text rules as the PDF (backend ratecards/quotation.pdf.ts). */

const num = (n: number) => String(Math.round(n * 100) / 100);
/** Rate column text, e.g. "70/ sqft", "120/ Running Feet", "3000/ Unit", "12 Per Km". */
export const rateText = (rate: number, unit: RateUnit) =>
  unit === "KM" ? `${num(rate)} Per Km` : `${num(rate)}/ ${({ SQFT: "sqft", RFT: "Running Feet", UNIT: "Unit" } as Record<string, string>)[unit] ?? unit}`;

const htmlToText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h3|h4|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** Terms editor HTML -> one entry per numbered term row (list items, else lines), without typed numbering. */
export function termsList(html?: string | null): string[] {
  const src = String(html ?? "");
  const items = [...src.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => htmlToText(m[1]!));
  const lines = items.length ? items : htmlToText(src).split(/\n+/);
  return lines.map((t) => t.replace(/\s+/g, " ").trim().replace(/^(?:\d{1,2}\s*[.)]|\d{2}\s|[-•*])\s*/, "")).filter(Boolean);
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
      // The lead's checklist, rate card badge and negotiation rounds change with every save.
      qc.invalidateQueries({ queryKey: ["leads", "lead", orderId], exact: true });
    },
  });
}
