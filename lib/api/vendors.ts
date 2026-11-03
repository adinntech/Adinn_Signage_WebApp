import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiPage, saveBlob } from "@/lib/api";
import { qs } from "./common";
import { newRequestKey } from "./sales";
import { formData, type FileRef } from "./files";

export type VendorType = "ONE_MAN" | "ORGANIZATION";
export type VendorStatus = "PENDING_KYC" | "ACTIVE" | "INACTIVE" | "BLACKLISTED";
export const VENDOR_TYPE_LABEL: Record<VendorType, string> = { ONE_MAN: "One-man / Freelancer", ORGANIZATION: "Organization" };
export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = { PENDING_KYC: "Pending KYC", ACTIVE: "Active", INACTIVE: "Inactive", BLACKLISTED: "Blacklisted" };
export const KYC_ITEMS = [
  { key: "pan", label: "PAN card" },
  { key: "gst", label: "GST certificate" },
  { key: "bank", label: "Bank proof (cancelled cheque / passbook)" },
  { key: "address", label: "Address proof" },
] as const;
export type KycKey = (typeof KYC_ITEMS)[number]["key"];
/** A scan can also be filed under "other": a document that was missed. It is not part of the checklist. */
export type KycDocKey = KycKey | "other";

/** A KYC scan stored for a vendor; `docType` is the checklist item it proves. */
export interface KycFile extends FileRef {
  docType: KycDocKey;
  uploadedAt?: string;
}

export interface Vendor {
  _id: string;
  code: string;
  name: string;
  type: VendorType;
  typeName?: string;
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
  registration?: { mailSentAt?: string; vendorIdAt?: string; draft?: { savedAt?: string } };
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
  typeName?: string;
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
  price: ZohoPrice;
}
export interface ZohoSyncStatus {
  sync: { running: boolean; phase: "list" | "details" | null; fetched: number; detailsDone: number; detailsTotal: number; startedAt: string | null; finishedAt: string | null; error: string | null };
  total: number;
  active: number;
  registered: number;
  lastSyncedAt: string | null;
}
export interface ZohoDirectoryParams { page?: number; limit?: number; q?: string; status?: "active" | "inactive" | ""; registered?: "yes" | "no" | ""; price?: "set" | "missing" | "" }

export function useZohoDirectory(params: ZohoDirectoryParams, enabled = true) {
  return useQuery({ queryKey: ["zoho", "directory", params], queryFn: () => apiPage<ZohoVendorRow>(`/vendors/zoho-directory${qs(params)}`), placeholderData: keepPreviousData, enabled });
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

/** A vendor type of the registration form; `rules` is the rule class it follows. */
export interface VendorTypeOption { _id: string; name: string; rules: VendorType; builtIn?: boolean }
export const useVendorTypes = () => useQuery({ queryKey: [...key, "types"], queryFn: () => api<VendorTypeOption[]>("/vendors/types"), staleTime: 60_000 });
export function useAddVendorType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { name: string; rules: VendorType }) => api<VendorTypeOption>("/vendors/types", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...key, "types"] }),
  });
}

/** The registration request mail: defaults, the files that will be attached, and what was sent before. */
export interface RegistrationMailDraft {
  mail: { enabled: boolean; identities: string[] };
  vendorType: VendorType;
  /** Recipients from the settings (VENDOR_REGISTRATION_RECIPIENTS). */
  groups: string[];
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  defaults: { subject: string; body: string };
  hasDraft: boolean;
  /** Required documents that are not uploaded yet (labels). */
  missing: string[];
  attachments: { fileId: string; name: string; size: number; docType: KycDocKey }[];
  registration: { mailSentAt?: string; vendorIdAt?: string } | null;
  zohoVendorNo: string | null;
  history: { _id: string; to: string[]; cc: string[]; subject: string; status: "SENT" | "FAILED" | "SKIPPED"; error?: string; attachmentNames: string[]; sentAt: string }[];
}
export const useRegistrationMail = (vendorId: string | undefined) =>
  useQuery({ queryKey: [...key, "mail", vendorId], // gcTime 0: closing the mail drops the copy, so opening it again always reads the latest saved draft from the server.
    queryFn: () => api<RegistrationMailDraft>(`/vendors/${vendorId}/registration-mail`), enabled: !!vendorId, staleTime: 0, gcTime: 0 });
export function useSendRegistrationMail(vendorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { to: string[]; cc: string[]; bcc?: string[] | undefined; subject: string; body: string; requestKey?: string | undefined; from?: string | undefined }) =>
      api<RegistrationMailDraft>(`/vendors/${vendorId}/registration-mail`, { method: "POST", body: JSON.stringify({ ...b, requestKey: b.requestKey ?? newRequestKey() }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
/** What the company already knows about a typed GST number: the Zoho Books vendor and the registered vendor with it. */
export interface GstCheck {
  gstin: string;
  zoho: { name: string; vendorNo: string | null; status: "active" | "inactive"; city: string | null; zohoContactId: string } | null;
  registered: { id: string; name: string; code: string; status: VendorStatus } | null;
}
/** Runs by itself once a complete GST number is typed. */
export const useGstCheck = (gstin: string, enabled: boolean) =>
  useQuery({ queryKey: [...key, "gst", gstin], queryFn: () => api<GstCheck>(`/vendors/gst/${gstin}`), enabled, staleTime: 5 * 60_000, retry: false });

/** Save as Draft / autosave of the mail being written. */
export function useSaveRegistrationDraft(vendorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }) => api<{ savedAt: string }>(`/vendors/${vendorId}/registration-mail/draft`, { method: "PUT", body: JSON.stringify(b) }),
    // Keep the open copy and the vendor list in step with what was just saved (switching tabs must not show an older draft).
    onSuccess: (_r, b) => {
      qc.setQueryData<RegistrationMailDraft>([...key, "mail", vendorId], (old) => (old ? { ...old, ...b, hasDraft: true } : old));
      void qc.invalidateQueries({ queryKey: [...key, "list"] });
    },
  });
}
/** Accounts replied with the vendor ID: type it to proceed. */
export const useSetVendorId = () => useVendorMutation(({ id, vendorNo }: { id: string; vendorNo: string }) => api<Vendor>(`/vendors/${id}/vendor-id`, { method: "POST", body: JSON.stringify({ vendorNo }) }));

/** Vendor price management: price per shop of a Zoho vendor (typed in the list). */
export interface ZohoPrice { ratePerShop: number | null; farRatePerShop: number | null; skills: string[]; source: "VENDOR" | "ZOHO" | null }
export interface VendorSkill { _id: string; name: string }
export const useVendorSkills = () => useQuery({ queryKey: [...key, "skills"], queryFn: () => api<VendorSkill[]>("/vendors/skills"), staleTime: 60_000 });
export function useAddVendorSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<VendorSkill>("/vendors/skills", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...key, "skills"] }),
  });
}
export function useSetZohoPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, ratePerShop, farRatePerShop, skills }: { contactId: string; ratePerShop: number | null; farRatePerShop: number | null; skills?: string[] }) =>
      api<ZohoPrice>(`/vendors/zoho-directory/${contactId}/price`, { method: "PUT", body: JSON.stringify({ ratePerShop, farRatePerShop, ...(skills ? { skills } : {}) }) }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["zoho"] }), qc.invalidateQueries({ queryKey: key })]),
  });
}

/** KYC scans: upload (one document type at a time) and remove. Both return the refreshed vendor. */
export function useKycFiles() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: key });
  const upload = useMutation({
    mutationFn: ({ id, docType, files }: { id: string; docType: KycDocKey; files: File[] }) => api<Vendor>(`/vendors/${id}/kyc-files`, { method: "POST", body: formData(files, { docType }) }),
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
export async function downloadZohoVendors(format: ExportFormat, filters: { q?: string | undefined; status?: "active" | "inactive" | "" | undefined; price?: "set" | "missing" | "" | undefined } = {}) {
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
