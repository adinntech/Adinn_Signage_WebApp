import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";

export type StageKey = "HANDOVER" | "CLIENT_CODE" | "PROJECT_CODE" | "RECCE_ASSIGNED" | "PLANNING" | "FIELD_RECCE" | "CLIENT_APPROVAL" | "COMPLETED";
export type StageState = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "BLOCKED" | "NOT_APPLICABLE";

export interface JourneyStage {
  key: StageKey;
  label: string;
  index: number;
  state: StageState;
  assignee: string | null;
  startedAt: string | null;
  completedAt: string | null;
  elapsedDays: number | null;
  detail: string | null;
  dependsOn: string[];
  waitingOn: string[];
  pendingActions: string[];
  overdue: boolean;
  overdueReason: string | null;
  notes: { text: string; at: string }[];
  attachments: number;
  comments: { id: string; text: string; at: string; author: string; authorId: string }[];
}
export interface Journey {
  project: {
    _id: string;
    code: string;
    name: string;
    status: string;
    priority: string;
    targetDate: string | null;
    startDate: string | null;
    client: { _id: string; name: string; clientNo: string | null };
    assignedTo: string | null;
    owner: string | null;
  };
  currentStage: StageKey;
  progress: number;
  overdue: boolean;
  stages: JourneyStage[];
}
export interface PortfolioRow {
  _id: string;
  code: string;
  name: string;
  status: string;
  priority: string;
  targetDate: string | null;
  client: { name: string; clientNo: string | null };
  assignedTo: string | null;
  states: StageState[];
  overdue: boolean;
}
export interface PortfolioMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  stages: { key: StageKey; label: string }[];
  summary: { total: number; recceAssigned: number; planning: number; inProgress: number; clientApproval: number; completed: number; halted: number; overdue: number };
}
export interface PortfolioParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  stage?: string;
  overdue?: boolean;
}

export const usePortfolio = (params: PortfolioParams) =>
  useQuery({ queryKey: ["journey", "portfolio", params], queryFn: () => apiPage<PortfolioRow>(`/journey/portfolio${qs(params)}`), placeholderData: keepPreviousData });

export const useJourney = (id: string | undefined) => useQuery({ queryKey: ["journey", "project", id], queryFn: () => api<Journey>(`/journey/projects/${id}`), enabled: !!id });

/** Both comment calls answer with the refreshed journey, so the page updates without a second fetch. */
function useCommentCall<V>(projectId: string, call: (v: V) => Promise<Journey>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: call, onSuccess: (data) => qc.setQueryData(["journey", "project", projectId], data) });
}
export const useAddJourneyComment = (projectId: string) =>
  useCommentCall(projectId, (v: { stage: StageKey; body: string }) => api<Journey>(`/journey/projects/${projectId}/comments`, { method: "POST", body: JSON.stringify(v) }));
export const useDeleteJourneyComment = (projectId: string) =>
  useCommentCall(projectId, (commentId: string) => api<Journey>(`/journey/projects/${projectId}/comments/${commentId}`, { method: "DELETE" }));
