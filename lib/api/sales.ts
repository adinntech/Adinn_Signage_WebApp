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
  /** Last uploaded Excel (null when the shops were only typed in). */
  fileId: string | null;
  fileName: string | null;
  total: number;
  valid: number;
  warning: number;
  error: number;
  /** Rows repeating an earlier row of the same file. */
  duplicates?: number;
  uploadedAt: string;
}
/** Assign types (display labels; the stored values stay ASO / SHOP_DETAILS / SHOP_MEASUREMENT). */
export const HANDOVER_TYPES = {
  ASO: { label: "SO", hint: "Client, contact persons and the client's SO contacts (with optional documents). The shop details are collected through the SO contacts." },
  SHOP_DETAILS: { label: "Only Shop Details", hint: "The client's shop list without sizes: upload the Excel or add shops, then edit them in the table." },
  SHOP_MEASUREMENT: { label: "Shop + Measurement", hint: "Shop list with sizes (W × H) and up to 10 images per shop." },
} as const;
export type HandoverType = keyof typeof HANDOVER_TYPES;
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
  /** PDF of the latest saved rate card revision. */
  rateCardPdf?: FileRef | null;
  /** Lead Management state (null until the order is taken up as a lead). */
  lead?: { stage: string; status: "OPEN" | "CLOSED" | "COMPLETED" } | null;
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
  kind: "COMPANY_PROFILE" | "RATE_CARD" | "ONBOARDING" | "PROJECT_CODE_REQUEST";
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
  PHOTO: "Photo",
  SUPPORTING_DOCUMENT: "Supporting Document",
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
  clientName?: string;
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
  client: Pick<Client, "_id" | "name" | "clientName" | "clientNo" | "city">;
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
  /** My Orders (Client Servicing): workflow status and current step label (from the server). */
  csStatus?: CsOrderStatus;
  csStage?: string;
  /** My Orders: the Recce / Operations assignment (not the BD -> Client Servicing `handover.assignedAt`). */
  recce?: { assignee: { name?: string } | null; /** The Client Servicing person who assigned the Recce team. */ assignedBy?: { name?: string | null } | null; assignedAt: string | null };
}
export type CsOrderStatus = "PROJECT_ASSIGN" | "RECCE_ASSIGNED" | "COMPLETED" | "CLOSED";
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
  /** Client Servicing (My Orders): workflow status filter. */
  csStatus?: CsOrderStatus | "";
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

/**
 * Creates an order and its lead (opens at Project Assign). New Client: `clientId` from Client Management; Existing
 * Client: `zohoId` from the Zoho customer list.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ({ clientId: string; zohoId?: never } | { zohoId: string; clientId?: never }) & { clientType?: ClientType; requestKey: string; initialNotes?: string }) =>
      api<CreatedOrder>("/sales/orders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateOrder(qc);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

/** A Zoho customer for the Existing Client picker; `clientId` is set once it is linked to a CRM client. */
export interface ZohoClientOption {
  zohoId: string;
  name: string;
  clientName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  city?: string;
  state?: string;
  /** Zoho's own customer number (the client's ID in Zoho). */
  zohoCustomerNo?: string;
  address?: string;
  pincode?: string;
  industry?: string;
  /** Only on the single-customer read (useZohoClient). */
  contacts?: { name: string; designation?: string; phone?: string; email?: string; isPrimary: boolean }[];
  /** Local client linked to this Zoho customer (null until the first order adds it). */
  clientId: string | null;
  /** Local Client ID (CLI-0023) of the linked client. */
  clientNo: string | null;
  /** Business Client Code of the linked client (normally the Zoho customer number). */
  code?: string | null;
}

/** One Zoho customer with its contact persons (read-only Existing Client preview). */
export function useZohoClient(zohoId: string | undefined) {
  return useQuery({
    queryKey: ["sales", "zoho-client", zohoId],
    queryFn: () => api<ZohoClientOption>(`/sales/zoho-clients/${encodeURIComponent(zohoId!)}`),
    enabled: !!zohoId,
    staleTime: 60_000,
  });
}

/** Zoho customer search. `mode` is "sample" until the Zoho keys are set on the server. */
export function useZohoClients(q: string, enabled = true) {
  return useQuery({
    queryKey: ["sales", "zoho-clients", q],
    queryFn: async () => {
      const r = await apiPage<ZohoClientOption>(`/sales/zoho-clients${qs({ q })}`);
      return { items: r.data, mode: ((r.meta as unknown as { mode?: string }).mode ?? "live") as "live" | "sample" };
    },
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** My Orders cards (Client Servicing): counts by workflow status over all their orders. */
export function useCsOrderSummary(enabled = true) {
  return useQuery({
    queryKey: ["sales", "orders", "cs-summary"],
    queryFn: () => api<{ total: number; projectAssign: number; recceAssigned: number; completed: number; closed: number }>("/sales/orders/cs-summary"),
    enabled,
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
/** One message of the handover's Communication & Attachments (chat). */
export interface HandoverMessage {
  _id: string;
  text?: string;
  attachments: FileRef[];
  /** A voice note (recorded in the browser or an uploaded audio file). */
  voice?: { file: FileRef; durationSec?: number } | null;
  by?: UserRef & { role?: string };
  role?: string;
  afterHandover?: boolean;
  createdAt: string;
}
export interface HandoverState {
  orderId: string;
  orderNo: string;
  assignee: UserRef | null;
  handover: (Omit<HandoverInfo, "assignedBy"> & { assignedBy?: UserRef }) | null;
  /** Assign to Client Servicing toggle: full handover (true) or client details and contacts only (false). */
  full: boolean;
  type: HandoverType | null;
  /** Row counts of the shop table (total = Total Shops) and the last uploaded Excel. */
  shopList: ShopListSummary | null;
  declaredShopTotal: number | null;
  shopsWithFiles: number;
  shopFiles: number;
  /** Uploaded shop list files, newest first. */
  documents: HandoverDoc[];
  /** Communication & attachments, oldest first. */
  messages: HandoverMessage[];
  /** ASO: the client's SO contacts (kept apart from the contact persons; shown for ASO only). */
  soContacts: SoContact[];
  /** SO (ASO): Additional Documents, kept apart from the chat files (empty for the other types; kept on the order). */
  soDocuments?: (FileRef & { addedAt?: string | null })[];
  /** Last save of any handover detail. */
  updatedAt: string | null;
  /** Imported columns of the shop table, in sheet order (null for tables from before them). */
  columns?: ShopColumn[] | null;
  /** Still needed before the order can be handed over (from the server). */
  missing: string[];
}
export interface SoContact {
  _id?: string;
  name: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}
/** One column of the uploaded Excel: internal id, original header (may be blank / repeated), the shop field it feeds internally. */
export interface ShopColumn {
  id: string;
  header: string;
  field: string | null;
}
export type ShopState = "VALID" | "WARNING" | "ERROR";
export interface HandoverShop {
  rowId: string;
  rowNumber: number;
  shopName?: string | null;
  dealerName?: string | null;
  location?: string | null;
  district?: string | null;
  address1?: string | null;
  address2?: string | null;
  address3?: string | null;
  pincode?: string | null;
  mobile?: string | null;
  mobileAlt?: string | null;
  gstin?: string | null;
  contactPerson?: string | null;
  width?: number | null;
  height?: number | null;
  unit?: string | null;
  quantity?: number | null;
  boardType?: string | null;
  remarks?: string | null;
  clientSiteCode?: string | null;
  /** Columns of the uploaded Excel that are not shop fields (header -> value). */
  extra?: Record<string, string> | null;
  /** Imported-columns tables: column id -> cell text as in Excel. */
  cells?: Record<string, string> | null;
  state: ShopState;
  issues: string[];
  /** Shop + Measurement: up to 10 images of this shop. */
  attachments?: FileRef[];
  updatedAt?: string;
  updatedByName?: string | null;
}
/** Text values of a shop row as typed in the table (the server checks and cleans them). */
export type ShopRowInput = Partial<Record<"shopName" | "dealerName" | "location" | "district" | "address1" | "address2" | "address3" | "pincode" | "mobile" | "mobileAlt" | "gstin" | "contactPerson" | "width" | "height" | "unit" | "boardType" | "quantity" | "remarks" | "clientSiteCode", string>> & { extra?: Record<string, string>; cells?: Record<string, string> };
export interface ShopLog {
  _id: string;
  rowId?: string | null;
  /** Row identity at the time ("Row 12 · ABC Traders"), also for deleted rows. */
  label?: string | null;
  /** Imported-columns tables: changed cells by column header (one side for add / delete). */
  cells?: { column: string; before?: string; after?: string }[];
  action: "ADD" | "EDIT" | "DELETE" | "IMPORT" | "CLEAR" | "IMAGE_ADD" | "IMAGE_REMOVE";
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: string;
  by?: UserRef & { role?: string };
  role?: string;
  at: string;
}
export const MAX_ROW_IMAGES = 10;

const handoverKey = (id: string) => ["sales", "order", id, "handover"] as const;

export function useHandover(id: string) {
  return useQuery({ queryKey: handoverKey(id), queryFn: () => api<HandoverState>(`/sales/orders/${id}/handover`) });
}

/** `type`: the handover type shown, so one type's cached rows never show for the other (each type has its own list). */
export function useHandoverShops(id: string, params: { page: number; limit: number; state?: ShopState | "" }, enabled = true, type?: HandoverType | null) {
  return useQuery({
    queryKey: [...handoverKey(id), "shops", type ?? null, params],
    queryFn: () => apiPage<HandoverShop>(`/sales/orders/${id}/handover/shops${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Every handover change refreshes the handover tab, the shop rows, the order header and the order list. */
function useHandoverMutation<V, R = HandoverState>(id: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (data && typeof data === "object" && "orderId" in data) qc.setQueryData(handoverKey(id), data);
      else qc.invalidateQueries({ queryKey: handoverKey(id), exact: true });
      qc.invalidateQueries({ queryKey: [...handoverKey(id), "shops"] });
      qc.invalidateQueries({ queryKey: [...handoverKey(id), "history"] });
      invalidateOrder(qc, id);
    },
  });
}

/** What an upload added / updated, and the rows of the file that came in with problems (line = Excel row). */
export interface ShopImportResult {
  added: number;
  updated: number;
  sheet?: string;
  extraColumns?: string[];
  flaggedCount?: number;
  flagged?: { line: number; row: number; state: ShopState; issues: string[] }[];
}
/** 422 SHOP_MAPPING_REQUIRED: the workbook is ambiguous; the BD picks the sheet / header row and maps the columns. */
export interface ShopImportPreview {
  sheets: { name: string; rows: number }[];
  sheet: string;
  headerRow: number | null;
  rows: { rowNumber: number; cells: string[] }[];
  headers: string[];
  mapping: Record<string, string>;
  problems: string[];
  fields: string[];
}
export const useUploadShopList = (id: string) =>
  useHandoverMutation(id, (body: FormData) => api<HandoverState & { imported?: ShopImportResult }>(`/sales/orders/${id}/handover/shops`, { method: "POST", body }));
/** Clears the whole shop table. */
export const useRemoveShopList = (id: string) => useHandoverMutation(id, () => api<HandoverState>(`/sales/orders/${id}/handover/shops`, { method: "DELETE" }));
export const useSetHandoverType = (id: string) =>
  useHandoverMutation(id, (type: HandoverType) => api<HandoverState>(`/sales/orders/${id}/handover/type`, { method: "PATCH", body: JSON.stringify({ type }) }));
/** ASO: saves the whole SO contact list (blank rows are dropped; one primary). */
export const useSetSoContacts = (id: string) =>
  useHandoverMutation(id, (contacts: SoContact[]) => api<HandoverState>(`/sales/orders/${id}/handover/so-contacts`, { method: "PUT", body: JSON.stringify({ contacts }) }));
/** SO: Additional Documents (multipart `files`); a file already added is skipped by the server (`skipped`). */
export const useAddSoDocuments = (id: string) =>
  useHandoverMutation(id, (body: FormData) => api<HandoverState & { skipped?: number }>(`/sales/orders/${id}/handover/so-documents`, { method: "POST", body }));
export const useRemoveSoDocument = (id: string) =>
  useHandoverMutation(id, (fileId: string) => api<HandoverState>(`/sales/orders/${id}/handover/so-documents/${fileId}`, { method: "DELETE" }));
export const useAddShopRow = (id: string) =>
  useHandoverMutation(id, (body: ShopRowInput) => api<HandoverShop>(`/sales/orders/${id}/handover/shop-rows`, { method: "POST", body: JSON.stringify(body) }));
export const useUpdateShopRow = (id: string) =>
  useHandoverMutation(id, ({ rowId, body }: { rowId: string; body: ShopRowInput }) => api<HandoverShop>(`/sales/orders/${id}/handover/shop-rows/${rowId}`, { method: "PUT", body: JSON.stringify(body) }));
export const useDeleteShopRow = (id: string) =>
  useHandoverMutation(id, (rowId: string) => api<unknown>(`/sales/orders/${id}/handover/shop-rows/${rowId}`, { method: "DELETE" }));
/** Images of one shop row (Shop + Measurement, up to 10). */
export const useAddShopImages = (id: string) =>
  useHandoverMutation(id, ({ rowId, body }: { rowId: string; body: FormData }) => api<HandoverShop>(`/sales/orders/${id}/handover/shop-rows/${rowId}/files`, { method: "POST", body }));
export const useRemoveShopImage = (id: string) =>
  useHandoverMutation(id, ({ rowId, fileId }: { rowId: string; fileId: string }) => api<HandoverShop>(`/sales/orders/${id}/handover/shop-rows/${rowId}/files/${fileId}`, { method: "DELETE" }));

/** Changes of one shop row (or of the whole table), newest first. */
export function useShopHistory(id: string, rowId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...handoverKey(id), "history", rowId ?? "all"],
    queryFn: () => api<ShopLog[]>(`/sales/orders/${id}/handover/shop-history${qs({ rowId })}`),
    enabled,
  });
}

/** The shop table as it is now (Excel with a Row ID column, so it can be edited and uploaded again). */
export async function downloadShopExcel(id: string) {
  const { blob, fileName } = await apiBlob(`/sales/orders/${id}/handover/shops/export`);
  saveBlob(blob, fileName ?? "shop-list.xlsx");
}
/** The same table as PDF (every column and row, header on each page; Shop + Measurement with sizes and images). */
export async function downloadShopPdf(id: string) {
  const { blob, fileName } = await apiBlob(`/sales/orders/${id}/handover/shops/export?format=pdf`);
  saveBlob(blob, fileName ?? "shop-list.pdf");
}

export const useSetHandoverScope = (id: string) =>
  useHandoverMutation(id, (full: boolean) => api<HandoverState>(`/sales/orders/${id}/handover/scope`, { method: "PATCH", body: JSON.stringify({ full }) }));

/** Communication & attachments: a text, files, or one voice note (`voice=1` + `durationSec`) as multipart. */
export const useAddHandoverMessage = (id: string) =>
  useHandoverMutation(id, (body: FormData) => api<HandoverState>(`/sales/orders/${id}/handover/messages`, { method: "POST", body }));
export const useRemoveHandoverMessage = (id: string) =>
  useHandoverMutation(id, (messageId: string) => api<HandoverState>(`/sales/orders/${id}/handover/messages/${messageId}`, { method: "DELETE" }));

/** Hands the order to Client Servicing. At Project Assign this also completes the lead, so the lead is refreshed too. */
export function useAssignClientServicing(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { csUserId: string; note?: string }) => api<HandoverState>(`/sales/orders/${id}/handover/assign`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(handoverKey(id), data);
      invalidateOrder(qc, id);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

/** Active Client Servicing people (handover dropdown). */
export function useClientServicingUsers(enabled = true) {
  return useQuery({ queryKey: ["sales", "cs-users"], queryFn: () => api<UserRef[]>("/sales/client-servicing-users"), enabled, staleTime: 5 * 60_000 });
}

/** Blank shop list in the columns the import understands: Shop Details Only without Size, Shop + Measurement with it. */
export async function downloadShopTemplate(type: "SHOP_DETAILS" | "SHOP_MEASUREMENT") {
  const { blob, fileName } = await apiBlob(`/sales/shop-list-template?type=${type}`);
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

/** Approval proof changes the approval tab and the lead's Client Rate Approval checklist. */
function refreshApproval(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["sales", "order", id, "approval"] });
  qc.invalidateQueries({ queryKey: ["leads", "lead", id], exact: true });
}

export function useApproval(id: string) {
  return useQuery({ queryKey: ["sales", "order", id, "approval"], queryFn: () => api<ApprovalOverview>(`/sales/orders/${id}/approval`) });
}

export function useUploadApproval(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FormData) => api<ApprovalDoc>(`/sales/orders/${id}/approval/documents`, { method: "POST", body }),
    onSuccess: () => refreshApproval(qc, id),
  });
}

export function useUpdateApproval(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, ...body }: { docId: string; approvalDate?: string | null; remarks?: string | null }) =>
      api<ApprovalDoc>(`/sales/approval/documents/${docId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => refreshApproval(qc, id),
  });
}

/** Deletes an approval document and erases its file (only before approval is complete). */
export function useDeleteApproval(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => api<ApprovalOverview>(`/sales/approval/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => refreshApproval(qc, id),
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
