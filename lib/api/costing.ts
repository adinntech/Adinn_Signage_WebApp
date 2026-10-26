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
  thresholdPerShop: number;
  worstCasePerShop: number;
  overVendorPercent: number;
}

export interface LegCalc {
  vendor: { perShopRate: number; far: boolean; negotiated: boolean; shopCost: number; other: number; total: number; perShop: number };
  inHouse: { meals: number; days: number; nights: number; datesAssumed: boolean; routeKm: number; food: number; stay: number; fuel: number; other: number; subtotal: number; total: number; perShop: number };
  comparison: { difference: number; inHouseSavingPercent: number; inHouseOverVendorPercent: number; cheaper: Channel };
  flags: { inHouseOverThreshold: boolean; inHouseWorstCase: boolean; inHouseOverVendor: boolean; vendorOverThreshold: boolean };
  needsApproval: Record<Channel, boolean>;
  recommended: Channel;
  reasons: string[];
}
/** One area (normally a district) of the project and how it will be done. */
export interface PlanLeg {
  key: string;
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
export const useAssignPlan = (pid: string) => usePlanMutation(pid, () => post<CostView & { assigned: number; skipped: string[] }>(`/projects/${pid}/cost/assign`));
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
