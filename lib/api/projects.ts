import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs, type Attachment, type Ref } from "./common";

export const PROJECT_STATUSES = ["NEW", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const SOURCES = ["EMAIL", "PHONE", "WHATSAPP", "REFERRAL", "MEETING", "OTHER"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Source = (typeof SOURCES)[number];
export type SiteDataScenario = "MEASUREMENT_REQUIRED" | "CLIENT_PROVIDED";

export interface Requirement {
  _id?: string;
  source: Source;
  sourceNote?: string;
  contact?: { name?: string; phone?: string; email?: string };
  expectedSites?: number;
  locations: string[];
  description?: string;
  commercialNotes?: string;
  recceRequired: boolean;
  siteDataScenario: SiteDataScenario;
  attachments: Attachment[];
  updatedAt?: string;
}

export interface Project {
  _id: string;
  code: string;
  name: string;
  client: { _id: string; name: string; code: string };
  campaign?: string;
  status: ProjectStatus;
  statusReason?: string;
  priority: Priority;
  targetDate?: string;
  description?: string;
  recceRequired?: boolean;
  owner?: Ref | null;
  coordinator?: Ref | null;
  siteCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { name: string };
  requirement?: Requirement | null;
}

export interface ProjectSummary {
  total: number;
  newRequests: number;
  byStatus: Record<string, number>;
}

export interface ProjectListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  priority?: string;
  clientId?: string;
  ownerId?: string;
  sort?: string;
}

export interface ProjectCreateInput {
  clientId: string;
  campaign: string;
  name?: string;
  priority: Priority;
  targetDate?: string;
  description?: string;
  ownerId?: string;
  coordinatorId?: string;
  requirement: Requirement;
}

export interface ProjectPatchInput {
  name?: string;
  campaign?: string;
  priority?: Priority;
  description?: string;
  targetDate?: string | null;
  ownerId?: string | null;
  coordinatorId?: string | null;
}

export interface AuditEntry {
  _id: string;
  user?: { name: string; role: string } | null;
  role?: string;
  action: string;
  entity: string;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
  reason?: string;
  at: string;
}

export function useProjects(params: ProjectListParams, enabled = true) {
  return useQuery({
    queryKey: ["projects", "list", params],
    queryFn: () => apiPage<Project>(`/projects${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProjectSummary(enabled = true) {
  return useQuery({
    queryKey: ["projects", "summary"],
    queryFn: () => api<ProjectSummary>("/projects/summary"),
    enabled,
  });
}

export function useProject(id: string) {
  return useQuery({ queryKey: ["projects", "detail", id], queryFn: () => api<Project>(`/projects/${id}`), enabled: !!id });
}

export function useProjectHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: ["projects", "history", id],
    queryFn: () => api<AuditEntry[]>(`/projects/${id}/history`),
    enabled,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectCreateInput) => api<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

function useProjectMutation<V>(fn: (id: string, v: V) => Promise<unknown>, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => fn(id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["communications"] });
    },
  });
}

export const useUpdateProject = (id: string) =>
  useProjectMutation<ProjectPatchInput>(
    (pid, body) => api<Project>(`/projects/${pid}`, { method: "PATCH", body: JSON.stringify(body) }),
    id,
  );

export const useChangeStatus = (id: string) =>
  useProjectMutation<{ status: ProjectStatus; reason?: string }>(
    (pid, body) => api<Project>(`/projects/${pid}/status`, { method: "PATCH", body: JSON.stringify(body) }),
    id,
  );

export const useSaveRequirement = (id: string) =>
  useProjectMutation<Requirement>(
    (pid, body) => api<Requirement>(`/projects/${pid}/requirement`, { method: "PUT", body: JSON.stringify(body) }),
    id,
  );
