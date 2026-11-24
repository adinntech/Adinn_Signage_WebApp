import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { applyCatalogOrder, reorderBody } from "@/lib/catalog-rules";
import type {
  CatalogData,
  CatalogDefaultsResult,
  CatalogInstallation,
  CatalogMedia,
  CatalogQuestion,
  CatalogUsage,
  InstallationCreateInput,
  InstallationDeleteResult,
  InstallationPatch,
  MediaCreateInput,
  MediaDeleteResult,
  MediaPatch,
  QuestionCreateInput,
  QuestionPatch,
  ReorderKind,
  ReorderResult,
} from "@/types/catalog";

/** Media catalog admin API (`/api/v1/catalog`, permission `catalog:manage`). Every write refreshes both lists. */
const KEY = ["catalog"] as const;
const ALL = [...KEY, "all"] as const;
const USAGE = [...KEY, "usage"] as const;

/** Everything in one answer: media types, installation methods, site questions and the version number. */
export const useCatalog = () => useQuery({ queryKey: ALL, queryFn: () => api<CatalogData>("/catalog"), staleTime: 30_000 });
/** Boards of recorded recces that use each media type and installation method. */
export const useCatalogUsage = () => useQuery({ queryKey: USAGE, queryFn: () => api<CatalogUsage>("/catalog/usage"), staleTime: 30_000 });

const json = (body: unknown) => JSON.stringify(body);
const code = (c: string) => encodeURIComponent(c);

/** A write; when it succeeds the catalog and the usage numbers are loaded again (the mutation stays pending until they are). */
function useChange<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export const useCreateMedia = () => useChange((b: MediaCreateInput) => api<CatalogMedia>("/catalog/media", { method: "POST", body: json(b) }));
export const useUpdateMedia = () => useChange(({ code: c, patch }: { code: string; patch: MediaPatch }) => api<CatalogMedia>(`/catalog/media/${code(c)}`, { method: "PUT", body: json(patch) }));
export const useDeleteMedia = () => useChange((c: string) => api<MediaDeleteResult>(`/catalog/media/${code(c)}`, { method: "DELETE" }));

export const useCreateInstallation = () => useChange((b: InstallationCreateInput) => api<CatalogInstallation>("/catalog/installations", { method: "POST", body: json(b) }));
export const useUpdateInstallation = () =>
  useChange(({ code: c, patch }: { code: string; patch: InstallationPatch }) => api<CatalogInstallation>(`/catalog/installations/${code(c)}`, { method: "PUT", body: json(patch) }));
export const useDeleteInstallation = () => useChange((c: string) => api<InstallationDeleteResult>(`/catalog/installations/${code(c)}`, { method: "DELETE" }));

export const useCreateQuestion = () => useChange((b: QuestionCreateInput) => api<CatalogQuestion>("/catalog/questions", { method: "POST", body: json(b) }));
export const useUpdateQuestion = () => useChange(({ uid, patch }: { uid: string; patch: QuestionPatch }) => api<CatalogQuestion>(`/catalog/questions/${code(uid)}`, { method: "PUT", body: json(patch) }));
export const useDeleteQuestion = () => useChange((uid: string) => api<{ deleted: string }>(`/catalog/questions/${code(uid)}`, { method: "DELETE" }));

/** "Load built-in defaults": adds back any built-in entry that is missing; nothing that exists is touched. */
export const useLoadDefaults = () => useChange(() => api<CatalogDefaultsResult>("/catalog/defaults", { method: "POST", body: "{}" }));

/**
 * Sets the order of media types, installation methods, or the questions of ONE group (`ids` are codes, or question uids).
 * The new order shows at once and is put back if the server refuses.
 */
export function useReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { kind: ReorderKind; ids: string[] }) => api<ReorderResult>("/catalog/reorder", { method: "POST", body: json(reorderBody(v.kind, v.ids)) }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ALL });
      const before = qc.getQueryData<CatalogData>(ALL);
      if (before) qc.setQueryData<CatalogData>(ALL, applyCatalogOrder(before, v.kind, v.ids));
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(ALL, ctx.before);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
