import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qs } from "./common";

export interface LookupUser {
  _id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

export function useUserLookup(roles: string[] = [], q = "", enabled = true) {
  return useQuery({
    queryKey: ["users", "lookup", roles.join(","), q],
    queryFn: () => api<LookupUser[]>(`/users/lookup${qs({ roles: roles.join(","), q })}`),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
