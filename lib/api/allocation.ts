import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";

export type Channel = "VENDOR" | "IN_HOUSE";
export interface LatLng { lat: number; lng: number }
export interface TeamStat { key: string; vendorId: string | null; name: string; shops: number; districts: string[]; approxKm: number }
export interface AllocationOverview {
  origin: (LatLng & { name: string }) | null;
  total: number;
  unassigned: number;
  withoutCoords: number;
  districts: string[];
  teams: TeamStat[];
}
export interface AllocShop {
  _id: string;
  seq: number;
  siteCode: string;
  shopName?: string;
  dealerName?: string;
  location?: string;
  district?: string;
  mobile?: string;
  lat?: number | null;
  lng?: number | null;
  channel?: Channel;
  vendor?: string | null;
  vendorName?: string | null;
  distanceKm: number | null;
}
export interface AllocParams { q?: string; district?: string; view?: string; sort?: string; page?: number; limit?: number }
export interface MapPoint { id: string; name: string; district: string | null; lat: number; lng: number; channel: Channel | null; vendor: string | null }
export interface SplitGroup { vendorId: string | null; name: string; siteIds: string[]; shops: number; districts: string[]; approxKm: number }
export interface SplitPreview { totalShops: number; groups: SplitGroup[] }
export interface Itinerary {
  origin: LatLng & { name: string };
  shopsPerDay: number;
  totalShops: number;
  withoutCoords: number;
  days: { day: number; km: number; stops: { id: string; name: string; district: string | null; lat: number; lng: number; legKm: number }[] }[];
  totalKm: number;
  estimate: { days: number; nights: number; food: number; stay: number; travel: number; total: number };
}

const key = (pid: string) => ["allocation", pid] as const;

export const useAllocationOverview = (pid: string) => useQuery({ queryKey: [...key(pid), "overview"], queryFn: () => api<AllocationOverview>(`/projects/${pid}/allocation`), enabled: !!pid });
export const useAllocationShops = (pid: string, params: AllocParams) =>
  useQuery({ queryKey: [...key(pid), "shops", params], queryFn: () => apiPage<AllocShop>(`/projects/${pid}/allocation/shops${qs(params)}`), placeholderData: keepPreviousData, enabled: !!pid });
export const useAllocationMap = (pid: string, enabled = true) =>
  useQuery({ queryKey: [...key(pid), "map"], queryFn: () => api<{ origin: (LatLng & { name: string }) | null; points: MapPoint[] }>(`/projects/${pid}/allocation/map`), enabled: enabled && !!pid });
export const useItinerary = (pid: string, shopsPerDay: number, enabled = true) =>
  useQuery({ queryKey: [...key(pid), "itinerary", shopsPerDay], queryFn: () => api<Itinerary>(`/projects/${pid}/allocation/itinerary${qs({ shopsPerDay })}`), enabled: enabled && !!pid, retry: false });

function useAllocMutation<V, R = unknown>(pid: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(pid) });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["cost", pid] });
    },
  });
}
export const useSetOrigin = (pid: string) => useAllocMutation(pid, (b: { name?: string; lat: number; lng: number }) => api(`/projects/${pid}/allocation/origin`, { method: "PUT", body: JSON.stringify(b) }));
export const useSetCoords = (pid: string) => useAllocMutation(pid, ({ id, lat, lng }: { id: string; lat: number | null; lng: number | null }) => api(`/sites/${id}/coords`, { method: "PUT", body: JSON.stringify({ lat, lng }) }));
export const useAssign = (pid: string) =>
  useAllocMutation(pid, (b: { siteIds: string[]; channel: Channel | "NONE"; vendorId?: string }) => api<{ affected: number }>(`/projects/${pid}/allocation/assign`, { method: "POST", body: JSON.stringify(b) }));
export const usePreviewSplit = (pid: string) =>
  useMutation({ mutationFn: (b: { by: "district" | "distance" | "count"; maxPerTeam?: number; teams: { vendorId: string | null }[]; onlyUnassigned: boolean }) => api<SplitPreview>(`/projects/${pid}/allocation/split/preview`, { method: "POST", body: JSON.stringify(b) }) });
export const useApplySplit = (pid: string) =>
  useAllocMutation(pid, (groups: { vendorId: string | null; siteIds: string[] }[]) => api<{ affected: number }>(`/projects/${pid}/allocation/split/apply`, { method: "POST", body: JSON.stringify({ groups }) }));
export const useApplyItinerary = (pid: string) =>
  useAllocMutation(pid, (shopsPerDay: number) => api<Itinerary>(`/projects/${pid}/allocation/itinerary/apply-to-cost`, { method: "POST", body: JSON.stringify({ shopsPerDay }) }));
