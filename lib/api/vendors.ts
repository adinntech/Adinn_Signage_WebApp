import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiPage, saveBlob } from "@/lib/api";
import { qs } from "./common";

export type VendorType = "ONE_MAN" | "ORGANIZATION";
export type VendorStatus = "PENDING_KYC" | "ACTIVE" | "INACTIVE" | "BLACKLISTED";
export const VENDOR_TYPE_LABEL: Record<VendorType, string> = { ONE_MAN: "One-man", ORGANIZATION: "Organization" };
export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = { PENDING_KYC: "Pending KYC", ACTIVE: "Active", INACTIVE: "Inactive", BLACKLISTED: "Blacklisted" };
export const KYC_ITEMS = [
  { key: "pan", label: "PAN card" },
  { key: "gst", label: "GST certificate" },
  { key: "bank", label: "Bank proof (cancelled cheque / passbook)" },
  { key: "address", label: "Address proof" },
] as const;
export type KycKey = (typeof KYC_ITEMS)[number]["key"];

export interface Vendor {
  _id: string;
  code: string;
  name: string;
  type: VendorType;
  contactPerson?: string;
  mobile: string;
  mobileAlt?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  district?: string;
  serviceAreas?: string[];
  bank?: { accountName?: string; accountNo?: string; ifsc?: string };
  ratePerShop?: number;
  farRatePerShop?: number;
  status: VendorStatus;
  statusReason?: string;
  kyc?: Partial<Record<KycKey, boolean>> & { verifiedAt?: string };
  notes?: string;
  source?: "MANUAL" | "IMPORT";
  allocatedShops?: number;
  createdAt: string;
}
export interface VendorInput {
  name: string;
  type: VendorType;
  contactPerson?: string;
  mobile: string;
  mobileAlt?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  district?: string;
  serviceAreas?: string[];
  bank?: { accountName?: string; accountNo?: string; ifsc?: string };
  ratePerShop?: number;
  farRatePerShop?: number;
  notes?: string;
}
export interface VendorSummary { PENDING_KYC: number; ACTIVE: number; INACTIVE: number; BLACKLISTED: number; ALL: number }
export interface VendorListParams { page?: number; limit?: number; q?: string; status?: VendorStatus | ""; type?: VendorType | ""; sort?: string }

export interface ImportRowResult { row: number; name: string; ok: boolean; duplicate?: string; errors: { field: string; message: string }[] }
export interface ImportReport { fileName: string; total: number; valid: number; duplicates: number; errors: number; created: number; rows: ImportRowResult[] }

const key = ["vendors"] as const;

export function useVendors(params: VendorListParams) {
  return useQuery({
    queryKey: [...key, "list", params],
    queryFn: () => apiPage<Vendor>(`/vendors${qs(params)}`).then((r) => ({ ...r, summary: (r.meta as unknown as { summary: VendorSummary }).summary })),
    placeholderData: keepPreviousData,
  });
}
export function useActiveVendors(enabled = true) {
  return useQuery({ queryKey: [...key, "active"], queryFn: () => api<Vendor[]>("/vendors/active"), enabled, staleTime: 30_000 });
}
function useVendorMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
}
export const useSaveVendor = () =>
  useVendorMutation(({ id, body }: { id?: string; body: Partial<VendorInput> }) =>
    id ? api<Vendor>(`/vendors/${id}`, { method: "PATCH", body: JSON.stringify(body) }) : api<Vendor>("/vendors", { method: "POST", body: JSON.stringify(body) }),
  );
export const useSetKyc = () => useVendorMutation(({ id, body }: { id: string; body: Partial<Record<KycKey, boolean>> }) => api<Vendor>(`/vendors/${id}/kyc`, { method: "PUT", body: JSON.stringify(body) }));
export const useSetVendorStatus = () =>
  useVendorMutation(({ id, status, reason }: { id: string; status: VendorStatus; reason?: string }) => api<Vendor>(`/vendors/${id}/status`, { method: "POST", body: JSON.stringify({ status, reason }) }));
export const useDeleteVendor = () => useVendorMutation((id: string) => api(`/vendors/${id}`, { method: "DELETE" }));
export const useImportVendors = () =>
  useVendorMutation(({ file, commit }: { file: File; commit: boolean }) => {
    const fd = new FormData();
    fd.append("file", file);
    return api<ImportReport>(`/vendors/import${qs({ commit: commit ? "true" : undefined })}`, { method: "POST", body: fd });
  });

export async function downloadVendorTemplate() {
  const { blob, fileName } = await apiBlob("/vendors/template");
  saveBlob(blob, fileName ?? "vendor-template.xlsx");
}
export async function downloadVendors() {
  const { blob, fileName } = await apiBlob("/vendors/export");
  saveBlob(blob, fileName ?? "vendors.xlsx");
}
