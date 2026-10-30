import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import type { Client, ClientType } from "./clients";
import { qs } from "./common";
import type { FileRef } from "./files";
import type { EmailInput, Order, SentEmail } from "./sales";

/** Every lead stage (same as the backend). The mind map today is LEAD_FLOW; the other stages are kept switched off. */
export const LEAD_STAGES = ["NEW_LEAD", "PROJECT_ASSIGN", "CLIENT_REGISTERED", "REQUIREMENT_DISCUSSION", "RATE_CARD", "NEGOTIATION", "CLIENT_APPROVAL"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_FLOW = ["NEW_LEAD", "PROJECT_ASSIGN"] as const satisfies readonly LeadStage[];
export type StageStatus = "DONE" | "CURRENT" | "PENDING" | "SKIPPED";

interface UserRef {
  _id: string;
  name: string;
  role?: string;
}

export interface LeadInfo {
  stage: LeadStage;
  stageChangedAt?: string;
  startedAt?: string;
  startedBy?: UserRef | null;
  initialNotes?: string;
  /** COMPLETED = the project is assigned (lead done). */
  status: "OPEN" | "CLOSED" | "COMPLETED";
  completedAt?: string;
  completedBy?: UserRef | null;
  closedAt?: string;
  closedBy?: UserRef | null;
  closeReason?: string;
}
export interface LeadStageState {
  key: LeadStage;
  label: string;
  number: number;
  status: StageStatus;
  /** False for stages that arrive in a later Lead Management update. */
  available: boolean;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
}
export interface LeadHistoryEntry {
  id: string;
  /** STEP: a Project Assign step saved; CLIENT_CHANGE: the lead's client was switched. */
  action: "START" | "COMPLETE" | "BACK" | "CLOSE" | "REOPEN" | "NOTES" | "STEP" | "CLIENT_CHANGE";
  fromStage: LeadStage | null;
  toStage: LeadStage | null;
  note: string | null;
  step?: string | null;
  /** Value before / after the change (STEP, CLIENT_CHANGE). */
  oldValue?: unknown;
  newValue?: unknown;
  by: string;
  role: string;
  at: string;
}
export interface LeadDetail {
  order: Order;
  lead: LeadInfo;
  stages: LeadStageState[];
  /** What is still needed before the current stage can be completed. */
  missing: string[];
  nextStage: LeadStage | null;
  previousStage: LeadStage | null;
  /** The current stage is the last one: completing it completes the lead. */
  lastStage: boolean;
  nextAvailable: boolean;
  /** Project Assign route taken by the first save (HANDOVER: handover details; RECCE: the code request email). */
  route?: "HANDOVER" | "RECCE" | null;
  handover: {
    unlocked: boolean;
    assignee: UserRef | null;
    assignedAt: string | null;
    /** Last save of any handover detail. */
    updatedAt?: string | null;
    type: "ASO" | "SHOP_DETAILS" | "SHOP_MEASUREMENT" | null;
    /** Assign to Client Servicing toggle: full handover (true) or client details and contacts only (false). */
    full?: boolean;
    shops?: LeadShops | null;
    /** Nothing missing before the Client Servicing person can be assigned. */
    ready?: boolean;
    missing?: string | null;
  };
  /** Project Assign: Recce team branch. */
  recce: {
    available: boolean;
    assignee: UserRef | null;
    assignedAt: string | null;
    projectCode?: string | null;
    estimationCode?: string | null;
    codesSavedAt?: string | null;
    clientId?: string | null;
    /** `done`: an email recorded as sent, or not sent only because mail is off (unlocks the codes). */
    emails?: { count: number; lastSentAt: string | null; lastStatus: "SENT" | "FAILED" | "SKIPPED" | null; done?: boolean };
    /** The full handover (type and details) is complete. */
    handoverReady?: boolean;
    /** Recce step 1 (Handover Type & Details) confirmed with Continue. */
    handoverDone?: boolean;
    missing?: string | null;
  };
  summary: { notes: number; documents: number; rateCardLabel: string | null; negotiationRounds: number; approvalDocuments: number };
  /** Client Registered: latest onboarding form PDF, and whether the PHP mail service is connected. */
  onboarding: { pdf: FileRef | null; mailEnabled: boolean };
  history: LeadHistoryEntry[];
  /** Create Project > Change Client: allowed until a Project Assign route is taken. */
  clientChange?: { allowed: boolean; reason: string | null };
}

/** Shop list summary for the mind map: rows, valid rows, Total Shops and whether it is verified. */
export interface LeadShops {
  total: number;
  valid: number;
  declared: number | null;
  verified: boolean;
}

export const ORGANISATION_TYPES = {
  PROPRIETORSHIP: "Proprietorship",
  PARTNERSHIP: "Partnership",
  PVT_LTD: "Pvt. Ltd.",
  LLP: "LLP",
  PUBLIC_LTD: "Public Ltd.",
  OTHERS: "Others",
} as const;
export type OrganisationType = keyof typeof ORGANISATION_TYPES;
export interface OnboardingPerson {
  name?: string;
  designation?: string;
  mobile?: string;
  email?: string;
}
export interface OnboardingTeam {
  primary?: OnboardingPerson | null;
  escalation?: OnboardingPerson | null;
}
/** Customer Onboarding Form (company name, email and GST come from the client record). */
export interface OnboardingForm {
  organisationType?: OrganisationType;
  organisationOther?: string;
  pan?: string;
  msmeApplicable?: boolean;
  msmeNumber?: string;
  primaryPhone?: string;
  registered?: Partial<Record<"floorNo" | "buildingNo" | "premises" | "road" | "locality" | "city" | "district" | "state" | "pincode", string>> | null;
  branchAddress?: string;
  keyManagement: OnboardingPerson[];
  accounts?: OnboardingTeam | null;
  finance?: OnboardingTeam | null;
}
export interface OnboardingState {
  client: { _id: string; name: string; email: string | null; gstin: string | null };
  form: OnboardingForm;
  /** False while the form is only prefilled from the client record. */
  saved: boolean;
  pdf: FileRef | null;
  pdfAt: string | null;
  pdfBy: string | null;
  mailEnabled: boolean;
  from: string | null;
  draft: { to: string[]; cc: string[]; subject: string; body: string };
}
export interface LeadRow {
  _id: string;
  orderNo: string;
  client: Pick<Client, "_id" | "name" | "clientName" | "clientNo" | "city">;
  clientType: ClientType;
  owner?: UserRef | null;
  csAssignee?: UserRef | null;
  lead: LeadInfo;
  stageLabel: string;
  stageNumber: number;
  stageCount: number;
  rateCardLabel: string | null;
  createdAt: string;
}
export interface LeadSummary {
  open: number;
  closed: number;
  completed: number;
  waiting: number;
  stages: Record<LeadStage, number>;
}
export interface LeadCandidate {
  _id: string;
  orderNo: string;
  clientType: ClientType;
  client: Pick<Client, "_id" | "name" | "clientName" | "clientNo" | "city">;
  createdAt: string;
}
export interface RequirementNote {
  _id: string;
  body?: string;
  attachments: FileRef[];
  createdBy?: UserRef;
  role?: string;
  createdAt: string;
}
export interface LeadListParams {
  page?: number;
  limit?: number;
  q?: string;
  stage?: string;
  status?: string;
  clientType?: string;
  sort?: string;
}

const leadKey = (id: string) => ["leads", "lead", id] as const;

/** A lead move also changes the lead list, the KPI counts and the order itself. */
function invalidateLead(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["leads", "list"] });
  qc.invalidateQueries({ queryKey: ["leads", "summary"] });
  qc.invalidateQueries({ queryKey: ["leads", "candidates"] });
  qc.invalidateQueries({ queryKey: ["sales", "orders"] });
  if (id) qc.invalidateQueries({ queryKey: ["sales", "order", id] });
}

export function useLeads(params: LeadListParams) {
  return useQuery({ queryKey: ["leads", "list", params], queryFn: () => apiPage<LeadRow>(`/sales/leads${qs(params)}`), placeholderData: keepPreviousData });
}

export function useLeadSummary() {
  return useQuery({ queryKey: ["leads", "summary"], queryFn: () => api<LeadSummary>("/sales/leads/summary") });
}

/** Orders that are not leads yet (New Lead: "Select Order"). */
export function useLeadCandidates(q: string, enabled = true) {
  return useQuery({ queryKey: ["leads", "candidates", q], queryFn: () => api<LeadCandidate[]>(`/sales/leads/candidates${qs({ q })}`), enabled, placeholderData: keepPreviousData });
}

export function useLead(id: string | undefined) {
  return useQuery({ queryKey: leadKey(id ?? ""), queryFn: () => api<LeadDetail>(`/sales/leads/${id}`), enabled: !!id });
}

export function useStartLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { orderId: string; initialNotes?: string }) => api<LeadDetail>("/sales/leads", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(leadKey(data.order._id), data);
      invalidateLead(qc, data.order._id);
    },
  });
}

/** Every lead move returns the whole lead, which replaces the cached one. */
function useLeadMutation<V>(id: string, fn: (v: V) => Promise<LeadDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(leadKey(id), data);
      invalidateLead(qc, id);
    },
  });
}

const post = (path: string, body: unknown) => api<LeadDetail>(path, { method: "POST", body: JSON.stringify(body) });
export const useCompleteLeadStage = (id: string) => useLeadMutation(id, (b: { stage: LeadStage; note?: string }) => post(`/sales/leads/${id}/complete`, b));
export const usePreviousLeadStage = (id: string) => useLeadMutation(id, (b: { stage: LeadStage; note?: string }) => post(`/sales/leads/${id}/back`, b));
export const useCloseLead = (id: string) => useLeadMutation(id, (reason: string) => post(`/sales/leads/${id}/close`, { reason }));
export const useReopenLead = (id: string) => useLeadMutation(id, () => post(`/sales/leads/${id}/reopen`, {}));
/** Create Project > Change Client (same order and lead; the switch is kept in the lead history). */
export function useChangeLeadClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { clientType: "NEW" | "EXISTING"; clientId?: string; zohoId?: string }) => post(`/sales/leads/${id}/client`, b),
    onSuccess: (data) => {
      qc.setQueryData(leadKey(id), data);
      invalidateLead(qc, id);
      // Order Management shows the order's client too.
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}
export const useLeadInitialNotes = (id: string) =>
  useLeadMutation(id, (initialNotes: string) => api<LeadDetail>(`/sales/leads/${id}/notes`, { method: "PATCH", body: JSON.stringify({ initialNotes }) }));

const onboardingKey = (id: string) => [...leadKey(id), "onboarding"] as const;

export function useOnboarding(id: string) {
  return useQuery({ queryKey: onboardingKey(id), queryFn: () => api<OnboardingState>(`/sales/leads/${id}/onboarding`) });
}

/** Saves the form on the client and generates a new PDF; the lead's checklist changes with it. */
export function useSaveOnboarding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardingForm) => api<OnboardingState>(`/sales/leads/${id}/onboarding`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(onboardingKey(id), data);
      qc.invalidateQueries({ queryKey: leadKey(id), exact: true });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useSendOnboarding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EmailInput) => api<SentEmail>(`/sales/leads/${id}/onboarding/send`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", "order", id, "emails"] });
      qc.invalidateQueries({ queryKey: leadKey(id), exact: true });
    },
  });
}

const notesKey = (id: string) => [...leadKey(id), "requirements"] as const;

export function useRequirementNotes(id: string) {
  return useQuery({ queryKey: notesKey(id), queryFn: () => api<RequirementNote[]>(`/sales/leads/${id}/requirements`) });
}

export function useAddRequirementNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FormData) => api<RequirementNote>(`/sales/leads/${id}/requirements`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesKey(id) });
      qc.invalidateQueries({ queryKey: leadKey(id), exact: true });
    },
  });
}

export function useDeleteRequirementNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api<unknown>(`/sales/leads/${id}/requirements/${noteId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesKey(id) });
      qc.invalidateQueries({ queryKey: leadKey(id), exact: true });
    },
  });
}
