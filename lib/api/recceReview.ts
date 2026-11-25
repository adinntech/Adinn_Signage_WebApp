import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";

export type ReviewStage = "OPS" | "CS";
export type RecceStatus = "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REWORK_REQUIRED" | "REJECTED";
export type Decision = "PENDING" | "APPROVED" | "REJECTED" | "REWORK" | "VOID";

export interface InboxRow {
  id: string;
  siteId: string;
  shopName: string | null;
  siteCode: string;
  district: string | null;
  projectId: string;
  projectCode: string;
  projectName: string;
  client: string | null;
  assignee: string | null;
  channel: "VENDOR" | "IN_HOUSE" | null;
  submittedAt: string | null;
  photoCount: number;
  mediaTypes: string[];
  version: number;
  attempts: number;
  status: RecceStatus;
  priority: "LOW" | "NORMAL" | "HIGH";
  stages: { stage: ReviewStage; label: string; decision: Decision; reviewer: string | null }[];
  pendingStage: ReviewStage | null;
  pendingStageLabel: string | null;
  pendingReviewer: string | null;
  dueAt: string | null;
  overdue: boolean;
  pendingDays: number;
}

export interface InboxFilters {
  view?: "pending" | "mine" | "all";
  projectId?: string;
  client?: string;
  district?: string;
  q?: string;
  mediaType?: string;
  status?: RecceStatus | "";
  reviewer?: string;
  from?: string;
  to?: string;
  overdue?: "true" | "";
  priority?: string;
  page?: number;
}

export interface WsPhoto {
  id: string;
  category: string;
  mediaKey: string;
  caption: string;
  state: "SUBMITTED" | "SUPERSEDED" | "REMOVED";
  version: number | null;
  url: string | null;
  editedUrl: string | null;
  hasEdited: boolean;
  capturedAt: string | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
  lat: number | null;
  lng: number | null;
  gpsAccuracy: number | null;
  width: number | null;
  height: number | null;
  size: number | null;
  flags: { code: string; message: string }[];
  removedAt: string | null;
  removedBy: string | null;
  removeReason: string | null;
  replaces: string | null;
  supersededBy: string | null;
}
export interface WsReview {
  stage: ReviewStage;
  stageLabel: string;
  decision: Decision;
  reviewer: string | null;
  decidedAt: string | null;
  comment: string;
  checklist: { key: string; label: string; passed: boolean }[];
  override: { reason: string; by: string | null } | null;
  /** Earlier answers of this stage that were replaced (a stage that approved and later changed its decision), oldest first. */
  history: { decision: string | null; reviewer: string | null; decidedAt: string | null; comment: string; changedAt: string | null }[];
}
export interface WsVersion {
  id: string;
  version: number;
  /** The boards as they were in this version (media type, quantity, size). */
  mediaItems: BoardItem[];
  /** Installation feasibility as it was in this version (absent on versions made before it was recorded). */
  installation?: ShopInstallation;
  submittedAt: string;
  submittedBy: string | null;
  photoIds: string[];
  addedIds: string[];
  removedIds: string[];
  notes: string;
  stages: ReviewStage[];
  dueAt: string | null;
  reviews: WsReview[];
}
export interface WsRework {
  id: string;
  versionNo: number;
  stage: ReviewStage;
  stageLabel: string;
  kind: "REWORK" | "ADDITIONAL";
  status: "OPEN" | "RESOLVED" | "CLOSED";
  instructions: string;
  requestedBy: string | null;
  requestedAt: string;
  items: { id: string; type: string; category: string | null; categoryLabel: string | null; mediaKey: string; photo: string | null; note: string; rejected?: boolean; /** a reworked checklist item: the phone section it shows in, and its label (note = the remark of that item) */ section?: string | null; label?: string; resolved: boolean; resolvedInVersion: number | null }[];
}
/** What a reviewer marked on one photo or one board detail. One per (version, stage, thing); an earlier answer moves into `history`. A reason is mandatory for REJECTED / REWORK. */
export type MarkDecision = "APPROVED" | "REJECTED" | "REWORK";
export type BoardField = "MEDIA_TYPE" | "QUANTITY" | "SIZE";
export interface WsMark {
  id: string;
  versionNo: number;
  stage: ReviewStage;
  stageLabel: string;
  kind: "PHOTO" | "BOARD" | "CHECK";
  photo: string | null;
  mediaKey: string;
  field: BoardField | null;
  /** The checklist item (key and label) of a CHECK mark. */
  check: string | null;
  label: string | null;
  decision: MarkDecision;
  reason: string;
  reviewer: string | null;
  at: string | null;
  /** The stage already sent it to the recce person (it became a rework item). */
  sent: boolean;
  history: { decision: string | null; reason: string; reviewer: string | null; at: string | null; changedAt: string | null }[];
}
/** One thing to mark: a photo, a board detail or a checklist item. `reason` is the remark of THIS item (each selected item has its own). */
export type MarkTarget = ({ kind: "PHOTO"; photo: string } | { kind: "BOARD"; mediaKey: string; field: BoardField } | { kind: "CHECK"; key: string }) & { reason?: string };
export interface MarksInput { stage: ReviewStage; versionNo: number; decision: MarkDecision; reason: string; targets: MarkTarget[] }

/** One physical board of a shop. `key` is its permanent id (a photo's `mediaKey` points at it). `mediaType` + `seq` make its number ("GSB-01"); boards made before numbers existed have neither. */
export interface BoardItem {
  key: string; name: string; mediaType?: string | null; seq?: number | null; quantity?: number; width?: number; height?: number; unit?: string; notes?: string;
  /** SINGLE / DOUBLE, EXISTING / PROPOSED, where the board sits, and the installation requirement of THIS board (catalog installation code + the answers to its site questions, by question key). */
  sided?: string | null; condition?: string | null; position?: string | null; installationNotes?: string | null; mediaCode?: string | null;
  installationType?: string | null; answers?: Record<string, string | number | boolean> | null;
}
/** The shop-level installation feasibility the recce person answered (YES / NO / NOT_ASSESSED; a missing answer is NOT_ASSESSED, never NO). */
export interface ShopInstallation {
  ladderRequired: string; scaffoldingRequired: string; craneRequired: string; hydraRequired: string; manualInstallationPossible: string; electricalAccess: string;
  installationHeightFt: number | null; accessRestrictions: string[]; obstruction: string; roadsideConstraints: string; safetyNotes: string; additionalEquipment: string[]; notes: string;
}
/** "GSB-01" for a numbered board; the name for an older line. */
export const boardLabel = (b: Pick<BoardItem, "name" | "mediaType" | "seq">) => (b.mediaType && b.seq ? `${b.mediaType}-${String(b.seq).padStart(2, "0")}` : b.name);
export interface Workspace {
  id: string;
  status: RecceStatus;
  currentVersion: number;
  attempts: number;
  priority: string;
  submittedAt: string | null;
  dueAt: string | null;
  overdue: boolean;
  pendingStage: ReviewStage | null;
  assignee: string | null;
  channel: string | null;
  notes: string;
  mediaItems: BoardItem[];
  installation?: ShopInstallation;
  reviewers: { OPS: { id: string; name: string } | null; CS: { id: string; name: string } | null };
  shop: { id: string; code: string; name: string | null; dealer: string | null; district: string | null; contactPerson: string | null; mobile: string | null; address: string; lat: number | null; lng: number | null; boardType: string | null };
  project: { id: string; code: string; name: string; client: string | null; requirementType: string | null; closed: boolean };
  versions: WsVersion[];
  photos: WsPhoto[];
  reworks: WsRework[];
  marks: WsMark[];
  checklist: { key: string; label: string; stage: string; gps: boolean }[];
  categories: { key: string; label: string }[];
  me: { stage: ReviewStage | null; canDecide: boolean; /** my stage approved this version: I may still change it to Rework / More photos / Reject */ canChange: boolean; /** I may tick photos / board details and mark them Approved, Rejected or Rework */ canMark: boolean; openStage: ReviewStage | null; isAdmin: boolean; canReopen: boolean };
}
export interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  actor: string;
  role: string;
  at: string;
  reason: string;
  mediaKey: string | null;
  photo: string | null;
  version: number | null;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
}
export interface ShopMessage {
  id: string;
  author: { id: string; name: string; role: string };
  body: string;
  card: { title: string; lines: { label: string; value: string }[]; path: string | null; tone: string | null } | null;
  createdAt: string;
}
export interface Progress {
  totals: { assigned: number; notStarted: number; inProgress: number; submitted: number; underReview: number; approved: number; reworkRequired: number; rejected: number; completed: number };
  completionPercent: number;
  pendingReview: number;
  pendingRework: number;
  overdueReviews: number;
  avgReviewHours: number | null;
  avgAttempts: number;
  mediaTypes: { name: string; total: number; approved: number; percent: number }[];
  reviewerWorkload: { reviewer: string; pending: number; decided: number }[];
}
export interface Perf {
  name: string;
  group: string;
  total: number;
  approved: number;
  rework: number;
  pending: number;
  attempts: number;
  completionPercent: number;
  avgAttempts: number;
}
export interface MonitorEvent {
  id: string;
  type: string;
  label: string;
  actor: string;
  at: string;
  reason: string;
  submissionId: string;
}
export interface Monitor {
  activeProjects: number;
  projects: { id: string; code: string; name: string }[];
  totals: { shops: number; awaitingReview: number; overdue: number; reworkBacklog: number; pendingAdditionalPhotos: number; approved: number };
  slaPercent: number | null;
  avgDecisionHours: number | null;
  overdue: InboxRow[];
  awaiting: InboxRow[];
  vendorCompletion: Perf[];
  inHouseCompletion: Perf[];
  reviewPerformance: { reviewer: string; approved: number; rework: number; rejected: number }[];
  approvalHistory: MonitorEvent[];
  deletedPhotoActivity: MonitorEvent[];
}
export interface RecceConfig {
  stages: ReviewStage[];
  sequential: boolean;
  allowRetryAfterReject: boolean;
  slaHours: number;
  maxPhotos: number;
  requireGps: boolean;
  checklist: { key: string; label: string; stage: string; gps?: boolean }[];
  requiredPhotos: Record<string, string[]>;
}

const KEY = "recce-review";
const B = "/recce-review";

export const useInbox = (f: InboxFilters) =>
  useQuery({ queryKey: [KEY, "inbox", f], queryFn: () => apiPage<InboxRow>(`${B}/inbox${qs({ ...f, limit: 20 })}`), placeholderData: keepPreviousData, refetchInterval: 60_000 });
/** Refreshed at once by the live notification of the other team's answer (see LiveNotifications); the 15 s poll is the fallback when that stream is down. */
export const useWorkspace = (id: string) => useQuery({ queryKey: [KEY, "ws", id], queryFn: () => api<Workspace>(`${B}/submissions/${id}`), refetchInterval: 15_000 });
export const useTimeline = (id: string, f: { type?: string; person?: string; from?: string; to?: string }) =>
  useQuery({ queryKey: [KEY, "timeline", id, f], queryFn: () => api<TimelineEvent[]>(`${B}/submissions/${id}/activity${qs(f)}`) });
export const useShopThread = (id: string) => useQuery({ queryKey: [KEY, "thread", id], queryFn: () => api<ShopMessage[]>(`${B}/submissions/${id}/messages`), refetchInterval: 30_000 });
export const useProgress = (projectId?: string) => useQuery({ queryKey: [KEY, "progress", projectId ?? ""], queryFn: () => api<Progress>(`${B}/progress${qs({ projectId })}`) });
export const useMonitor = (enabled: boolean) => useQuery({ queryKey: [KEY, "monitor"], queryFn: () => api<Monitor>(`${B}/monitor`), enabled, refetchInterval: 120_000 });
export const useReviewers = () => useQuery({ queryKey: [KEY, "reviewers"], queryFn: () => api<{ id: string; name: string; stage: ReviewStage }[]>(`${B}/reviewers`), staleTime: 5 * 60_000 });
export const useRecceConfig = () => useQuery({ queryKey: [KEY, "config"], queryFn: () => api<RecceConfig>(`${B}/config`) });

function useAct<V>(id: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export interface DecisionInput {
  stage: ReviewStage;
  decision: "APPROVE" | "REJECT" | "REWORK" | "ADDITIONAL";
  versionNo: number;
  comment: string;
  reason?: string;
  checklist: { key: string; passed: boolean }[];
  items: { type: string; category?: string; mediaKey?: string; photo?: string; note?: string; /** a photo rejected on the review screen: `note` is the reason for rejection */ rejected?: boolean }[];
}
const post = (path: string, body: unknown) => api(path, { method: "POST", body: JSON.stringify(body) });
export const useDecide = (id: string) => useAct(id, (b: DecisionInput) => post(`${B}/submissions/${id}/decision`, b));
/** A stage that approved changes its decision (Operations and Client Servicing, each for its own stage). A reason is always needed. */
export const useChangeDecision = (id: string) => useAct(id, (b: DecisionInput) => post(`${B}/submissions/${id}/change-decision`, b));
/** Marks photos / board details Approved, Rejected or Rework. A remark is mandatory for Rejected and Rework. Saved at once; sent to the recce person with the stage's Rework decision. */
export const useMarks = (id: string) => useAct(id, (b: MarksInput) => post(`${B}/submissions/${id}/marks`, b));
/**
 * "Send back": marks the selected checklist items (each with its own remark) and then sends the stage's Rework, which carries them and every
 * other unsent mark to the recce person. Two calls, one refresh. If the second fails the marks stay saved (nothing is lost; send again).
 */
export const useSendBack = (id: string) =>
  useAct(id, async (b: { marks: MarksInput | null; decision: DecisionInput; change: boolean }) => {
    if (b.marks) await post(`${B}/submissions/${id}/marks`, b.marks);
    return post(`${B}/submissions/${id}/${b.change ? "change-decision" : "decision"}`, b.decision);
  });
export const useStartReview = (id: string) => useAct(id, () => post(`${B}/submissions/${id}/start`, {}));
export const useOverride = (id: string) => useAct(id, (b: { action: "APPROVE" | "REJECT"; reason: string }) => post(`${B}/submissions/${id}/override`, b));
export const useReopen = (id: string) => useAct(id, (b: { reason: string }) => post(`${B}/submissions/${id}/reopen`, b));
export const useRestorePhoto = (id: string) => useAct(id, (photoId: string) => post(`${B}/submissions/${id}/photos/${photoId}/restore`, {}));
export const useAssignReviewer = (id: string) => useAct(id, (b: { stage: ReviewStage; userId: string | null }) => api(`${B}/submissions/${id}/reviewer`, { method: "PUT", body: JSON.stringify(b) }));
export const useSendShopMessage = (id: string) => useAct(id, (body: string) => post(`${B}/submissions/${id}/messages`, { body }));
export const useSaveRecceConfig = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: Partial<RecceConfig>) => api<RecceConfig>(`${B}/config`, { method: "PUT", body: JSON.stringify(b) }), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
};
