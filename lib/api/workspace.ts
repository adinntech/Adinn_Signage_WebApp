import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiUpload } from "@/lib/api";
import { qs } from "./common";
import type { Attachment } from "./connect";

export const ACTIVITY_CATEGORIES = ["PROJECT", "STAGE", "ASSIGNMENT", "DOCUMENTS", "MAIL", "CODES", "APPROVAL", "SHOPS", "NOTES"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
export type Visibility = "PROJECT" | "PRIVATE";

export interface Person {
  id: string;
  name: string;
  role: string;
}
export interface WsOverview {
  project: { id: string; code: string; name: string; status: string; client: { name: string; clientNo: string | null } };
  people: Person[];
  counts: { notes: number; voiceNotes: number };
}
export interface ActivityEvent {
  id: string;
  at: string;
  category: ActivityCategory;
  title: string;
  by: { name: string; role: string } | null;
}
export interface ActivityPage {
  events: ActivityEvent[];
  hasMore: boolean;
  nextBefore: string | null;
}
export interface WsNote {
  id: string;
  author: Person;
  body: string;
  visibility: Visibility;
  mentions: string[];
  attachments: Attachment[];
  edited: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
}
export interface VoiceNote {
  id: string;
  title: string;
  author: Person;
  durationSec: number;
  peaks: number[];
  fileName: string;
  size: number;
  canDelete: boolean;
  createdAt: string;
}
export interface Draft {
  body: string;
  visibility: Visibility;
  savedAt: string;
}

const B = (pid: string) => `/workspace/projects/${pid}`;
const k = (pid: string) => ["workspace", pid] as const;

export const useWsOverview = (pid: string) => useQuery({ queryKey: [...k(pid), "overview"], queryFn: () => api<WsOverview>(B(pid)) });

export const useActivity = (pid: string, category?: ActivityCategory) =>
  useInfiniteQuery({
    queryKey: [...k(pid), "activity", category ?? "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<ActivityPage>(`${B(pid)}/activity${qs({ category, before: pageParam, limit: 30 })}`),
    getNextPageParam: (p) => (p.hasMore ? (p.nextBefore ?? undefined) : undefined),
  });

export const useNotes = (pid: string) => useQuery({ queryKey: [...k(pid), "notes"], queryFn: () => api<{ notes: WsNote[]; people: Person[] }>(`${B(pid)}/notes`) });
export const useDraft = (pid: string) => useQuery({ queryKey: [...k(pid), "draft"], queryFn: () => api<Draft | null>(`${B(pid)}/note-draft`), staleTime: Infinity, gcTime: 0 });
export const useVoiceNotes = (pid: string) => useQuery({ queryKey: [...k(pid), "voice"], queryFn: () => api<VoiceNote[]>(`${B(pid)}/voice-notes`) });

/** A change to notes or voice notes also adds an event to the history and changes the counts. */
function useRefresh(pid: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: k(pid) });
}

export function useCreateNote(pid: string) {
  const done = useRefresh(pid);
  return useMutation({
    mutationFn: (v: { body: string; visibility: Visibility; mentions: string[]; files: File[] }) => {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ body: v.body, visibility: v.visibility, mentions: v.mentions }));
      for (const f of v.files) fd.append("files", f);
      return api<WsNote>(`${B(pid)}/notes`, { method: "POST", body: fd });
    },
    onSuccess: done,
  });
}
export function useEditNote(pid: string) {
  const done = useRefresh(pid);
  return useMutation({ mutationFn: (v: { id: string; body: string; visibility?: Visibility }) => api<WsNote>(`${B(pid)}/notes/${v.id}`, { method: "PATCH", body: JSON.stringify({ body: v.body, visibility: v.visibility }) }), onSuccess: done });
}
export function useDeleteNote(pid: string) {
  const done = useRefresh(pid);
  return useMutation({ mutationFn: (id: string) => api(`${B(pid)}/notes/${id}`, { method: "DELETE" }), onSuccess: done });
}
/** Saves the unsent note as it is typed. Does not refresh the page: nothing else shows a draft. */
export const saveDraft = (pid: string, v: { body: string; visibility: Visibility }) => api<Draft | null>(`${B(pid)}/note-draft`, { method: "PUT", body: JSON.stringify(v) });

export function useUploadVoiceNote(pid: string) {
  const done = useRefresh(pid);
  return useMutation({
    mutationFn: (v: { file: File; title: string; durationSec: number; peaks: number[]; onProgress: (p: number) => void }) => {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ title: v.title, durationSec: v.durationSec, peaks: v.peaks }));
      fd.append("files", v.file);
      return apiUpload<VoiceNote>(`${B(pid)}/voice-notes`, fd, { onProgress: v.onProgress });
    },
    onSuccess: done,
  });
}
export function useDeleteVoiceNote(pid: string) {
  const done = useRefresh(pid);
  return useMutation({ mutationFn: (id: string) => api(`${B(pid)}/voice-notes/${id}`, { method: "DELETE" }), onSuccess: done });
}

export const voiceNoteUrl = (pid: string, id: string) => api<{ url: string; name: string }>(`${B(pid)}/voice-notes/${id}/url`);
export const noteFileUrl = (pid: string, noteId: string, fileId: string) => api<{ url: string; name: string }>(`${B(pid)}/notes/${noteId}/files/${fileId}/url`);
