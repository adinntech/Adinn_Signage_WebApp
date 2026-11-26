import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, type PageMeta } from "@/lib/api";
import { qs } from "./common";
import type { Decision, RecceStatus, ReviewStage, Workspace, WsVersion } from "./recceReview";

/**
 * Project Approval (Client Servicing / Recce Operations). Reads the same recce submissions and two-stage review as Recce Review
 * (`/recce-review`); the stage decision itself goes through the existing `useDecide`. Query keys sit under "recce-review", so every
 * review action refreshes these screens too.
 */
const KEY = "recce-review";
const B = "/recce-review";

export interface ApprovalProject {
  id: string;
  code: string;
  name: string;
  client: string | null;
  status: string;
  total: number;
  vendor: number;
  inhouse: number;
  allocated: number;
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  inProgress: number;
  progress: number;
}
export type ProjectStatusFilter = "all" | "pending" | "rejected" | "completed" | "in_progress";

export interface ApprovalOverview {
  project: { id: string; code: string; name: string; client: string | null; status: string };
  counts: Omit<ApprovalProject, "id" | "code" | "name" | "client" | "status"> & { notStarted: number; unallocated: number };
  stages: Record<ReviewStage, { approved: number; rejected: number; pending: number }>;
  team: { channel: "VENDOR" | "IN_HOUSE"; allocated: number; submitted: number; approved: number }[];
  performance: { name: string; group: "VENDOR" | "IN_HOUSE"; allocated: number; submitted: number; approved: number; percent: number }[];
  funnel: { assigned: number; visited: number; submitted: number; approved: number };
  trend: { date: string; submitted: number; approved: number }[];
  /** REVIEW = waiting for CS / OPS decision; RESUBMIT = sent back, waiting for the vendor / executive. */
  queue: { submissionId: string; siteId: string; shopName: string; version: number; kind: "REVIEW" | "RESUBMIT"; waitingFor: string[]; ageDays: number; overdue: boolean }[];
  queueTotal: number;
  alerts: { overdue: number; repeatedRejection: number; pendingVisit: number };
  activity: { id: string; type: string; label: string; actor: string; role: string; at: string; reason: string; shopName: string | null; submissionId: string; siteId: string | null }[];
}

export type ShopTab = "all" | "vendor" | "inhouse" | "submitted" | "approved" | "rejected" | "pending";
export interface StageCell {
  decision: Decision;
  reviewer: string | null;
  decidedAt: string | null;
}
export interface ApprovalShop {
  siteId: string;
  submissionId: string | null;
  shopName: string | null;
  siteCode: string;
  location: string | null;
  channel: "VENDOR" | "IN_HOUSE" | null;
  team: string | null;
  boardTypes: string[];
  quantity: number | null;
  visitStatus: "NOT_ALLOCATED" | "NOT_STARTED" | "VISITED" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED" | "REWORK" | "REJECTED";
  status: RecceStatus | null;
  version: number;
  cs: StageCell | null;
  ops: StageCell | null;
  gps: { lat: number; lng: number; at: string | null } | null;
  submittedAt: string | null;
  thumb: string | null;
}
export interface ApprovalShops {
  items: ApprovalShop[];
  tabs: Record<ShopTab, number>;
  meta: PageMeta;
}
export interface ShopRef {
  siteId: string;
  projectId: string;
  shopName: string | null;
  siteCode: string;
  submissionId: string | null;
  currentVersion: number;
  status: RecceStatus | null;
}

export interface ItemReview {
  id: string;
  versionNo: number;
  stage: ReviewStage;
  stageLabel: string;
  kind: "PHOTO" | "MEASUREMENT";
  ref: string;
  decision: "APPROVED" | "REJECTED";
  reason: string;
  reviewer: string | null;
  decidedAt: string | null;
}
export interface Board {
  key: string;
  name: string;
  quantity?: number;
  width?: number;
  height?: number;
  unit?: string;
  notes?: string;
  sided?: string;
  condition?: string;
  position?: string;
  installationNotes?: string;
}
export type Installation = Record<string, string | number | string[] | null>;
/** The review workspace as the backend sends it (fields the Recce Review screen does not type). */
export type ApprovalWorkspace = Omit<Workspace, "mediaItems" | "versions" | "checklist"> & {
  mediaItems: Board[];
  installation: Installation;
  itemReviews: ItemReview[];
  checklist: { key: string; label: string; stage: string; gps: boolean; required?: boolean }[];
  versions: (WsVersion & { mediaItems: Board[]; installation: Installation; installationRecorded: boolean; sequential: boolean })[];
};

export interface VersionCompare {
  from: { version: number; submittedAt: string; submittedBy: string | null };
  to: { version: number; submittedAt: string; submittedBy: string | null };
  photos: { added: { id: string; category: string }[]; replaced: { from: { id: string; category: string }; to: { id: string; category: string } }[]; removed: { id: string; category: string }[] };
  mediaItems: { added: Board[]; removed: Board[]; changed: { key: string; name: string; fields: { field: string; from: unknown; to: unknown }[] }[] };
  installation: { field: string; from: unknown; to: unknown }[];
  notes: { from: string; to: string } | null;
  changed: boolean;
}

export const useApprovalProjects = (p: { q?: string; status?: ProjectStatusFilter; page: number; limit: number }) =>
  useQuery({ queryKey: [KEY, "approval", "projects", p], queryFn: () => apiPage<ApprovalProject>(`${B}/approval/projects${qs(p)}`), placeholderData: keepPreviousData });
export const useApprovalOverview = (projectId: string) =>
  useQuery({ queryKey: [KEY, "approval", "overview", projectId], queryFn: () => api<ApprovalOverview>(`${B}/approval/projects/${projectId}`), refetchInterval: 60_000 });
export const useApprovalShops = (projectId: string, p: { tab: ShopTab; q?: string; page: number; limit: number }) =>
  useQuery({ queryKey: [KEY, "approval", "shops", projectId, p], queryFn: () => api<ApprovalShops>(`${B}/approval/projects/${projectId}/shops${qs(p)}`), placeholderData: keepPreviousData });
export const useShopRef = (siteId: string) => useQuery({ queryKey: [KEY, "approval", "shop", siteId], queryFn: () => api<ShopRef>(`${B}/approval/shops/${siteId}`) });
export const useApprovalWorkspace = (id: string | null | undefined) =>
  useQuery({ queryKey: [KEY, "ws", id], queryFn: () => api<ApprovalWorkspace>(`${B}/submissions/${id}`), enabled: !!id, refetchInterval: 45_000 });
export const useVersionCompare = (id: string, from: number, to: number, enabled: boolean) =>
  useQuery({ queryKey: [KEY, "compare", id, from, to], queryFn: () => api<VersionCompare>(`${B}/submissions/${id}/versions/compare${qs({ from, to })}`), enabled: enabled && from > 0 && to > from });

export interface ItemDecisionInput {
  versionNo: number;
  kind: "PHOTO" | "MEASUREMENT";
  ref: string;
  decision: "APPROVE" | "REJECT" | "CLEAR";
  reason?: string;
}
/** Approve / reject (with a reason) / clear one photo or measurement for the signed-in reviewer's own stage. */
export function useDecideItem(submissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ItemDecisionInput) => api<ApprovalWorkspace>(`${B}/submissions/${submissionId}/items`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: (ws) => {
      qc.setQueryData([KEY, "ws", submissionId], ws);
      qc.invalidateQueries({ queryKey: [KEY, "approval"] });
    },
  });
}
