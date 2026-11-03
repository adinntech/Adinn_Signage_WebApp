import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StoredFile } from "./pipeline";

/** Recce cost module (internal cost tracking only: nothing here reaches client invoices). */

export type TripStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SETTLED";
export const STATUS_LABEL: Record<TripStatus, string> = { DRAFT: "Draft", SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", APPROVED: "Approved", REJECTED: "Rejected", SETTLED: "Settled" };
export const LEG_MODES = ["BUS", "TRAIN", "AUTO", "CAB", "RAPIDO", "METRO", "BIKE", "OTHER"] as const;
export const MISC_TYPES = ["PARKING", "TOLL", "LOCAL_TRAVEL", "LUGGAGE", "PRINTING", "PHOTOCOPY", "SMALL_PURCHASE", "OTHER"] as const;
export const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export interface Meal { from: string; to: string; amount: number }
export interface Rates {
  kmRate: number; breakfast: Meal; lunch: Meal; dinner: Meal; dailyFoodMax: number; mealMinOverlapMinutes: number;
  stayDistanceKm: number; stayDurationHours: number; stayPerNight: number; stayMaxAmount: number; stayOrigin: "OFFICE" | "CURRENT_LOCATION";
  receiptRequiredAbove: number; adminApprovalAbove: number; maxTripKm: number;
}
export interface RateVersion extends Rates { _id: string; effectiveFrom: string; note?: string; createdAt: string; updatedAt?: string; createdBy?: { name: string } }

export interface Leg { from: string; to: string; district?: string; mode: string; at: string; amount: number; receiptFileId?: string; remarks?: string }
export interface Misc { type: string; date: string; amount: number; description?: string; remarks?: string; receiptFileId?: string; shopRef?: string }
export interface Odo { reading?: number; photoFileId?: string; gps?: { lat: number; lng: number; accuracy?: number; address?: string }; capturedAt?: string }
export interface TripCalc {
  distanceKm?: number; kmRate: number; transport: number; misc: number; total: number; needsAdminApproval: boolean; flags: string[];
  food: { suggested: number; claimed: number; durationHours: number; days: { date: string; meals: { meal: string; amount: number }[]; suggested: number }[] };
  stay: { eligible: boolean; reason: string; nights: number; suggested: number; claimed: number };
}
export interface Trip {
  _id: string; createdAt?: string; updatedAt?: string; project: string; projectCode?: string; clientCode?: string; employeeName?: string; status: TripStatus;
  startAt: string; endAt?: string; transportType: "PUBLIC" | "PRIVATE"; legs: Leg[]; misc: Misc[];
  vehicle?: { type?: string; regNo?: string }; odoStart?: Odo; odoEnd?: Odo;
  startLocation?: string; destination?: string; manualDistanceKm?: number; manualDistanceEvidence?: string; estimatedTravelHours?: number;
  stayNights?: number; stayClaimed?: number; stayBillFileId?: string; stayRemarks?: string; foodClaimed?: number; foodRemarks?: string;
  calc: TripCalc; flags: string[]; approved?: { transport: number; food: number; stay: number; misc: number; total: number }; reviewRemark?: string;
  history: { at: string; byName?: string; action: string; from?: string; to?: string; remark?: string }[];
}
export type TripInput = Omit<Trip, "_id" | "status" | "calc" | "flags" | "history" | "approved" | "project" | "projectCode" | "clientCode" | "employeeName" | "reviewRemark"> & { projectId: string };

export interface VendorRate { _id: string; vendor: { _id: string; name: string }; recceType: string; ratePerShop: number; ratePerDay: number; ratePerLocation: number; fixedProjectRate: number; travelCharges: number; stayCharges: number; otherCharges: number; effectiveFrom: string; effectiveTo?: string }
export interface VendorCost { _id: string; vendor: { name: string }; projectCode: string; recceType: string; shops: number; days: number; locations: number; additional: number; total: number }
export interface Report {
  totals: { inHouse: number; vendor: number; total: number; pendingApproval: number };
  categories: Record<"transport" | "food" | "stay" | "misc" | "vendor", number>;
  byClient: { key: string; total: number }[]; byProject: { key: string; total: number }[]; byEmployee: { key: string; total: number }[]; byDate: { key: string; total: number }[]; byVendor: { key: string; total: number }[];
}

const P = "/recce-cost";
export const useRates = () => useQuery({ queryKey: ["rc", "rates"], queryFn: () => api<{ rates: Rates; version: string | null }>(`${P}/rates`) });
export const useRateHistory = (enabled: boolean) => useQuery({ queryKey: ["rc", "rates", "history"], queryFn: () => api<RateVersion[]>(`${P}/rates/history`), enabled });
export const useTrips = (params: { projectId?: string; status?: string; mine?: boolean } = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return useQuery({ queryKey: ["rc", "trips", params], queryFn: () => api<Trip[]>(`${P}/trips${q ? `?${q}` : ""}`), refetchInterval: 30_000 });
};
export const useVendorRates = (enabled: boolean) => useQuery({ queryKey: ["rc", "vendor-rates"], queryFn: () => api<VendorRate[]>(`${P}/vendor-rates`), enabled });
export const useVendorCosts = (enabled: boolean) => useQuery({ queryKey: ["rc", "vendor-costs"], queryFn: () => api<VendorCost[]>(`${P}/vendor-costs`), enabled });
export const useReport = (enabled: boolean) => useQuery({ queryKey: ["rc", "report"], queryFn: () => api<Report>(`${P}/report`), enabled });

function useRc<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["rc"] }) });
}
const post = (path: string, body?: unknown, method = "POST") => api(`${P}${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
export const useSaveTrip = () => useRc((v: { id?: string; body: TripInput }) => post(v.id ? `/trips/${v.id}` : "/trips", v.body, v.id ? "PUT" : "POST") as Promise<Trip>);
export const useSubmitTrip = () => useRc((id: string) => post(`/trips/${id}/submit`));
export const useDeleteTrip = () => useRc((id: string) => api(`${P}/trips/${id}`, { method: "DELETE" }));
export const useReviewTrip = () => useRc((v: { id: string; action: "START_REVIEW" | "APPROVE" | "REJECT" | "SETTLE"; remark?: string; approved?: Partial<Record<"transport" | "food" | "stay" | "misc", number>>; stayException?: { reason: string } }) => { const { id, ...b } = v; return post(`/trips/${id}/review`, b); });
export const useSaveRates = () => useRc((b: Record<string, unknown>) => post("/rates", b));
export const useSaveVendorRate = () => useRc((v: { id?: string; body: Record<string, unknown> }) => post(v.id ? `/vendor-rates/${v.id}` : "/vendor-rates", v.body, v.id ? "PUT" : "POST"));
export const useApplyVendorCost = () => useRc((v: { projectId: string; body: Record<string, unknown> }) => post(`/projects/${v.projectId}/vendor-cost`, v.body));

/** Uploads a bill / odometer photo as a normal project file (Expenses category) and returns its id. */
export async function uploadProof(projectId: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.set("category", "RECCE_EXPENSE");
  fd.append("files", file);
  const out = await api<StoredFile[]>(`/projects/${projectId}/files`, { method: "POST", body: fd });
  const id = out[0]?.id;
  if (!id) throw new Error("Upload failed");
  return id;
}
