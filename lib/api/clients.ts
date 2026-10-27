import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";
import type { FileRef } from "./files";

export type ClientType = "NEW" | "EXISTING";

/** Extra client details added by BD: a free label with its value. */
export interface CustomField {
  label: string;
  value: string;
}
export interface ClientFile extends FileRef {
  kind?: "image" | "document" | "sheet" | "video";
  uploadedAt?: string;
}

export interface ClientContact {
  name: string;
  designation?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  alternateEmail?: string;
  isPrimary: boolean;
}
export interface Client {
  _id: string;
  name: string;
  code: string;
  /** BD CRM Client ID, e.g. CLI-0001. */
  clientNo?: string;
  /** Optional client name typed by BD, shown alongside the company name. */
  clientName?: string;
  email?: string;
  /** Company phone number. */
  phone?: string;
  industry?: string;
  contacts: ClientContact[];
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  gstCertificates?: ClientFile[];
  customFields?: CustomField[];
  notes?: string;
  /** Missing on clients created before the BD CRM; those count as EXISTING. */
  clientType?: ClientType;
  source?: "CRM" | "ZOHO";
  zohoId?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
  updatedAt?: string;
}
export interface ClientDetails extends Client {
  clientType: ClientType;
  orderCount: number;
  createdBy?: { _id: string; name: string; role?: string } | null;
  updatedBy?: { _id: string; name: string; role?: string } | null;
}
export interface ClientInput {
  name: string;
  code?: string;
  contacts: ClientContact[];
  clientName?: string;
  email?: string;
  phone?: string;
  customFields?: CustomField[];
  industry?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  notes?: string;
  status: "ACTIVE" | "INACTIVE";
}
export interface ClientListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  clientType?: string;
  /** CRM = registered in Client Management; ZOHO = brought in from Zoho. */
  source?: "CRM" | "ZOHO";
  sort?: string;
}
export interface ClientSummary {
  newClientOrders: number;
  existingClientOrders: number;
  totalClients: number;
  activeClients: number;
  clientsThisMonth: number;
}
/** Add / Edit Client form body (no order). Contact persons are managed on the client page and at handover. */
export type CompanyInput = Omit<ClientInput, "code" | "status" | "notes" | "contacts"> & { contacts?: ClientContact[] };

export const clientTypeOf = (c: Pick<Client, "clientType">): ClientType => c.clientType ?? "EXISTING";
export const primaryContact = (c: Pick<Client, "contacts">) => c.contacts?.find((k) => k.isPrimary) ?? c.contacts?.[0];

export function useClients(params: ClientListParams, enabled = true) {
  return useQuery({
    queryKey: ["clients", "list", params],
    queryFn: () => apiPage<Client>(`/clients${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useClientSummary() {
  return useQuery({ queryKey: ["clients", "summary"], queryFn: () => api<ClientSummary>("/clients/summary") });
}

export function useClient(id: string | undefined) {
  return useQuery({ queryKey: ["clients", "detail", id], queryFn: () => api<ClientDetails>(`/clients/${id}`), enabled: !!id });
}

/** Active clients for pickers. */
export function useClientOptions(enabled = true) {
  return useQuery({
    queryKey: ["clients", "options"],
    queryFn: () => apiPage<Client>(`/clients${qs({ limit: 100, status: "ACTIVE", sort: "name" })}`),
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ClientInput | Partial<ClientInput> }) => {
      if (id) {
        // code is immutable after create
        const patch: Partial<ClientInput> = { ...body };
        delete patch.code;
        return api<Client>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      }
      return api<Client>("/clients", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      // Orders and leads show the client's details and contacts.
      qc.invalidateQueries({ queryKey: ["sales", "order"] });
      qc.invalidateQueries({ queryKey: ["leads", "lead"] });
    },
  });
}

/** Client Management "Add Client": registers the company with its contacts and a Client ID. Orders are created in Order Management. */
export function useRegisterCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CompanyInput) => api<Client>("/clients/company", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

/** GST certificate files: upload (multipart `files`) and remove. Both return the refreshed client. */
export function useGstCertificates() {
  const qc = useQueryClient();
  const done = (c: ClientDetails) => {
    qc.setQueryData(["clients", "detail", c._id], c);
    qc.invalidateQueries({ queryKey: ["clients", "list"] });
  };
  const upload = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormData }) => api<ClientDetails>(`/clients/${id}/gst-certificates`, { method: "POST", body }),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: ({ id, fileId }: { id: string; fileId: string }) => api<ClientDetails>(`/clients/${id}/gst-certificates/${fileId}`, { method: "DELETE" }),
    onSuccess: done,
  });
  return { upload, remove };
}

export function useDeactivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}
