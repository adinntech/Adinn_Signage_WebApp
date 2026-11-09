import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiPage, apiUpload, saveBlob, type Paged } from "@/lib/api";

/** One address in the address book behind the To / Cc / Bcc suggestions. */
export interface MailContact {
  id: string;
  email: string;
  name: string | null;
  group: string | null;
  active: boolean;
}
export type MailContactInput = { email: string; name?: string; group?: string; active?: boolean };
export interface ImportResult {
  added: number;
  updated: number;
  skipped: { row: number; email: string; reason: string }[];
}

const KEY = ["mail-contacts"];

/** Suggestions for what has been typed so far in a recipient box (empty text gives no request). */
export const useContactSuggest = (q: string) =>
  useQuery({
    queryKey: [...KEY, "suggest", q],
    queryFn: () => api<MailContact[]>(`/mail-contacts/suggest?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

/** What narrows the address book: text, status and group ("none" = no group). */
export interface ContactFilter { q: string; status: "" | "active" | "inactive"; group: string }
export type ContactSortKey = "name" | "email" | "group" | "status";
export interface ContactListParams extends ContactFilter { page: number; limit: number; sort: ContactSortKey; dir: "asc" | "desc" }

const filterQs = (f: ContactFilter) => `q=${encodeURIComponent(f.q)}${f.status ? `&status=${f.status}` : ""}${f.group ? `&group=${encodeURIComponent(f.group)}` : ""}`;

export const useMailContacts = (p: ContactListParams) =>
  useQuery<Paged<MailContact>>({
    queryKey: [...KEY, "list", p],
    queryFn: () => apiPage<MailContact>(`/mail-contacts?${filterQs(p)}&page=${p.page}&limit=${p.limit}&sort=${p.sort}&dir=${p.dir}`),
    placeholderData: keepPreviousData,
  });

/** The groups in use, for the group filter. */
export const useContactGroups = () => useQuery({ queryKey: [...KEY, "groups"], queryFn: () => api<string[]>("/mail-contacts/groups") });

export type BulkAction = "activate" | "deactivate" | "delete" | "group";
/** Many contacts at once: the ticked ones (ids) or everything the filter shows (filter). */
export interface BulkInput { action: BulkAction; ids?: string[]; filter?: { q: string; status?: "active" | "inactive"; group?: string }; group?: string }

function useChange<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export const useBulkContacts = () => useChange((b: BulkInput) => api<{ matched: number; action: BulkAction }>("/mail-contacts/bulk", { method: "POST", body: JSON.stringify(b) }));
export const useAddContact = () => useChange((b: MailContactInput) => api<MailContact>("/mail-contacts", { method: "POST", body: JSON.stringify(b) }));
export const useEditContact = () => useChange(({ id, ...b }: Partial<MailContactInput> & { id: string }) => api<MailContact>(`/mail-contacts/${id}`, { method: "PUT", body: JSON.stringify(b) }));
export const useDeleteContact = () => useChange((id: string) => api<{ deleted: true }>(`/mail-contacts/${id}`, { method: "DELETE" }));
export const useImportContacts = () =>
  useChange((file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiUpload<ImportResult>("/mail-contacts/import", fd);
  });

export async function downloadContactSample() {
  const { blob, fileName } = await apiBlob("/mail-contacts/sample");
  saveBlob(blob, fileName ?? "mail-contacts-sample.xlsx");
}
