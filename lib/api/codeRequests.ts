import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";

export type CodeKind = "CLIENT_CODE" | "PROJECT_CODE";
export type CodeStatus = "DRAFT" | "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED" | "FAILED";
export type KindState = "NOT_REQUESTED" | "DRAFT" | "PENDING" | "BD_SENT" | "CONFIRMED" | "FAILED";

export const CODE_LABEL: Record<CodeKind, string> = { CLIENT_CODE: "Client Code", PROJECT_CODE: "Project Code" };
export const STATUS_LABEL: Record<CodeStatus, string> = {
  DRAFT: "Draft",
  PENDING_CONFIRMATION: "Pending Confirmation",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  FAILED: "Failed",
};

export interface SentMail {
  id: string;
  from?: string;
  to: string[];
  cc: string[];
  subject?: string;
  body?: string;
  sentAt?: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string;
  attachments: { name?: string; size?: number }[];
}
export interface CodeRequestRow {
  _id: string;
  kind: CodeKind;
  status: CodeStatus;
  active: boolean;
  mailBatchId?: string;
  mode?: "COMBINED" | "SEPARATE" | "SINGLE" | "BD" | "MANUAL";
  source: "CS" | "BD";
  mailStatus?: "SENT" | "SKIPPED" | "FAILED";
  mailError?: string;
  sentAt?: string;
  sentByName?: string | null;
  confirmedCode?: string;
  confirmedAt?: string;
  confirmedByName?: string | null;
  evidenceNote?: string;
  rejectedReason?: string;
  mail: SentMail | null;
  createdAt: string;
  updatedAt: string;
}
export interface KindOverview {
  state: KindState;
  code: string | null;
  fromBd: boolean;
  canRequest: boolean;
  requestId: string | null;
  bdMail: { id: string; to: string[]; cc: string[]; subject?: string; body?: string; sentAt?: string; status: string; sentBy: string | null } | null;
}
export interface MailDefault {
  subject: string;
  body: string;
}
export interface CodesOverview {
  order: { _id: string; orderNo: string };
  client: { _id: string; name: string; clientNo: string | null; gstin: string | null; pan: string | null; approvedCode: string | null; primaryEmail: string | null; documents: { fileId: string; name?: string; size?: number }[] };
  kinds: Record<CodeKind, KindOverview>;
  requests: CodeRequestRow[];
  mail: { enabled: boolean; from: string | null; identities: string[]; groups: Record<CodeKind, string[]> };
  defaults: { COMBINED: MailDefault; CLIENT_CODE: MailDefault; PROJECT_CODE: MailDefault };
  drafts: { kind: CodeKind; to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }[];
}
export interface CodeListItem extends CodeRequestRow {
  order: { _id: string; orderNo: string } | null;
  client: { _id: string; name: string; clientNo?: string } | null;
}
export interface CodeHistoryItem {
  id: string;
  action: string;
  reason: string;
  at: string;
  by: string | null;
}
export interface MailPayload {
  kinds: CodeKind[];
  to: string[];
  cc: string[];
  bcc: string[];
  from?: string;
  subject: string;
  body: string;
}
export interface CodeListParams {
  page?: number;
  limit?: number;
  status?: string;
  kind?: string;
  q?: string;
}

const key = (orderId: string) => ["sales", "codes", orderId] as const;

export const useCodes = (orderId: string | undefined) => useQuery({ queryKey: key(orderId ?? ""), queryFn: () => api<CodesOverview>(`/sales/orders/${orderId}/codes`), enabled: !!orderId });
export const useCodeHistory = (orderId: string | undefined) => useQuery({ queryKey: [...key(orderId ?? ""), "history"], queryFn: () => api<CodeHistoryItem[]>(`/sales/orders/${orderId}/codes/history`), enabled: !!orderId });
export const useCodeList = (params: CodeListParams) =>
  useQuery({ queryKey: ["sales", "codes", "list", params], queryFn: () => apiPage<CodeListItem>(`/sales/codes${qs(params)}`), placeholderData: keepPreviousData });

/** Every code query for the order, its history and the cross-order list. */
function useRefresh(orderId: string) {
  const qc = useQueryClient();
  return (data?: CodesOverview) => {
    if (data) qc.setQueryData(key(orderId), data);
    qc.invalidateQueries({ queryKey: ["sales", "codes"] });
    qc.invalidateQueries({ queryKey: ["sales", "order", orderId, "emails"] });
  };
}

/** `mails` is the whole send: one email for a combined or single request, one per send for separate emails. Multipart: `payload` + `files`. */
export function useSendCodes(orderId: string) {
  const done = useRefresh(orderId);
  return useMutation({
    mutationFn: (v: { mails: MailPayload[]; requestKey: string; includeClientDocs: string[]; files: File[] }) => {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ mails: v.mails, requestKey: v.requestKey, includeClientDocs: v.includeClientDocs }));
      for (const f of v.files) fd.append("files", f);
      return api<CodesOverview>(`/sales/orders/${orderId}/codes/send`, { method: "POST", body: fd });
    },
    onSuccess: done,
  });
}
export function useSaveCodeDraft(orderId: string) {
  const done = useRefresh(orderId);
  return useMutation({ mutationFn: (mails: Partial<MailPayload>[]) => api<CodesOverview>(`/sales/orders/${orderId}/codes/draft`, { method: "PUT", body: JSON.stringify({ mails }) }), onSuccess: done });
}
export function useAlreadySent(orderId: string) {
  const done = useRefresh(orderId);
  return useMutation({ mutationFn: (v: { kinds: CodeKind[]; note: string }) => api<CodesOverview>(`/sales/orders/${orderId}/codes/already-sent`, { method: "POST", body: JSON.stringify(v) }), onSuccess: done });
}
export function useRetryCodes(orderId: string) {
  const done = useRefresh(orderId);
  return useMutation({ mutationFn: (mailBatchId: string) => api<CodesOverview>(`/sales/orders/${orderId}/codes/retry`, { method: "POST", body: JSON.stringify({ mailBatchId }) }), onSuccess: done });
}
export function useConfirmCode(orderId: string) {
  const done = useRefresh(orderId);
  return useMutation({ mutationFn: (v: { kind: CodeKind; code: string; evidenceNote?: string }) => api<CodesOverview>(`/sales/orders/${orderId}/codes/confirm`, { method: "POST", body: JSON.stringify(v) }), onSuccess: done });
}
export function useRejectCode(orderId: string) {
  const done = useRefresh(orderId);
  return useMutation({ mutationFn: (v: { kind: CodeKind; reason: string }) => api<CodesOverview>(`/sales/orders/${orderId}/codes/reject`, { method: "POST", body: JSON.stringify(v) }), onSuccess: done });
}
