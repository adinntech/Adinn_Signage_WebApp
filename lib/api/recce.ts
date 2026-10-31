import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiPage, saveBlob } from "@/lib/api";
import type { ClientContact, ClientFile, CustomField } from "./clients";
import { qs } from "./common";
import type { FileRef } from "./files";
import type { HandoverDoc, HandoverMessage, HandoverShop, HandoverType, SentEmail, ShopListSummary } from "./sales";

interface UserRef {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

/** Project Assign > Assign to Recce Team for one order (from the server). */
export interface RecceState {
  orderId: string;
  orderNo: string;
  /** The lead is open at Project Assign and Client Servicing has not been assigned. */
  unlocked: boolean;
  codes: { projectCode: string; estimationCode: string; clientId?: string | null; savedAt: string | null; savedBy: string | null } | null;
  requests: { count: number; lastSentAt: string | null; lastStatus: SentEmail["status"] | null };
  /** Email step done: an email recorded as sent (or not sent only because mail is off). Unlocks the codes. */
  emailDone: boolean;
  /** Handover Type & Details has no gaps. */
  handoverReady?: boolean;
  /** Handover Type & Details confirmed with "Continue" (step 1 done): unlocks the request email. */
  handoverDone?: boolean;
  /** Gaps of the full handover (step 1). */
  handoverMissing?: string[];
  handoverType?: "ASO" | "SHOP_DETAILS" | "SHOP_MEASUREMENT" | null;
  handoverUpdatedAt?: string | null;
  /**
   * Client Servicing workflow (the order is handed to this Client Servicing person): `handoverSent` = the BD sent the
   * handover details, so step 1 is skipped. Null for the BD's own Recce route.
   */
  csFlow?: { handoverSent: boolean } | null;
  clientType?: "NEW" | "EXISTING";
  /** Client ID in Zoho: Existing clients have it from Zoho (read-only); New clients type it at Project Code. */
  zohoClientId?: { value: string | null; fromZoho: boolean };
  /** Sent automatically with every request email (besides the client details and contacts in the message). */
  /** documents: chat files and (SO) Additional Documents (`so`), one copy of each. */
  autoAttachments?: { shopExcel: { rows: number; sized: boolean } | null; documents: (FileRef & { so?: boolean })[]; /** New Client only. */ gstCertificates?: FileRef[] };
  /** Project Assign route: HANDOVER (Client Servicing), RECCE, or null until the first save. */
  route: "HANDOVER" | "RECCE" | null;
  /** Client contacts with both a mobile number and an email (they go on the operations project). */
  projectContacts: number;
  assignee: UserRef | null;
  assignedAt: string | null;
  assignedBy: string | null;
  note: string | null;
  project: { _id: string; code: string; status: string } | null;
  missing: string[];
  mail: { enabled: boolean; from: string | null };
  draft: { to: string[]; cc: string[]; subject: string; body: string };
}

export const PRIORITIES = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" } as const;
export type Priority = keyof typeof PRIORITIES;

export interface RecceAssignInput {
  assigneeId: string;
  startDate: string;
  targetDate: string;
  district: string;
  priority: Priority;
  note?: string;
}

const recceKey = (id: string) => ["sales", "order", id, "recce"] as const;

export function useRecce(id: string, enabled = true) {
  return useQuery({ queryKey: recceKey(id), queryFn: () => api<RecceState>(`/sales/orders/${id}/recce`), enabled });
}

/** Active Recce / Operations people a project can be assigned to. */
export function useRecceUsers(enabled = true) {
  return useQuery({ queryKey: ["sales", "recce-users"], queryFn: () => api<UserRef[]>("/sales/recce-users"), enabled, staleTime: 5 * 60_000 });
}

function useRecceMutation<V, R>(id: string, fn: (v: V) => Promise<R>, also: (qc: ReturnType<typeof useQueryClient>) => void = () => {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recceKey(id) });
      also(qc);
    },
  });
}

/** Project code request email; `body` is multipart: `payload` (JSON email fields) + `files`. */
export const useSendCodeRequest = (id: string) =>
  useRecceMutation(id, (body: FormData) => api<SentEmail>(`/sales/orders/${id}/recce/code-request`, { method: "POST", body }), (qc) =>
    qc.invalidateQueries({ queryKey: ["sales", "order", id, "emails"] }),
  );

/** Step 1: confirms Handover Type & Details ("Continue: Project Code Request Email"). */
export const useConfirmRecceHandover = (id: string) =>
  useRecceMutation(id, () => api<RecceState>(`/sales/orders/${id}/recce/handover-done`, { method: "POST" }), (qc) => qc.invalidateQueries({ queryKey: ["leads"] }));

export const useSaveRecceCodes = (id: string) =>
  useRecceMutation(id, (body: { projectCode: string; estimationCode: string; clientId?: string }) => api<RecceState>(`/sales/orders/${id}/recce/codes`, { method: "PUT", body: JSON.stringify(body) }));

/** Creates the operations project, assigns it and completes the lead. */
export const useAssignRecce = (id: string) =>
  useRecceMutation(id, (body: RecceAssignInput) => api<RecceState>(`/sales/orders/${id}/recce/assign`, { method: "POST", body: JSON.stringify(body) }), (qc) => {
    qc.invalidateQueries({ queryKey: ["sales", "order", id] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  });

/* ------------------------------- Operations: BD handover ------------------------------- */

/** BD handover of a project created from Lead Management (null for other projects). */
export interface ProjectHandover {
  orderNo: string;
  projectCode: string | null;
  estimationCode: string | null;
  /** Client ID in Zoho (typed for a New client at Project Code, from Zoho for an Existing one). */
  clientId?: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  note: string | null;
  /** The client as handed over. GST certificates and custom fields: New (Client Management) clients only. */
  client: {
    name: string;
    clientName?: string;
    clientNo?: string;
    clientType?: "NEW" | "EXISTING" | null;
    /** Zoho customer number: the Client ID of an Existing client. */
    zohoCustomerNo?: string;
    email?: string;
    phone?: string;
    gstin?: string;
    gstCertificates?: ClientFile[];
    customFields?: CustomField[];
    contacts: ClientContact[];
  } | null;
  type: HandoverType | null;
  /** SO (stored as ASO): the Additional Documents. */
  soDocuments?: FileRef[];
  /** ASO: the client's SO contacts as handed over. */
  soContacts?: { name: string; phone: string; email?: string | null; isPrimary?: boolean }[];
  /** Communication & attachments (chat) from the BD. */
  messages: HandoverMessage[];
  documents: HandoverDoc[];
  shopList: ShopListSummary | null;
  declaredShopTotal: number | null;
  shopFiles: number;
}

export function useProjectHandover(projectId: string) {
  return useQuery({ queryKey: ["projects", projectId, "bd-handover"], queryFn: () => api<ProjectHandover | null>(`/projects/${projectId}/bd-handover`) });
}

/** The BD's shop table as it is now, as Excel (Operations / Recce view of a project). */
export async function downloadProjectShopExcel(projectId: string) {
  const { blob, fileName } = await apiBlob(`/projects/${projectId}/bd-handover/shops/export`);
  saveBlob(blob, fileName ?? "shop-list.xlsx");
}
export async function downloadProjectShopPdf(projectId: string) {
  const { blob, fileName } = await apiBlob(`/projects/${projectId}/bd-handover/shops/export?format=pdf`);
  saveBlob(blob, fileName ?? "shop-list.pdf");
}

export function useProjectHandoverShops(projectId: string, params: { page: number; limit: number; state?: string }, enabled = true) {
  return useQuery({
    queryKey: ["projects", projectId, "bd-handover", "shops", params],
    queryFn: () => apiPage<HandoverShop>(`/projects/${projectId}/bd-handover/shops${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}
