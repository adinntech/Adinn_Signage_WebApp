import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiPage, saveBlob } from "@/lib/api";
import type { Client, ClientContact, ClientType } from "./clients";
import { qs } from "./common";
import type { FileRef } from "./files";

export const ORDER_STAGES = ["NEW_ORDER", "COMPANY_PROFILE", "RATE_CARD", "CLIENT_APPROVAL"] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export const STAGE_META: Record<OrderStage, { label: string; short: string; color: string; soft: string }> = {
  NEW_ORDER: { label: "New Order", short: "New Order", color: "var(--color-stage-new)", soft: "#eff6ff" },
  COMPANY_PROFILE: { label: "Company Profile", short: "Company Profile", color: "var(--color-stage-profile)", soft: "#fffbeb" },
  RATE_CARD: { label: "Rate Card", short: "Rate Card", color: "var(--color-stage-ratecard)", soft: "#f5f3ff" },
  CLIENT_APPROVAL: { label: "Client Approval Proof", short: "Client Approval", color: "var(--color-stage-approval)", soft: "#ecfdf5" },
};
export const nextStage = (s: OrderStage): OrderStage | null => ORDER_STAGES[ORDER_STAGES.indexOf(s) + 1] ?? null;
export const stageReached = (s: OrderStage, min: OrderStage) => ORDER_STAGES.indexOf(s) >= ORDER_STAGES.indexOf(min);

interface UserRef {
  _id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface OrderCard {
  _id: string;
  orderNo: string;
  client: Pick<Client, "_id" | "name" | "clientNo">;
  clientType: ClientType;
  stage: OrderStage;
  owner?: UserRef | null;
  estimatedAmount?: number;
  approvalStatus: "PENDING" | "COMPLETED";
  createdAt: string;
}
/** BD -> Client Servicing handover details on an order (null until handed over). */
export interface HandoverInfo {
  assignedBy?: string | UserRef;
  assignedAt?: string;
  note?: string;
  seenAt?: string;
}
export interface ShopListSummary {
  fileId: string;
  fileName: string;
  total: number;
  valid: number;
  warning: number;
  error: number;
  uploadedAt: string;
}
export interface Order extends Omit<OrderCard, "client"> {
  client: Client;
  csAssignee?: UserRef | null;
  handover?: HandoverInfo | null;
  stageLabel: string;
  stageChangedAt?: string;
  createdBy?: UserRef | null;
  approvalCompletedAt?: string;
  approvalCompletedBy?: UserRef | null;
  latestRevision: number | null;
  updatedAt: string;
}
export interface BoardColumn {
  stage: OrderStage;
  label: string;
  total: number;
  items: OrderCard[];
}
export interface BoardParams {
  q?: string;
  ownerId?: string;
  clientType?: string;
  from?: string;
  to?: string;
}
export interface HistoryEntry {
  id: string;
  action: string;
  fromStage: OrderStage | null;
  toStage: OrderStage | null;
  note: string | null;
  changedBy: string;
  role: string;
  at: string;
}
export interface OrderComment {
  _id: string;
  body: string;
  attachments: FileRef[];
  createdBy: UserRef;
  role: string;
  createdAt: string;
}
export type DeliveryStatus = "SENT" | "FAILED" | "SKIPPED";
export interface SentEmail {
  _id: string;
  kind: "COMPANY_PROFILE" | "RATE_CARD";
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachments: FileRef[];
  rateCardRevision?: number;
  revisionLabel: string | null;
  status: DeliveryStatus;
  error?: string;
  resentFrom?: string;
  sentBy: UserRef;
  sentAt: string;
}
export interface EmailInput {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  requestKey?: string;
}
export interface CompanyProfileDraft {
  from: string | null;
  mailEnabled: boolean;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  templateVersion: number;
  pdf: (FileRef & { uploadedAt?: string }) | null;
}
export const APPROVAL_DOC_TYPES = {
  PURCHASE_ORDER: "Purchase Order",
  EMAIL_APPROVAL: "Email Approval",
  WHATSAPP_APPROVAL: "WhatsApp Approval",
  OTHER_WRITTEN: "Other Written Approval",
} as const;
export type ApprovalDocType = keyof typeof APPROVAL_DOC_TYPES;
export interface ApprovalDoc {
  _id: string;
  docType: ApprovalDocType;
  file: FileRef;
  approvalDate?: string;
  remarks?: string;
  replaces?: string;
  supersededAt?: string;
  supersededBy?: string;
  uploadedBy: UserRef;
  updatedBy?: UserRef;
  createdAt: string;
}
export interface ApprovalOverview {
  order: Order;
  latestRevision: { revision: number; label: string; pdf?: FileRef; createdAt: string } | null;
  documents: ApprovalDoc[];
  history: ApprovalDoc[];
  missing: string[];
}
export interface RegisterInput {
  name: string;
  email: string;
  industry?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  contacts: ClientContact[];
  requestKey: string;
}
interface CreatedOrder {
  client: Client;
  order: Order;
  replayed: boolean;
}
/** Order Management list row. */
export interface OrderRow {
  _id: string;
  orderNo: string;
  client: Pick<Client, "_id" | "name" | "clientNo" | "city">;
  /** New / Existing client flag chosen when the order was created. */
  clientType: ClientType;
  owner?: UserRef | null;
  currentRevision?: number;
  rateCardLabel: string | null;
  rateCardPdf?: FileRef | null;
  csAssignee?: UserRef | null;
  handover?: HandoverInfo | null;
  shopList?: ShopListSummary | null;
  createdAt: string;
  updatedAt: string;
}
export interface OrderListParams {
  page?: number;
  limit?: number;
  q?: string;
  clientType?: string;
  /** BD: ASSIGNED (handed over to Client Servicing) or PENDING. */
  handover?: string;
  ownerId?: string;
  clientId?: string;
  sort?: string;
}

/** One key per form session: a retried or double-clicked submit returns the first result instead of a duplicate. */
export const newRequestKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const keys = {
  board: (p: BoardParams) => ["sales", "board", p] as const,
  order: (id: string) => ["sales", "order", id] as const,
};

/** Everything that may change when an order changes. */
function invalidateOrder(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["sales", "board"] });
  qc.invalidateQueries({ queryKey: ["sales", "orders"] });
  qc.invalidateQueries({ queryKey: ["clients"] });
  if (id) qc.invalidateQueries({ queryKey: ["sales", "order", id] });
}

export function useRegisterClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterInput) => api<CreatedOrder>("/sales/orders/new-client", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

/** Creates an order for a registered client; `clientType` is the New / Existing client flag (server suggests one when omitted). */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { clientId: string; clientType?: ClientType; requestKey: string }) =>
      api<CreatedOrder>("/sales/orders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

/** Order Management list (paginated, newest first). */
export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: ["sales", "orders", params],
    queryFn: () => apiPage<OrderRow>(`/sales/orders${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useBoard(params: BoardParams) {
  return useQuery({
    queryKey: keys.board(params),
    queryFn: () => api<{ columns: BoardColumn[] }>(`/sales/orders/board${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: keys.order(id ?? ""), queryFn: () => api<Order>(`/sales/orders/${id}`), enabled: !!id });
}

export function useMoveStage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stage: OrderStage) => api<Order>(`/sales/orders/${id}/stage`, { method: "POST", body: JSON.stringify({ stage }) }),
    onSuccess: () => invalidateOrder(qc, id),
  });
}

/** Moves a card between board columns in the cached board data (count + position). */
function moveCard(board: { columns: BoardColumn[] }, id: string, stage: OrderStage) {
  const card = board.columns.flatMap((c) => c.items).find((o) => o._id === id);
  if (!card) return board;
  return {
    columns: board.columns.map((c) => {
      if (c.stage === card.stage) return { ...c, total: c.total - 1, items: c.items.filter((o) => o._id !== id) };
      if (c.stage === stage) return { ...c, total: c.total + 1, items: [{ ...card, stage }, ...c.items] };
      return c;
    }),
  };
}

/** Kanban drag & drop: the card moves immediately and goes back if the server refuses the stage change. */
export function useBoardMove(params: BoardParams) {
  const qc = useQueryClient();
  const key = keys.board(params);
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: OrderStage }) => api<Order>(`/sales/orders/${id}/stage`, { method: "POST", body: JSON.stringify({ stage }) }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ columns: BoardColumn[] }>(key);
      if (prev) qc.setQueryData(key, moveCard(prev, id, stage));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: (_d, _e, v) => invalidateOrder(qc, v.id),
  });
}

/* --------------------------- BD -> Client Servicing handover --------------------------- */

export interface HandoverDoc {
  _id: string;
  kind: "DOCUMENT" | "SHOP_LIST";
  file: FileRef;
  afterHandover?: boolean;
  uploadedBy?: UserRef;
  role?: string;
  createdAt: string;
}
export interface HandoverState {
  orderId: string;
  orderNo: string;
  assignee: UserRef | null;
  handover: (Omit<HandoverInfo, "assignedBy"> & { assignedBy?: UserRef }) | null;
  shopList: ShopListSummary | null;
  documents: HandoverDoc[];
}
export type ShopState = "VALID" | "WARNING" | "ERROR";
export interface HandoverShop {
  rowNumber: number;
  shopName?: string;
  dealerName?: string;
  location?: string;
  district?: string;
  address1?: string;
  address2?: string;
  pincode?: string;
  mobile?: string;
  contactPerson?: string;
  width?: number;
  height?: number;
  unit?: string;
  quantity?: number;
  boardType?: string;
  remarks?: string;
  state: ShopState;
  issues: string[];
}

const handoverKey = (id: string) => ["sales", "order", id, "handover"] as const;

export function useHandover(id: string) {
  return useQuery({ queryKey: handoverKey(id), queryFn: () => api<HandoverState>(`/sales/orders/${id}/handover`) });
}

export function useHandoverShops(id: string, params: { page: number; limit: number; state?: ShopState | "" }, enabled = true) {
  return useQuery({
    queryKey: [...handoverKey(id), "shops", params],
    queryFn: () => apiPage<HandoverShop>(`/sales/orders/${id}/handover/shops${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Every handover change refreshes the handover tab, the order header and the order list. */
function useHandoverMutation<V>(id: string, fn: (v: V) => Promise<HandoverState>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(handoverKey(id), data);
      qc.invalidateQueries({ queryKey: [...handoverKey(id), "shops"] });
      invalidateOrder(qc, id);
    },
  });
}

export const useUploadShopList = (id: string) =>
  useHandoverMutation(id, (body: FormData) => api<HandoverState>(`/sales/orders/${id}/handover/shops`, { method: "POST", body }));
export const useRemoveShopList = (id: string) => useHandoverMutation(id, () => api<HandoverState>(`/sales/orders/${id}/handover/shops`, { method: "DELETE" }));
export const useAddHandoverDocs = (id: string) =>
  useHandoverMutation(id, (body: FormData) => api<HandoverState>(`/sales/orders/${id}/handover/documents`, { method: "POST", body }));
export const useRemoveHandoverDoc = (id: string) =>
  useHandoverMutation(id, (docId: string) => api<HandoverState>(`/sales/orders/${id}/handover/documents/${docId}`, { method: "DELETE" }));
export const useAssignClientServicing = (id: string) =>
  useHandoverMutation(id, (body: { csUserId: string; note?: string }) => api<HandoverState>(`/sales/orders/${id}/handover/assign`, { method: "POST", body: JSON.stringify(body) }));

/** Active Client Servicing people (handover dropdown). */
export function useClientServicingUsers(enabled = true) {
  return useQuery({ queryKey: ["sales", "cs-users"], queryFn: () => api<UserRef[]>("/sales/client-servicing-users"), enabled, staleTime: 5 * 60_000 });
}

/** Blank shop list in the columns the import understands. */
export async function downloadShopTemplate() {
  const { blob, fileName } = await apiBlob("/sales/shop-list-template");
  saveBlob(blob, fileName ?? "shop-list-template.xlsx");
}

/** Whether a company profile email has been delivered for the order (used to warn when skipping ahead). */
export const companyProfileSent = async (id: string) =>
  (await api<SentEmail[]>(`/sales/orders/${id}/emails${qs({ kind: "COMPANY_PROFILE" })}`)).some((e) => e.status === "SENT");

export function useReassignOwner(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ownerId: string) => api<Order>(`/sales/orders/${id}/owner`, { method: "PATCH", body: JSON.stringify({ ownerId }) }),
    onSuccess: () => invalidateOrder(qc, id),
  });
}

export function useOrderHistory(id: string) {
  return useQuery({ queryKey: ["sales", "order", id, "history"], queryFn: () => api<HistoryEntry[]>(`/sales/orders/${id}/history`) });
}

export function useComments(id: string) {
  return useQuery({ queryKey: ["sales", "order", id, "comments"], queryFn: () => api<OrderComment[]>(`/sales/orders/${id}/comments`) });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FormData) => api<OrderComment>(`/sales/orders/${id}/comments`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "order", id, "comments"] }),
  });
}

/** Deletes a whole comment (with `fileId`: only that attachment). The files are erased from storage. */
export function useDeleteComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, fileId }: { commentId: string; fileId?: string }) =>
      api<unknown>(`/sales/orders/${id}/comments/${commentId}${fileId ? `/attachments/${fileId}` : ""}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "order", id, "comments"] }),
  });
}

export function useCompanyProfileDraft(id: string, enabled = true) {
  return useQuery({
    queryKey: ["sales", "order", id, "profile-draft"],
    queryFn: () => api<CompanyProfileDraft>(`/sales/orders/${id}/company-profile/draft`),
    enabled,
    staleTime: 0,
  });
}

export function useOrderEmails(id: string, kind: SentEmail["kind"]) {
  return useQuery({ queryKey: ["sales", "order", id, "emails", kind], queryFn: () => api<SentEmail[]>(`/sales/orders/${id}/emails${qs({ kind })}`) });
}

export function useSendEmail(id: string, kind: SentEmail["kind"]) {
  const qc = useQueryClient();
  const path = kind === "COMPANY_PROFILE" ? "company-profile/send" : "rate-card/send";
  return useMutation({
    mutationFn: (body: EmailInput) => api<SentEmail>(`/sales/orders/${id}/${path}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "order", id, "emails"] }),
  });
}

export function useResendEmail(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emailId: string) => api<SentEmail>(`/sales/emails/${emailId}/resend`, { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "order", id, "emails"] }),
  });
}

export function useApproval(id: string) {
  return useQuery({ queryKey: ["sales", "order", id, "approval"], queryFn: () => api<ApprovalOverview>(`/sales/orders/${id}/approval`) });
}

export function useUploadApproval(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FormData) => api<ApprovalDoc>(`/sales/orders/${id}/approval/documents`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "order", id, "approval"] }),
  });
}

export function useUpdateApproval(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, ...body }: { docId: string; approvalDate?: string | null; remarks?: string | null }) =>
      api<ApprovalDoc>(`/sales/approval/documents/${docId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "order", id, "approval"] }),
  });
}

/** Deletes an approval document and erases its file (only before approval is complete). */
export function useDeleteApproval(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => api<ApprovalOverview>(`/sales/approval/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "order", id, "approval"] }),
  });
}

export function useCompleteApproval(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ApprovalOverview>(`/sales/orders/${id}/approval/complete`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "order", id, "approval"] });
      invalidateOrder(qc, id);
    },
  });
}
