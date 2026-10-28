import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiPage, saveBlob, type Paged } from "@/lib/api";
import { qs } from "./common";
import type { SiteDataScenario } from "./projects";

export const UNITS = ["ft", "in", "m", "cm", "mm"] as const;
export type Unit = (typeof UNITS)[number];
export type Scenario = SiteDataScenario;
export const SCENARIOS: Scenario[] = ["MEASUREMENT_REQUIRED", "CLIENT_PROVIDED"];
export const SCENARIO_LABEL: Record<Scenario, string> = {
  MEASUREMENT_REQUIRED: "Scenario 1 - We measure",
  CLIENT_PROVIDED: "Scenario 2 - Client gives size",
};

export const MAPPABLE = [
  "shopName",
  "dealerName",
  "location",
  "district",
  "address1",
  "address2",
  "address3",
  "pincode",
  "mobile",
  "gstin",
  "contactPerson",
  "width",
  "height",
  "size",
  "unit",
  "boardType",
  "quantity",
  "remarks",
  "clientSiteCode",
] as const;
export type MappableField = (typeof MAPPABLE)[number];
export type MapTarget = MappableField | "extra" | "ignore";

export const FIELD_LABELS: Record<MappableField, string> = {
  shopName: "Shop Name",
  dealerName: "Dealer / Customer Name",
  location: "Location / Area",
  district: "District",
  address1: "Address Line 1",
  address2: "Address Line 2",
  address3: "Address Line 3",
  pincode: "Pincode",
  mobile: "Mobile",
  gstin: "GST No",
  contactPerson: "Contact Person",
  width: "Width",
  height: "Height",
  size: "Size (W x H)",
  unit: "Unit",
  boardType: "Board Type",
  quantity: "Qty",
  remarks: "Remarks",
  clientSiteCode: "Client Site Code",
};

/** Mirrors validateMapping in the backend's site.fields.ts. The server's 400 remains the source of truth. */
export function validateMapping(mapping: Record<string, MapTarget>, scenario: Scenario): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const [header, t] of Object.entries(mapping)) {
    if (t === "extra" || t === "ignore") continue;
    if (seen.has(t)) problems.push(`"${FIELD_LABELS[t]}" is mapped to both "${seen.get(t)}" and "${header}"`);
    seen.set(t, header);
  }
  if (!seen.has("shopName") && !seen.has("dealerName")) problems.push("Map at least Shop Name or Dealer Name");
  const hasSize = seen.has("size") || (seen.has("width") && seen.has("height"));
  if (scenario === "CLIENT_PROVIDED" && !hasSize) problems.push("Scenario 2 needs Size (W x H) or both Width and Height mapped");
  return problems;
}

export interface Site {
  _id: string;
  project: string;
  siteCode: string;
  seq: number;
  scenario: Scenario;
  shopName?: string;
  dealerName?: string;
  location?: string;
  district?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  pincode?: string;
  mobile?: string;
  mobileAlt?: string;
  gstin?: string;
  contactPerson?: string;
  width?: number;
  height?: number;
  unit?: Unit;
  quantity?: number;
  sqft?: number;
  boardType?: string;
  remarks?: string;
  clientSiteCode?: string;
  extra?: Record<string, unknown>;
  status: string;
  importBatch?: string;
  sourceRow?: number;
  createdAt: string;
  updatedAt: string;
}

/** Editable (writable) site fields as sent to the API. */
export interface SiteFields {
  shopName?: string;
  dealerName?: string;
  location?: string;
  district?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  pincode?: string;
  mobile?: string;
  gstin?: string;
  contactPerson?: string;
  boardType?: string;
  remarks?: string;
  clientSiteCode?: string;
  width?: number | string;
  height?: number | string;
  quantity?: number | string;
  unit?: Unit;
  scenario?: Scenario;
}

export type MissingKey = "address" | "mobile" | "measurement" | "gst" | "district";

export interface SiteFilter {
  q?: string;
  district?: string;
  status?: string;
  scenario?: Scenario | "";
  missing?: MissingKey | "";
  importBatchId?: string;
}
export interface SiteListParams extends SiteFilter {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface SiteStats {
  total: number;
  totalSqft: number;
  districts: { district: string; count: number }[];
  missing: { address: number; mobile: number; measurement: number; gst: number };
}
export interface SiteWarning {
  field: string;
  code: string;
  message: string;
}
export interface SiteSaveResult {
  site: Site;
  warnings: SiteWarning[];
}

/** Columns that can be exported / shown. `sortable` follows the backend SORTABLE list. */
export const SITE_COLUMNS: { key: string; label: string; sortable?: boolean; align?: "right"; width: number }[] = [
  { key: "siteCode", label: "Site ID", sortable: true, width: 190 },
  { key: "shopName", label: "Shop", sortable: true, width: 200 },
  { key: "dealerName", label: "Dealer", sortable: true, width: 170 },
  { key: "clientSiteCode", label: "Client code", width: 120 },
  { key: "location", label: "Location", sortable: true, width: 150 },
  { key: "district", label: "District", sortable: true, width: 140 },
  { key: "address1", label: "Address 1", width: 220 },
  { key: "address2", label: "Address 2", width: 180 },
  { key: "address3", label: "Address 3", width: 160 },
  { key: "pincode", label: "Pincode", width: 100 },
  { key: "mobile", label: "Mobile", width: 130 },
  { key: "gstin", label: "GST No", width: 170 },
  { key: "contactPerson", label: "Contact person", width: 150 },
  { key: "width", label: "Width", align: "right", width: 90 },
  { key: "height", label: "Height", align: "right", width: 90 },
  { key: "unit", label: "Unit", width: 80 },
  { key: "quantity", label: "Qty", align: "right", width: 80 },
  { key: "sqft", label: "Sq.ft", sortable: true, align: "right", width: 100 },
  { key: "boardType", label: "Board type", width: 140 },
  { key: "status", label: "Status", sortable: true, width: 110 },
  { key: "scenario", label: "Scenario", width: 150 },
  { key: "remarks", label: "Remarks", width: 220 },
];

export const sitesKey = (pid: string) => ["sites", pid] as const;

export function useSites(pid: string, params: SiteListParams, enabled = true) {
  return useQuery({
    queryKey: [...sitesKey(pid), "list", params],
    queryFn: () => apiPage<Site>(`/projects/${pid}/sites${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled: enabled && !!pid,
  });
}

export function useSiteStats(pid: string, enabled = true) {
  return useQuery({
    queryKey: [...sitesKey(pid), "stats"],
    queryFn: () => api<SiteStats>(`/projects/${pid}/sites/stats`),
    enabled: enabled && !!pid,
  });
}

function useSiteMutation<V, R>(pid: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sitesKey(pid) });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export const useCreateSite = (pid: string) =>
  useSiteMutation<SiteFields & { allowDuplicate?: boolean }, SiteSaveResult>(pid, (body) =>
    api(`/projects/${pid}/sites`, { method: "POST", body: JSON.stringify(body) }),
  );

export function useUpdateSite(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SiteFields }) =>
      api<SiteSaveResult>(`/sites/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (res) => {
      // Only after the server confirmed: swap the saved row into cached pages, then refetch for truth.
      qc.setQueriesData<Paged<Site>>({ queryKey: [...sitesKey(pid), "list"] }, (old) =>
        old ? { ...old, data: old.data.map((s) => (s._id === res.site._id ? { ...s, ...res.site } : s)) } : old,
      );
      qc.invalidateQueries({ queryKey: sitesKey(pid) });
    },
  });
}

export const useDeleteSite = (pid: string) =>
  useSiteMutation<string, unknown>(pid, (id) => api(`/sites/${id}`, { method: "DELETE" }));

export const useDuplicateSite = (pid: string) =>
  useSiteMutation<string, Site>(pid, (id) => api(`/sites/${id}/duplicate`, { method: "POST", body: "{}" }));

export type BulkPatch = Pick<SiteFields, "district" | "location" | "boardType" | "remarks" | "unit" | "scenario"> & {
  width?: number;
  height?: number;
};
export type BulkBody =
  | { action: "delete"; ids?: string[]; filter?: SiteFilter }
  | { action: "update"; ids?: string[]; filter?: SiteFilter; patch: BulkPatch };

export const useBulkSites = (pid: string) =>
  useSiteMutation<BulkBody, { affected: number }>(pid, (body) =>
    api(`/projects/${pid}/sites/bulk`, { method: "POST", body: JSON.stringify(body) }),
  );

export interface ExportOptions {
  format: "xlsx" | "csv";
  columns?: string[];
  ids?: string[];
  filter?: SiteFilter;
  sort?: string;
}
/** Exports the current view (filters + columns + sort) or only the given ids. */
export async function downloadSites(pid: string, o: ExportOptions) {
  const { blob, fileName } = await apiBlob(
    `/projects/${pid}/sites/export${qs({
      format: o.format,
      columns: o.columns?.join(","),
      ids: o.ids?.length ? o.ids.join(",") : undefined,
      sort: o.sort,
      ...(o.ids?.length ? {} : o.filter),
    })}`,
  );
  saveBlob(blob, fileName ?? `sites.${o.format}`);
}

export async function downloadTemplate(pid: string, scenario: Scenario) {
  const { blob, fileName } = await apiBlob(`/projects/${pid}/sites/template${qs({ scenario })}`);
  saveBlob(blob, fileName ?? "site-template.xlsx");
}

// ---------------- Import (staged) ----------------

export type BatchStatus = "UPLOADED" | "PREVIEWED" | "COMMITTING" | "COMMITTED" | "FAILED" | "DISCARDED";
export type DuplicatePolicy = "skip" | "import" | "update";
export interface ImportSummary {
  valid: number;
  warning: number;
  error: number;
  duplicates: number;
  skipped: number;
}
export interface ImportBatch {
  _id: string;
  fileName?: string;
  fileSize?: number;
  sheetName?: string;
  headers: string[];
  scenario?: Scenario;
  defaultUnit?: Unit;
  duplicatePolicy?: DuplicatePolicy;
  status: BatchStatus;
  totalRows: number;
  summary?: ImportSummary;
  result?: { created: number; updated: number; skippedRows: number; errorRows: number };
  committedAt?: string;
  createdAt: string;
  createdBy?: { _id: string; name: string } | null;
}
export interface UploadResult {
  batch: ImportBatch;
  suggestedMapping: Record<string, MapTarget>;
  sample: { rowNumber: number; raw: Record<string, string> }[];
  problems: string[];
}
export interface ImportRow {
  _id: string;
  rowNumber: number;
  raw: Record<string, string>;
  mapped: SiteFields & { mobileAlt?: string };
  extra?: Record<string, string>;
  errors: SiteWarning[];
  warnings: SiteWarning[];
  state: "VALID" | "WARNING" | "ERROR";
  dup?: { type?: "FILE" | "EXISTING" | "DEALER"; ref?: string } | null;
  skipped: boolean;
}
export type RowState = "VALID" | "WARNING" | "ERROR" | "DUPLICATE";

export function uploadImport(pid: string, file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  return api<UploadResult>(`/projects/${pid}/sites/imports`, { method: "POST", body: fd });
}

/** Stage the Excel / CSV that BD already attached to the project, without downloading and uploading it again. */
export const extractFromFile = (pid: string, fileId: string) =>
  api<UploadResult>(`/projects/${pid}/sites/imports/from-file`, { method: "POST", body: JSON.stringify({ fileId }) });

export interface PreviewBody {
  mapping: Record<string, MapTarget>;
  scenario: Scenario;
  defaultUnit: Unit;
  duplicatePolicy: DuplicatePolicy;
}
export const previewImport = (pid: string, batchId: string, body: PreviewBody) =>
  api<ImportBatch>(`/projects/${pid}/sites/imports/${batchId}/preview`, { method: "POST", body: JSON.stringify(body) });

export const commitImport = (pid: string, batchId: string, duplicatePolicy: DuplicatePolicy) =>
  api<ImportBatch>(`/projects/${pid}/sites/imports/${batchId}/commit`, {
    method: "POST",
    body: JSON.stringify({ duplicatePolicy }),
  });

export const discardImport = (pid: string, batchId: string) =>
  api<unknown>(`/projects/${pid}/sites/imports/${batchId}`, { method: "DELETE" });

export const patchImportRow = (
  pid: string,
  batchId: string,
  rowId: string,
  body: { mapped?: SiteFields; skipped?: boolean },
) =>
  api<{ row: ImportRow; summary: ImportSummary }>(`/projects/${pid}/sites/imports/${batchId}/rows/${rowId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export function useImportRows(pid: string, batchId: string, params: { state?: RowState | ""; page: number; limit: number }) {
  return useQuery({
    queryKey: ["site-import", pid, batchId, "rows", params],
    queryFn: () => apiPage<ImportRow>(`/projects/${pid}/sites/imports/${batchId}/rows${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled: !!batchId,
  });
}

export function useImportHistory(pid: string, enabled: boolean) {
  return useQuery({
    queryKey: [...sitesKey(pid), "imports"],
    queryFn: () => api<ImportBatch[]>(`/projects/${pid}/sites/imports`),
    enabled,
  });
}
