import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StoredFile } from "./pipeline";

export type Channel = "VENDOR" | "IN_HOUSE";
export type PlanStatus = "DRAFT" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "CONFIRMED" | "ASSIGNED";
export type ClientDecision = "PENDING" | "ACCEPTED" | "REJECTED";
export const CHANNEL_LABEL: Record<Channel, string> = { IN_HOUSE: "In-house team", VENDOR: "Vendor" };

/** The company rates admin fixes. */
export interface CostRates {
  vendorRatePerShop: number;
  vendorFarRatePerShop: number;
  vendorFarKm: number;
  foodPerDay: number;
  stayPerNight: number;
  fuelRatePerKm: number;
  localPerDay: number;
  thresholdPerShop: number;
  worstCasePerShop: number;
  overVendorPercent: number;
}

export interface LegCalc {
  vendor: { perShopRate: number; far: boolean; negotiated: boolean; shopCost: number; other: number; total: number; perShop: number };
  inHouse: { meals: number; days: number; nights: number; datesAssumed: boolean; routeKm: number; food: number; stay: number; fuel: number; local: number; other: number; subtotal: number; total: number; perShop: number };
  comparison: { difference: number; inHouseSavingPercent: number; inHouseOverVendorPercent: number; cheaper: Channel };
  flags: { inHouseOverThreshold: boolean; inHouseWorstCase: boolean; inHouseOverVendor: boolean; vendorOverThreshold: boolean };
  needsApproval: Record<Channel, boolean>;
  recommended: Channel;
  reasons: string[];
}
/** One area (normally a district) of the project and how it will be done. */
export interface PlanLeg {
  key: string;
  /** Chosen by the smart plan and not changed since. */
  autoSelected?: boolean;
  /** A group of nearby shops made by the smart plan (its shops can be added or removed). */
  clustered?: boolean;
  name: string;
  district?: string;
  shops: number;
  distanceKm: number;
  routeKm?: number | null;
  deadline?: string;
  channel?: Channel | null;
  vendor?: string | null;
  vendorName?: string | null;
  vendorRate?: number | null;
  cardRate?: number | null;
  vendorOther: number;
  tripStart?: string;
  tripEnd?: string;
  clientsShared: number;
  otherAmount: number;
  calc: LegCalc;
}
export interface PlanTotals {
  shops: number;
  legs: number;
  chosenLegs: number;
  chosenTotal: number;
  recommendedTotal: number;
  perShop: number;
  inHouseShops: number;
  vendorShops: number;
  needsApproval: boolean;
  reasons: string[];
}
export interface DistrictSummary { key: string; name: string | null; shops: number; located: number; distanceKm: number | null }
export interface CostView {
  plan: {
    _id: string | null;
    status: PlanStatus;
    justification?: string;
    reviewRemark?: string;
    reviewedAt?: string;
    assignedAt?: string;
    clientDecision: ClientDecision;
    clientRemark?: string;
    legs: PlanLeg[];
  };
  saved: boolean;
  rates: CostRates;
  policy: CostRates;
  totals: PlanTotals;
  districts: DistrictSummary[];
  project: { deadline?: string; origin: { name: string; lat: number; lng: number } | null; status: string };
  shopsRecorded: number;
  totalSqft: number;
  inHouseByCategory: { food: number; stay: number; fuel: number; other: number; total: number };
  clientCost: { total: number; perShop: number; perSqft: number | null } | null;
  actual: { all: number; approved: number; pending: number; rejected: number; withoutProof: number; byCategory: Record<string, number>; perShop: number };
}
export interface RouteInfo { key: string; located: number; missing: number; roadDistance: boolean; totalKm: number; days: { day: number; km: number; minutes: number | null; stops: number; source: "ROAD" | "ESTIMATE"; googleUrl: string; googleAddressUrl: string }[] }
/** Google Maps links built from the shops' written addresses (work before the shops are located). */
export interface LegLinks { key: string; shops: number; days: { day: number; stops: number; googleUrl: string }[] }
export const fetchLegLinks = (pid: string, legKey: string) => api<LegLinks>(`/projects/${pid}/cost/legs/${encodeURIComponent(legKey)}/map-links`);

/** What Operations types for an area; the numbers come back from the server. */
export interface LegInput {
  key: string;
  name: string;
  district?: string;
  shops: number;
  distanceKm: number;
  routeKm?: number | null;
  deadline?: string;
  channel?: Channel | null;
  vendorId?: string | null;
  vendorRate?: number | null;
  vendorOther: number;
  tripStart?: string;
  tripEnd?: string;
  clientsShared: number;
  otherAmount: number;
}
export const legToInput = (l: PlanLeg): LegInput => ({
  key: l.key, name: l.name, ...(l.district ? { district: l.district } : {}), shops: l.shops, distanceKm: l.distanceKm, routeKm: l.routeKm ?? null,
  ...(l.deadline ? { deadline: l.deadline } : {}), channel: l.channel ?? null, vendorId: l.vendor ?? null, vendorRate: l.vendorRate ?? null, vendorOther: l.vendorOther ?? 0,
  ...(l.tripStart ? { tripStart: l.tripStart } : {}), ...(l.tripEnd ? { tripEnd: l.tripEnd } : {}), clientsShared: l.clientsShared ?? 1, otherAmount: l.otherAmount ?? 0,
});

const key = (pid: string) => ["cost", pid] as const;

export function useCost(pid: string) {
  return useQuery({ queryKey: key(pid), queryFn: () => api<CostView>(`/projects/${pid}/cost`), enabled: !!pid });
}
function usePlanMutation<V, R = CostView>(pid: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(pid) });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["allocation", pid] });
      qc.invalidateQueries({ queryKey: ["sites", pid] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
const post = <R = CostView>(url: string, body?: unknown) => api<R>(url, { method: "POST", body: JSON.stringify(body ?? {}) });
export const useSyncPlan = (pid: string) => usePlanMutation(pid, () => post(`/projects/${pid}/cost/sync`));
export const useSavePlan = (pid: string) => usePlanMutation(pid, (b: { legs: LegInput[]; refreshRates?: boolean }) => api<CostView>(`/projects/${pid}/cost`, { method: "PUT", body: JSON.stringify(b) }));
export const useRouteLeg = (pid: string) => usePlanMutation(pid, (legKey: string) => post<CostView & { route: RouteInfo }>(`/projects/${pid}/cost/legs/${encodeURIComponent(legKey)}/route`));
export const useSubmitPlan = (pid: string) => usePlanMutation(pid, (b: { justification?: string }) => post(`/projects/${pid}/cost/submit`, b));
export const useDecidePlan = (pid: string) => usePlanMutation(pid, (b: { approve: boolean; remark?: string }) => post(`/projects/${pid}/cost/decide`, b));
export const useAssignPlan = (pid: string) => usePlanMutation(pid, () => post<CostView & { assigned: number; skipped: string[]; stage: string | null; vendorsWithoutLogin: { id: string; name: string; email: string | null; mobile: string | null }[] }>(`/projects/${pid}/cost/assign`));

/** After the shops are assigned: per area, the mobile logins to choose from and who already holds its shops. */
export interface LegLogins {
  key: string; name: string; channel: Channel; vendorName: string | null; shops: number; unassigned: number;
  logins: { id: string; name: string; phone: string | null; employeeId: string | null }[];
  holders: { userId: string; shops: number; assignedAt: string | null; assignedBy: string | null }[];
}
export const useLegLogins = (pid: string, enabled: boolean) => useQuery({ queryKey: [...key(pid), "logins"], queryFn: () => api<LegLogins[]>(`/projects/${pid}/cost/logins`), enabled: enabled && !!pid });
export const useAssignLogins = (pid: string) => usePlanMutation(pid, (b: { legs: { key: string; userId: string }[] }) => post<{ given: number; legs: LegLogins[] }>(`/projects/${pid}/cost/assign-logins`, b));
export const useClientDecision = (pid: string) => usePlanMutation(pid, (b: { decision: ClientDecision; remark?: string }) => post(`/projects/${pid}/cost/client-decision`, b));

/** Company rates (admin fixes them; everyone who plans reads them). */
export const usePolicy = () => useQuery({ queryKey: ["cost-policy"], queryFn: () => api<CostRates>("/cost-policy") });
export function useSavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<CostRates>) => api<CostRates>("/cost-policy", { method: "PUT", body: JSON.stringify(b) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cost-policy"] }),
  });
}

/* ------------------------------- expense claims ------------------------------ */

export type ExpenseCategory = "TRAVEL" | "FUEL" | "FOOD" | "STAY" | "OTHER";
export const EXPENSE_LABEL: Record<ExpenseCategory, string> = { TRAVEL: "Travel", FUEL: "Fuel", FOOD: "Food", STAY: "Stay", OTHER: "Other" };
export interface ExpenseClaim {
  _id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note?: string;
  receiptFileId?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewRemark?: string;
  submittedBy?: { _id: string; name: string; role?: string };
  reviewedBy?: { name: string };
}
export interface ExpenseList {
  items: ExpenseClaim[];
  totals: { all: number; approved: number; pending: number; rejected: number; withoutProof: number };
  byCategory: Record<string, number>;
}
const ekey = (pid: string) => ["expenses", pid] as const;

export function useExpenses(pid: string) {
  return useQuery({ queryKey: ekey(pid), queryFn: () => api<ExpenseList>(`/projects/${pid}/expenses`), enabled: !!pid, refetchInterval: 30_000 });
}
function useExpenseMutation<V>(pid: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ekey(pid) });
      qc.invalidateQueries({ queryKey: key(pid) });
      qc.invalidateQueries({ queryKey: ["files", pid] });
    },
  });
}
export const useAddExpense = (pid: string) =>
  useExpenseMutation(pid, async (b: { category: ExpenseCategory; amount: number; date: string; note?: string; receipt?: File | null; receiptFileId?: string }) => {
    let receiptFileId = b.receiptFileId;
    if (b.receipt) {
      const fd = new FormData();
      fd.set("category", "RECCE_EXPENSE");
      fd.append("files", b.receipt);
      receiptFileId = (await api<StoredFile[]>(`/projects/${pid}/files`, { method: "POST", body: fd }))[0]?.id;
    }
    return api(`/projects/${pid}/expenses`, { method: "POST", body: JSON.stringify({ category: b.category, amount: b.amount, date: b.date, note: b.note, receiptFileId }) });
  });
export const useReviewExpense = (pid: string) =>
  useExpenseMutation(pid, (b: { id: string; status: "APPROVED" | "REJECTED" | "PENDING"; remark?: string }) => api(`/expenses/${b.id}/review`, { method: "POST", body: JSON.stringify({ status: b.status, remark: b.remark }) }));
export const useDeleteExpense = (pid: string) => useExpenseMutation(pid, (id: string) => api(`/expenses/${id}`, { method: "DELETE" }));

/* ------------------------------ smart suggestion ------------------------------ */

export interface SuggestVendor { vendorId: string; name: string; local: boolean; skillMatch: boolean; skills: string[]; perShopRate: number; total: number; perShop: number; needsApproval: boolean; shopsPerDay?: number | null; days?: number | null; nearKm?: number | null; covers?: boolean; rateSource?: "VENDOR" | "COMPANY"; pendingRate?: number | null; tags?: string[]; registered?: boolean; place?: string | null }
export interface SuggestProposal {
  key: string; name: string; district: string; towns: string[]; siteIds: string[]; shops: number; located: number; distanceKm: number; routeKm: number;
  inHouse: { total: number; perShop: number; needsApproval: boolean; days: number; nights: number; travel: number; local: number; food: number; stay: number };
  vendors: SuggestVendor[];
  zohoNearby?: ZohoNearby[];
  recommended: { channel: Channel; vendorId: string | null; vendorName: string | null; total: number; perShop: number };
  reasons: string[]; warnings: string[];
}
export interface Verification { total: number; verified: number; unverified: number; noAddress: number; allVerified: boolean }
export interface ZohoNearby { zohoContactId: string; vendorNo?: string | null; name: string; city: string; mobile?: string | null; ratePerShop: number | null; match: "AREA" | "DISTRICT" }
export const useReadiness = (pid: string) => useQuery({ queryKey: [...key(pid), "readiness"], queryFn: () => api<Verification>(`/projects/${pid}/cost/readiness`), enabled: !!pid, refetchInterval: 30_000 });
export interface SuggestResult { unlocated?: number; base?: { name: string; lat: number; lng: number; isDefault: boolean }; applied: boolean; verification?: Verification; groupBy: "area" | "district"; proposals: SuggestProposal[]; totals: { shops: number; areas: number; suggested: number; allInHouse: number; allVendor: number; inHouseShops: number; vendorShops: number } }
export type PlannerMode = "BOTH" | "VENDOR" | "IN_HOUSE";
export interface PlanShop { id: string; name: string; location: string; district: string; planArea: string | null; lat: number | null; lng: number | null; pincode?: string; address?: string }
export interface PlanHistoryRow { _id: string; action: string; reason?: string; at: string; user?: { name?: string; role?: string } | null; changes: { field: string; oldValue: unknown; newValue: unknown }[] }
export const usePlanShops = (pid: string, enabled = true) => useQuery({ queryKey: [...key(pid), "shops"], queryFn: () => api<PlanShop[]>(`/projects/${pid}/cost/shops`), enabled: enabled && !!pid });
export const usePlanHistory = (pid: string, enabled = true) => useQuery({ queryKey: [...key(pid), "history"], queryFn: () => api<PlanHistoryRow[]>(`/projects/${pid}/cost/history`), enabled: enabled && !!pid });
export interface BasePlace { _id: string; name: string; lat: number; lng: number }
export const useBases = () => useQuery({ queryKey: ["cost-bases"], queryFn: () => api<BasePlace[]>("/base-locations"), staleTime: 60_000 });
export const findPlace = (address: string) => api<{ lat: number; lng: number; exact: boolean; quality: string }>("/base-locations/find", { method: "POST", body: JSON.stringify({ address }) });
export function useAddBase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: { name: string; lat: number; lng: number }) => api<BasePlace>("/base-locations", { method: "POST", body: JSON.stringify(b) }), onSuccess: () => qc.invalidateQueries({ queryKey: ["cost-bases"] }) });
}
export const useChoosePlan = (pid: string) => usePlanMutation(pid, (b: { areaKey: string; channel: Channel; vendorId?: string }) => post(`/projects/${pid}/cost/choose`, b));
export const useEditPlanShops = (pid: string) => usePlanMutation(pid, (b: { areaKey: string; add: string[]; remove: string[]; reason: string }) => post(`/projects/${pid}/cost/edit-shops`, b));
export const useSuggestPlan = (pid: string) =>
  usePlanMutation(pid, (b: { skills: string[]; requireSkills: boolean; apply: boolean; groupBy: "area" | "district"; mode?: PlannerMode }) => post<SuggestResult>(`/projects/${pid}/cost/suggest`, b));
