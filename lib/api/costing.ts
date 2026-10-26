import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StoredFile } from "./pipeline";

export type Channel = "VENDOR" | "IN_HOUSE";
export type PlanStatus = "DRAFT" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "CONFIRMED";
export type ClientDecision = "PENDING" | "ACCEPTED" | "REJECTED";

export interface CostRates {
  vendorRatePerShop: number;
  vendorFarRatePerShop: number;
  vendorFarKm: number;
  foodPerDay: number;
  stayPerNight: number;
  travelRatePerKm: number;
  longDistanceKm: number;
  longDistanceRatePerKm: number;
  thresholdPerShop: number;
  worstCasePerShop: number;
  overVendorPercent: number;
}
export interface CostPlan {
  _id: string | null;
  vendorType?: "ONE_MAN" | "ORGANIZATION";
  vendorName?: string;
  vendor?: string;
  shops: number;
  shopsCovered?: number;
  vendorDistanceKm: number;
  vendorOther: number;
  days: number;
  nights: number;
  totalKm: number;
  fuelAmount: number;
  otherAmount: number;
  clientsShared: number;
  chosen?: Channel;
  status: PlanStatus;
  justification?: string;
  reviewRemark?: string;
  reviewedAt?: string;
  clientDecision: ClientDecision;
  clientRemark?: string;
  clientDecidedAt?: string;
}
export interface CostResult {
  vendor: { perShopRate: number; far: boolean; shopCost: number; other: number; total: number; perShop: number };
  inHouse: { food: number; stay: number; travel: number; longDistance: boolean; fuel: number; other: number; subtotal: number; total: number; perShop: number; shopsCovered: number };
  comparison: { difference: number; inHouseSavingPercent: number; inHouseOverVendorPercent: number; cheaper: Channel };
  flags: { inHouseOverThreshold: boolean; inHouseWorstCase: boolean; inHouseOverVendor: boolean; vendorOverThreshold: boolean };
  needsApproval: Record<Channel, boolean>;
  recommended: Channel;
  reasons: string[];
}
export interface CostView {
  plan: CostPlan;
  saved: boolean;
  rates: CostRates;
  calc: CostResult;
  policy: CostRates;
  shopsRecorded: number;
  totalSqft: number;
  clientCost: { total: number; perShop: number; perSqft: number | null } | null;
  actual: { all: number; approved: number; pending: number; rejected: number; withoutProof: number; byCategory: Record<string, number>; perShop: number };
}
export type CostInput = Pick<CostPlan, "shops" | "vendorDistanceKm" | "vendorOther" | "days" | "nights" | "totalKm" | "fuelAmount" | "otherAmount" | "clientsShared"> & {
  vendorType?: CostPlan["vendorType"];
  vendorName?: string;
  vendorId?: string;
  shopsCovered?: number;
  refreshRates?: boolean;
};

const key = (pid: string) => ["cost", pid] as const;

export function useCost(pid: string) {
  return useQuery({ queryKey: key(pid), queryFn: () => api<CostView>(`/projects/${pid}/cost`), enabled: !!pid });
}
function usePlanMutation<V>(pid: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(pid) });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
const post = (url: string, body: unknown) => api<CostView>(url, { method: "POST", body: JSON.stringify(body) });
export const useSaveCost = (pid: string) => usePlanMutation(pid, (b: CostInput) => api<CostView>(`/projects/${pid}/cost`, { method: "PUT", body: JSON.stringify(b) }));
export const useChooseChannel = (pid: string) => usePlanMutation(pid, (b: { channel: Channel; justification?: string }) => post(`/projects/${pid}/cost/choose`, b));
export const useDecideCost = (pid: string) => usePlanMutation(pid, (b: { approve: boolean; remark?: string }) => post(`/projects/${pid}/cost/decide`, b));
export const useClientDecision = (pid: string) => usePlanMutation(pid, (b: { decision: ClientDecision; remark?: string }) => post(`/projects/${pid}/cost/client-decision`, b));

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
