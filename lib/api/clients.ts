import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs } from "./common";

export interface ClientContact {
  name: string;
  designation?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
}
export interface Client {
  _id: string;
  name: string;
  code: string;
  contacts: ClientContact[];
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  notes?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
  updatedAt?: string;
}
export interface ClientInput {
  name: string;
  code?: string;
  contacts: ClientContact[];
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  notes?: string;
  status: "ACTIVE" | "INACTIVE";
}
export interface ClientListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  sort?: string;
}

export function useClients(params: ClientListParams, enabled = true) {
  return useQuery({
    queryKey: ["clients", "list", params],
    queryFn: () => apiPage<Client>(`/clients${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
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
    mutationFn: ({ id, body }: { id?: string; body: ClientInput }) => {
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

export function useDeactivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}
