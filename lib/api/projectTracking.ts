import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage, type PageMeta } from "@/lib/api";
import { qs } from "./common";
import type { Decision, RecceStatus } from "./recceReview";

/**
 * Project Tracking (Client Servicing): allocation mind map, shop-wise progress and activity of one project. Reads the same shops
 * and recce submissions as Project Approval; shop review and decisions reuse `useApprovalWorkspace`, `useDecideItem`, `useDecide`.
 * Keys sit under "recce-review", so every review action refreshes these screens too.
 */
const KEY = "recce-review";
const B = "/recce-review";

export type TrackStatus = "NOT_ALLOCATED" | "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "REWORK" | "REJECTED" | "COMPLETED";
export type Channel = "VENDOR" | "IN_HOUSE";

export interface Tally {
  assigned: number;
  completed: number;
  pending: number;
  rejected: number;
  percent: number;
}
export interface TrackMember extends Tally {
  /** Vendor id (VENDOR) or staff login id (IN_HOUSE); "none" = allocated without a vendor / person. */
  id: string;
  name: string;
  channel: Channel;
}
export interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  actor: string;
  role: string;
  at: string;
  reason: string;
  version: number | null;
  siteId: string | null;
  siteCode: string | null;
  shopName: string | null;
  submissionId: string | null;
}
export interface TrackingOverview {
  project: { id: string; code: string; name: string; client: string | null; status: string; requirementType: string | null; district: string | null; startDate: string | null; createdAt: string | null; lastSubmittedAt: string | null };
  counts: {
    total: number;
    vendor: number;
    inhouse: number;
    notAllocated: number;
    vendors: number;
    staff: number;
    completed: number;
    pending: number;
    rejected: number;
    percent: { vendor: number; inhouse: number; completed: number; pending: number; rejected: number };
  };
  branches: { vendor: Tally; inhouse: Tally };
  vendors: TrackMember[];
  staff: TrackMember[];
  activity: ActivityEvent[];
}
export interface TrackShop {
  siteId: string;
  submissionId: string | null;
  siteCode: string;
  shopName: string | null;
  location: string | null;
  district: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  channel: Channel | null;
  memberId: string | null;
  team: string | null;
  allocatedAt: string | null;
  status: TrackStatus;
  recceStatus: RecceStatus | null;
  version: number;
  photoCount: number;
  units: number;
  expectedPhotos: number | null;
  submittedAt: string | null;
  cs: { decision: Decision; decidedAt: string | null } | null;
  ops: { decision: Decision; decidedAt: string | null } | null;
}
export interface TrackShopFilters {
  channel?: "all" | Channel;
  vendor?: string;
  staff?: string;
  status?: "all" | TrackStatus;
  approval?: "all" | "PENDING" | "APPROVED" | "REJECTED";
  district?: string;
  q?: string;
  page: number;
  limit: number;
}
export interface TrackShops {
  items: TrackShop[];
  districts: string[];
  meta: PageMeta;
}

export const useTrackingOverview = (projectId: string | null) =>
  useQuery({ queryKey: [KEY, "tracking", "overview", projectId], queryFn: () => api<TrackingOverview>(`${B}/tracking/projects/${projectId}`), enabled: !!projectId, refetchInterval: 60_000 });
export const useTrackingShops = (projectId: string | null, f: TrackShopFilters, enabled = true) =>
  useQuery({ queryKey: [KEY, "tracking", "shops", projectId, f], queryFn: () => api<TrackShops>(`${B}/tracking/projects/${projectId}/shops${qs(f)}`), enabled: !!projectId && enabled, placeholderData: keepPreviousData });
export const useTrackingActivity = (projectId: string | null, page: number, enabled: boolean) =>
  useQuery({ queryKey: [KEY, "tracking", "activity", projectId, page], queryFn: () => apiPage<ActivityEvent>(`${B}/tracking/projects/${projectId}/activity${qs({ page, limit: 20 })}`), enabled: !!projectId && enabled, placeholderData: keepPreviousData });

