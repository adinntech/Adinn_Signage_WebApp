import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiPage, saveBlob } from "@/lib/api";
import { qs } from "./common";
import { formData, type FileRef } from "./files";

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

/** A KYC scan stored for a vendor; `docType` is the checklist item it proves. */
export interface KycFile extends FileRef {
  docType: KycKey;
  uploadedAt?: string;
}

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
  source?: "MANUAL" | "IMPORT" | "ZOHO";
  zohoVendorNo?: string;
  kycFiles?: KycFile[];
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
  zohoContactId?: string;
  zohoVendorNo?: string;
}
export interface VendorSummary { PENDING_KYC: number; ACTIVE: number; INACTIVE: number; BLACKLISTED: number; ALL: number; NEW: number; NEW_PENDING_KYC: number; NEW_ACTIVE: number }
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
  return useMutation({ mutationFn: fn, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["zoho"] }); return qc.invalidateQueries({ queryKey: key }); } });
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

/** What a Zoho Books vendor number resolves to: the registration form fields, and the vendor already holding it (if any). */
export interface ZohoVendorLookup {
  contactId: string;
  vendorNo?: string;
  vendor: Partial<Pick<VendorInput, "name" | "type" | "contactPerson" | "mobile" | "email" | "gstin" | "pan" | "address" | "district">> & { status: "ACTIVE" | "INACTIVE" };
  existing: { id: string; code: string; name: string; status: VendorStatus } | null;
}
/** Fetches one Zoho vendor by number. Runs only when the Fetch button is pressed, never while typing. */
export const useLookupZohoVendor = () =>
  useMutation({
    // A vendor number (typed) or a Zoho contact id (a row of the Zoho vendors list).
    mutationFn: (by: { vendorNo: string } | { contactId: string }) =>
      api<ZohoVendorLookup>("vendorNo" in by ? `/vendors/zoho/${by.vendorNo}` : `/vendors/zoho-directory/${by.contactId}/details`),
  });

/** A row of the stored copy of Zoho's vendor list. `vendor` is set only once Operations has registered it. */
export interface ZohoVendorRow {
  _id: string;
  zohoContactId: string;
  vendorNo?: string | null;
  name: string;
  email?: string | null;
  mobile?: string | null;
  gstin?: string | null;
  pan?: string | null;
  city?: string | null;
  address?: string | null;
  createdByName?: string | null;
  zohoCreatedAt?: string | null;
  zohoStatus: "active" | "inactive";
  vendor: { id: string; code: string; status: VendorStatus } | null;
}
export interface ZohoSyncStatus {
  sync: { running: boolean; phase: "list" | "details" | null; fetched: number; detailsDone: number; detailsTotal: number; startedAt: string | null; finishedAt: string | null; error: string | null };
  total: number;
  active: number;
  registered: number;
  lastSyncedAt: string | null;
}
export interface ZohoDirectoryParams { page?: number; limit?: number; q?: string; status?: "active" | "inactive" | ""; registered?: "yes" | "no" | "" }

export function useZohoDirectory(params: ZohoDirectoryParams) {
  return useQuery({ queryKey: ["zoho", "directory", params], queryFn: () => apiPage<ZohoVendorRow>(`/vendors/zoho-directory${qs(params)}`), placeholderData: keepPreviousData });
}
/** Counts and sync progress; polls every 1.5 s only while a sync is running. */
export function useZohoSyncStatus() {
  return useQuery({
    queryKey: ["zoho", "directory-status"],
    queryFn: () => api<ZohoSyncStatus>("/vendors/zoho-directory/status"),
    refetchInterval: (q) => (q.state.data?.sync.running ? 1500 : false),
  });
}
export function useStartZohoSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ZohoSyncStatus["sync"]>("/vendors/zoho-directory/sync", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zoho", "directory-status"] }),
  });
}

/** KYC scans: upload (one document type at a time) and remove. Both return the refreshed vendor. */
export function useKycFiles() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: key });
  const upload = useMutation({
    mutationFn: ({ id, docType, files }: { id: string; docType: KycKey; files: File[] }) => api<Vendor>(`/vendors/${id}/kyc-files`, { method: "POST", body: formData(files, { docType }) }),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: ({ id, fileId }: { id: string; fileId: string }) => api<Vendor>(`/vendors/${id}/kyc-files/${fileId}`, { method: "DELETE" }), onSuccess: done });
  return { upload, remove };
}

export async function downloadVendorTemplate() {
  const { blob, fileName } = await apiBlob("/vendors/template");
  saveBlob(blob, fileName ?? "vendor-template.xlsx");
}
export type ExportFormat = "xlsx" | "csv";
/** Registered vendors, every row matching the filters (all pages). */
export async function downloadVendors(format: ExportFormat, filters: { q?: string | undefined; status?: VendorStatus | "" | undefined; type?: VendorType | "" | undefined } = {}) {
  const { blob, fileName } = await apiBlob(`/vendors/export${qs({ format, ...filters })}`);
  saveBlob(blob, fileName ?? `registered-vendors.${format}`);
}
/** Zoho vendors, every row matching the search and status (all pages). */
export async function downloadZohoVendors(format: ExportFormat, filters: { q?: string | undefined; status?: "active" | "inactive" | "" | undefined } = {}) {
  const { blob, fileName } = await apiBlob(`/vendors/zoho-directory/export${qs({ format, ...filters })}`);
  saveBlob(blob, fileName ?? `zoho-vendors.${format}`);
}

/** A mobile-app login that belongs to a vendor company; it sees only that vendor's shops. */
export interface VendorLogin { id: string; name: string; email: string; phone: string | null; employeeId: string | null; isActive: boolean }
export interface VendorLoginInput { name: string; phone: string; employeeId: string; email: string; mpin: string }
export const useVendorLogins = (vendorId?: string) =>
  useQuery({ queryKey: [...key, "logins", vendorId], queryFn: () => api<VendorLogin[]>(`/vendors/${vendorId}/logins`), enabled: !!vendorId });
export function useCreateVendorLogin(vendorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: VendorLoginInput) => api<VendorLogin>(`/vendors/${vendorId}/logins`, { method: "POST", body: JSON.stringify({ ...b, authMethod: "MPIN" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...key, "logins", vendorId] }),
  });
}
