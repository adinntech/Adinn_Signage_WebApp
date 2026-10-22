/**
 * BD -> Operations pipeline API: project drafting and assignment, Operations stages, client documents,
 * ASO survey areas, shop approvals and notifications. One module so the screens share query keys.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage, apiUpload } from "@/lib/api";
import { qs } from "./common";
import type { Priority, Project, ProjectContact, ProjectStatus, RequirementType } from "./projects";
import type { Site } from "./sites";

/* -------------------------------- projects --------------------------------- */

export interface PipelineProjectInput {
  clientId?: string;
  code?: string;
  campaign: string;
  status?: "DRAFT" | "ENQUIRY";
  priority: Priority;
  startDate?: string;
  targetDate?: string;
  district?: string;
  instructions?: string;
  requirementType?: RequirementType;
  expectedShops?: number | null;
  contacts?: ProjectContact[];
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["projects"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
};

export function useCreatePipelineProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PipelineProjectInput) => api<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdatePipelineProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<PipelineProjectInput, "clientId" | "status">> }) =>
      api<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAssignProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) =>
      api<Project>(`/projects/${id}/assign`, { method: "POST", body: JSON.stringify({ assigneeId }) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAdvanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: "PLANNING" | "IN_PROGRESS" | "CLIENT_APPROVAL" | "COMPLETED" }) =>
      api<Project>(`/projects/${id}/stage`, { method: "POST", body: JSON.stringify({ stage }) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeletePipelineProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCancelProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<Project>(`/projects/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" satisfies ProjectStatus, reason }) }),
    onSuccess: () => invalidate(qc),
  });
}

export interface Assignee {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string | null;
}
export function useAssignees(enabled = true) {
  return useQuery({ queryKey: ["projects", "assignees"], queryFn: () => api<Assignee[]>("/projects/assignees"), enabled, staleTime: 60_000 });
}

export interface ActivityItem {
  id: string;
  at: string;
  text: string;
  by: string;
  projectId: string;
  code: string;
  client: string;
}
export function useRecentActivity() {
  return useQuery({ queryKey: ["projects", "activity"], queryFn: () => api<ActivityItem[]>("/projects/activity"), refetchInterval: 60_000 });
}

/* ------------------------------ client documents ---------------------------- */

export const FILE_CATEGORIES = ["BD_CLIENT_DETAILS", "RECCE_IMAGE_ORIGINAL", "RECCE_IMAGE_EDITED", "RECCE_ACKNOWLEDGEMENT", "RECCE_EXPENSE", "OPS_SURVEY_PROOF"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export interface StoredFile {
  id: string;
  project: string;
  category: FileCategory;
  originalName: string;
  mimeType?: string;
  kind: "image" | "video" | "document" | "sheet";
  size: number;
  storage: "local" | "space";
  /** Full public URL (Spaces only). */
  url?: string;
  section?: string;
  createdAt: string;
}

export function useProjectFiles(projectId: string | undefined, category?: FileCategory) {
  return useQuery({
    queryKey: ["files", projectId, category ?? "all"],
    queryFn: () => api<StoredFile[]>(`/projects/${projectId}/files${qs({ category })}`),
    enabled: !!projectId,
  });
}

/** Uploads one request per file so one rejected file (duplicate, wrong type) never blocks the rest. */
export async function uploadProjectFiles(projectId: string, category: FileCategory, files: File[]) {
  const results: { file: File; ok: boolean; error?: string }[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.set("category", category);
    fd.append("files", file);
    try {
      await api<StoredFile[]>(`/projects/${projectId}/files`, { method: "POST", body: fd });
      results.push({ file, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: e instanceof Error ? e.message : "Upload failed" });
    }
  }
  return results;
}

export function useUploadFiles(projectId: string, category: FileCategory) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => uploadProjectFiles(projectId, category, files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files", projectId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteFile(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string; removed: "hidden" | "erased" }>(`/files/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", projectId] }),
  });
}

export type Disposition = "inline" | "attachment";
export interface FileLink {
  url: string;
  name: string;
  mimeType?: string;
}

/** Files are private. This asks for a short-lived link: inline to view in the browser, attachment to save to disk. */
export const fileLink = (id: string, disposition: Disposition = "inline") => api<FileLink>(`/files/${id}/url${qs({ disposition })}`);

/** Opens the file in a new tab (browser viewer). */
export async function openFile(id: string) {
  const r = await fileLink(id);
  window.open(r.url, "_blank", "noopener,noreferrer");
}

/** Saves the file to the computer under its ORIGINAL name (the server sends it as an attachment with that name). */
export async function downloadFile(id: string) {
  const r = await fileLink(id, "attachment");
  const a = document.createElement("a");
  a.href = r.url;
  a.download = r.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Short-lived viewing link for thumbnails and the preview window; cached for a few minutes (links last 10). */
export function useFileUrl(id: string | undefined, enabled = true) {
  return useQuery({ queryKey: ["file-url", id], queryFn: () => fileLink(id!), enabled: enabled && !!id, staleTime: 5 * 60_000 });
}

/* ------------------------------ ASO survey areas ---------------------------- */

export interface SurveyArea {
  _id: string;
  project: string;
  area: string;
  notes?: string;
  shopsFound: number;
  createdAt: string;
}
export interface SurveyAreaInput {
  area: string;
  notes?: string;
  shopsFound: number;
}
const areasKey = (pid: string) => ["survey-areas", pid] as const;

export function useSurveyAreas(pid: string | undefined, enabled = true) {
  return useQuery({ queryKey: areasKey(pid ?? ""), queryFn: () => api<SurveyArea[]>(`/projects/${pid}/survey-areas`), enabled: enabled && !!pid });
}
export function useSaveSurveyArea(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: SurveyAreaInput }) =>
      id
        ? api<SurveyArea>(`/projects/${pid}/survey-areas/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api<SurveyArea>(`/projects/${pid}/survey-areas`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: areasKey(pid) }),
  });
}
export function useDeleteSurveyArea(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/projects/${pid}/survey-areas/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: areasKey(pid) }),
  });
}

/* ------------------------------ shop approvals ------------------------------ */

export type ApprovalState = "PENDING" | "APPROVED" | "CORRECTION";
export type ApprovalLevel = "ops" | "bd";
export type ApprovalSite = Site & { opsApproval?: ApprovalState; bdApproval?: ApprovalState; approvalNote?: string };

export function useApprovalSites(pid: string, enabled = true) {
  return useQuery({
    queryKey: ["sites", pid, "approvals"],
    queryFn: () => apiPage<ApprovalSite>(`/projects/${pid}/sites${qs({ limit: 200, sort: "seq" })}`),
    placeholderData: keepPreviousData,
    enabled: enabled && !!pid,
  });
}
export function useSetApproval(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, level, value, note }: { siteId: string; level: ApprovalLevel; value: ApprovalState; note?: string }) =>
      api<ApprovalSite>(`/sites/${siteId}/approval`, { method: "POST", body: JSON.stringify({ level, value, note }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites", pid] }),
  });
}
export function useApproveAll(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (level: ApprovalLevel) =>
      api<{ approved: number; stillPending: number }>(`/projects/${pid}/sites/approve-all`, { method: "POST", body: JSON.stringify({ level }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites", pid] }),
  });
}

/* ------------------------------- notifications ------------------------------ */

export type NotificationKindKey = "activity" | "assigned" | "documents" | "imported" | "stage" | "approval" | "cancelled";

export interface NotificationItem {
  id: string;
  kind: NotificationKindKey;
  title: string;
  text: string;
  at: string;
  projectId: string;
  projectCode: string;
  client: string;
  read: boolean;
}

/** Notifications addressed to the signed-in person, newest first. */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: NotificationItem[]; unread: number }>("/notifications"),
    enabled,
    // The live stream makes arrival instant; polling and focus refetch are the safety net if it is blocked or asleep.
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>("/notifications/read", { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** Where a notification should take this person: Operations opens the task, BD opens the project drawer. */
const OPS_TAB: Partial<Record<NotificationKindKey, string>> = { documents: "documents", imported: "work", approval: "approvals" };
export const notificationHref = (role: string | undefined, projectId: string, kind?: NotificationKindKey) =>
  role === "OPERATIONS" || role === "RECCE_COORDINATOR" ? `/operations/projects/${projectId}${kind && OPS_TAB[kind] ? `?tab=${OPS_TAB[kind]}` : ""}` : role === "BD" ? `/bd/dashboard?view=${projectId}` : "/dashboard";

export interface NotificationLogRow {
  id: string;
  kind: NotificationKindKey;
  title: string;
  at: string;
  recipient: { name: string; role: string; email: string } | null;
  readAt: string | null;
  deliveries: { channel: "EMAIL" | "PUSH"; status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED"; to?: string; attempts: number; lastError: string | null; sentAt: string | null }[];
}

/** Who was told about a project, whether they opened it, and the email outcome (BD and admins). */
export function useNotificationLog(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["notification-log", projectId],
    queryFn: () => api<NotificationLogRow[]>(`/projects/${projectId}/notification-log`),
    enabled: enabled && !!projectId,
    refetchInterval: 20_000,
  });
}

/* ---------------------- duplicate check + upload with progress ---------------------- */

export interface DuplicateCheckRow {
  sha256: string;
  duplicate: boolean;
  existingName: string | null;
}

/** Asks the server which of these file hashes are already stored for the project + category. */
export const checkFileDuplicates = (projectId: string, category: FileCategory, hashes: string[]) =>
  api<DuplicateCheckRow[]>(`/projects/${projectId}/files/check`, {
    method: "POST",
    body: JSON.stringify({ category, files: hashes.map((sha256) => ({ sha256 })) }),
  });

export interface FileLimits {
  maxFileBytes: number;
  maxImageBytes: number;
  maxVideoBytes: number;
  extensions: string[];
}

/** The server's size limits and allowed types, so files are checked the moment they are picked. */
export function useFileLimits() {
  return useQuery({ queryKey: ["file-limits"], queryFn: () => api<FileLimits>("/files/limits"), staleTime: 60 * 60_000 });
}

/** Uploads one file and reports 0-100 progress. Pass a signal to be able to cancel it. */
export function uploadFileWithProgress(projectId: string, category: FileCategory, file: File, onProgress: (p: number) => void, signal?: AbortSignal) {
  const fd = new FormData();
  fd.set("category", category);
  fd.append("files", file);
  return apiUpload<StoredFile[]>(`/projects/${projectId}/files`, fd, signal ? { onProgress, signal } : { onProgress });
}
