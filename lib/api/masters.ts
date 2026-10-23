import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qs } from "./common";

export interface Industry {
  _id: string;
  name: string;
}

/** Industry / Business Category master (backend `industries` collection). */
export function useIndustries() {
  return useQuery({ queryKey: ["masters", "industries"], queryFn: () => api<Industry[]>("/masters/industries"), staleTime: 5 * 60_000 });
}

export function useAddIndustry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<Industry>("/masters/industries", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["masters", "industries"] }),
  });
}

/** States and their cities (backend `locations` collection). */
export function useStates() {
  return useQuery({ queryKey: ["masters", "states"], queryFn: () => api<string[]>("/masters/states"), staleTime: 30 * 60_000 });
}

export function useCities(state: string) {
  return useQuery({
    queryKey: ["masters", "cities", state],
    queryFn: () => api<string[]>(`/masters/cities${qs({ state })}`),
    enabled: !!state,
    staleTime: 5 * 60_000,
  });
}

export function useAddCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { state: string; name: string }) => api<{ state: string; name: string }>("/masters/cities", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ["masters", "cities", v.state] }),
  });
}
