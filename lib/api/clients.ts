import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";

export type ClientType = "NEW" | "EXISTING";

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
  email?: string;
  industry?: string;
  contacts: ClientContact[];
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  notes?: string;
  /** Missing on clients created before the BD CRM; those count as EXISTING. */
  clientType?: ClientType;
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
  email?: string;
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
  sort?: string;
}
export interface ClientSummary {
  newClientOrders: number;
  existingClientOrders: number;
  totalClients: number;
  activeClients: number;
  clientsThisMonth: number;
}
/** Add Client form body: company + contact persons (no order). */
export type CompanyInput = Omit<ClientInput, "code" | "status" | "notes">;

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
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

export function useDeactivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}
