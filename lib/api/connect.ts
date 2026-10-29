import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qs } from "./common";

export type ChannelKind = "TEAM" | "PROJECT" | "PRIVATE" | "DM";

export interface ChannelItem {
  id: string;
  kind: ChannelKind;
  name: string;
  topic: string;
  dmUser: { id: string; name: string; role: string } | null;
  project: { id: string; code: string; name: string; status: string } | null;
  memberCount: number;
  unread: number;
  mentionUnread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string;
}
export interface ChannelMember {
  id: string;
  name: string;
  role: string;
  channelRole: "OWNER" | "MEMBER";
  active: boolean;
}
export interface ChannelDetail {
  id: string;
  kind: ChannelKind;
  name: string;
  topic: string;
  archived: boolean;
  allowedRoles: string[];
  project: { id: string; code: string; name: string; status: string } | null;
  joined: boolean;
  canManage: boolean;
  canPost: boolean;
  pinned: string[];
  members: ChannelMember[];
}
export interface Attachment {
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "image" | "video" | "document" | "sheet" | "audio";
  voice: boolean;
  durationSec: number | null;
  /** Bar heights 0 to 100 of a voice note, recorded with it. */
  peaks?: number[];
}
export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}
export interface ChatMessage {
  id: string;
  channel: string;
  author: { id: string; name: string; role: string };
  body: string;
  parent: string | null;
  mentions: string[];
  attachments: Attachment[];
  reactions: Reaction[];
  replyCount: number;
  lastReplyAt: string | null;
  edited: boolean;
  deleted: boolean;
  pinned: boolean;
  createdAt: string;
}
export interface MessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
  root: ChatMessage | null;
}
export interface Person {
  id: string;
  name: string;
  role: string;
}
export interface SearchHit extends ChatMessage {
  channelName: string;
  channelKind: ChannelKind;
}
export interface ChannelFile extends Omit<Attachment, "durationSec" | "voice"> {
  voice: boolean;
  messageId: string;
  by: string;
  at: string;
}
export interface HistoryItem {
  id: string;
  action: string;
  reason: string;
  at: string;
  by: string | null;
}
export interface BrowseItem {
  id: string;
  name: string;
  kind: ChannelKind;
  topic: string;
  memberCount: number;
}

const B = "/connect";
export const connectKeys = {
  channels: ["connect", "channels"] as const,
  detail: (id: string) => ["connect", "channel", id] as const,
  messages: (id: string, thread?: string) => ["connect", "messages", id, thread ?? "main"] as const,
};

export const useChannels = (enabled = true) => useQuery({ queryKey: connectKeys.channels, queryFn: () => api<ChannelItem[]>(`${B}/channels`), enabled, staleTime: 20_000 });
export const useChannel = (id: string | undefined) => useQuery({ queryKey: connectKeys.detail(id ?? ""), queryFn: () => api<ChannelDetail>(`${B}/channels/${id}`), enabled: !!id });
export const useMessages = (id: string | undefined, thread?: string) =>
  useQuery({ queryKey: connectKeys.messages(id ?? "", thread), queryFn: () => api<MessagePage>(`${B}/channels/${id}/messages${qs({ thread, limit: 60 })}`), enabled: !!id });
export const usePins = (id: string | undefined, enabled: boolean) => useQuery({ queryKey: ["connect", "pins", id], queryFn: () => api<ChatMessage[]>(`${B}/channels/${id}/pins`), enabled: !!id && enabled });
export const useChannelFiles = (id: string | undefined, enabled: boolean) => useQuery({ queryKey: ["connect", "files", id], queryFn: () => api<ChannelFile[]>(`${B}/channels/${id}/files`), enabled: !!id && enabled });
export const useChannelHistory = (id: string | undefined, enabled: boolean) => useQuery({ queryKey: ["connect", "history", id], queryFn: () => api<HistoryItem[]>(`${B}/channels/${id}/history`), enabled: !!id && enabled });
export const usePeople = (q: string, enabled = true) => useQuery({ queryKey: ["connect", "people", q], queryFn: () => api<Person[]>(`${B}/people${qs({ q })}`), enabled, staleTime: 30_000 });
export const useBrowse = (q: string, enabled: boolean) => useQuery({ queryKey: ["connect", "browse", q], queryFn: () => api<BrowseItem[]>(`${B}/channels/browse${qs({ q })}`), enabled });
export const useSearch = (q: string) => useQuery({ queryKey: ["connect", "search", q], queryFn: () => api<SearchHit[]>(`${B}/search${qs({ q })}`), enabled: q.length >= 2 });

/** Puts one new or changed message into the cached pages without refetching them. */
export function applyMessage(qc: QueryClient, m: ChatMessage) {
  const key = connectKeys.messages(m.channel, m.parent ?? undefined);
  qc.setQueryData<MessagePage>(key, (old) => {
    if (!old) return old;
    const i = old.messages.findIndex((x) => x.id === m.id);
    if (i >= 0) return { ...old, messages: old.messages.map((x) => (x.id === m.id ? m : x)) };
    return { ...old, messages: [...old.messages, m] };
  });
  // A thread's first message is shown in the main list and, as the root, in the thread view.
  qc.setQueryData<MessagePage>(connectKeys.messages(m.channel), (old) => (old ? { ...old, messages: old.messages.map((x) => (x.id === m.id ? m : x)) } : old));
  qc.setQueriesData<MessagePage>({ queryKey: ["connect", "messages", m.channel] }, (old) => (old?.root?.id === m.id ? { ...old, root: m } : old));
}

export interface SendInput {
  body: string;
  parent?: string;
  mentions: string[];
  files: File[];
  voice?: { durationSec: number; peaks: number[] };
}
export function useSendMessage(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SendInput) => {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ body: v.body, parent: v.parent, mentions: v.mentions, voice: v.voice }));
      for (const f of v.files) fd.append("files", f);
      return api<ChatMessage>(`${B}/channels/${channelId}/messages`, { method: "POST", body: fd });
    },
    onSuccess: (m) => {
      applyMessage(qc, m);
      qc.invalidateQueries({ queryKey: connectKeys.channels });
      qc.invalidateQueries({ queryKey: ["connect", "files", channelId] });
    },
  });
}
const patch = (qc: QueryClient, channelId: string) => (m: ChatMessage) => {
  applyMessage(qc, m);
  qc.invalidateQueries({ queryKey: ["connect", "pins", channelId] });
  qc.invalidateQueries({ queryKey: ["connect", "files", channelId] });
};
export function useEditMessage(channelId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; body: string }) => api<ChatMessage>(`${B}/channels/${channelId}/messages/${v.id}`, { method: "PATCH", body: JSON.stringify({ body: v.body }) }), onSuccess: patch(qc, channelId) });
}
export function useDeleteMessage(channelId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api<ChatMessage>(`${B}/channels/${channelId}/messages/${id}`, { method: "DELETE" }), onSuccess: patch(qc, channelId) });
}
export function useReact(channelId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; emoji: string }) => api<ChatMessage>(`${B}/channels/${channelId}/messages/${v.id}/reactions`, { method: "POST", body: JSON.stringify({ emoji: v.emoji }) }), onSuccess: patch(qc, channelId) });
}
export function usePin(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; pin: boolean }) =>
      v.pin ? api<ChannelDetail>(`${B}/channels/${channelId}/pins`, { method: "POST", body: JSON.stringify({ messageId: v.id }) }) : api<ChannelDetail>(`${B}/channels/${channelId}/pins/${v.id}`, { method: "DELETE" }),
    onSuccess: (d) => {
      qc.setQueryData(connectKeys.detail(channelId), d);
      qc.invalidateQueries({ queryKey: ["connect", "messages", channelId] });
      qc.invalidateQueries({ queryKey: ["connect", "pins", channelId] });
      qc.invalidateQueries({ queryKey: ["connect", "history", channelId] });
    },
  });
}
export function useMarkRead(channelId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api(`${B}/channels/${channelId}/read`, { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: connectKeys.channels }) });
}
export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { kind: "TEAM" | "PRIVATE" | "DM"; name?: string; topic?: string; memberIds: string[]; allowedRoles?: string[] }) => api<ChannelDetail>(`${B}/channels`, { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectKeys.channels }),
  });
}
export function useJoinChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ChannelDetail>(`${B}/channels/${id}/join`, { method: "POST" }),
    onSuccess: (d) => {
      qc.setQueryData(connectKeys.detail(d.id), d);
      qc.invalidateQueries({ queryKey: connectKeys.channels });
      qc.invalidateQueries({ queryKey: ["connect", "browse"] });
    },
  });
}
export function useChannelMembers(id: string) {
  const qc = useQueryClient();
  const done = (d: ChannelDetail | { left: true }) => {
    if ("left" in d) qc.invalidateQueries({ queryKey: connectKeys.channels });
    else qc.setQueryData(connectKeys.detail(id), d);
    qc.invalidateQueries({ queryKey: ["connect", "history", id] });
  };
  return {
    add: useMutation({ mutationFn: (userIds: string[]) => api<ChannelDetail>(`${B}/channels/${id}/members`, { method: "POST", body: JSON.stringify({ userIds }) }), onSuccess: done }),
    remove: useMutation({ mutationFn: (userId: string) => api<ChannelDetail | { left: true }>(`${B}/channels/${id}/members/${userId}`, { method: "DELETE" }), onSuccess: done }),
  };
}
export function useUpdateChannel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name?: string; topic?: string; archived?: boolean }) => api<ChannelDetail>(`${B}/channels/${id}`, { method: "PATCH", body: JSON.stringify(v) }),
    onSuccess: (d) => {
      qc.setQueryData(connectKeys.detail(id), d);
      qc.invalidateQueries({ queryKey: connectKeys.channels });
    },
  });
}

/** Opens an attachment in a new tab through a short-lived private link. */
export const attachmentUrl = (channelId: string, fileId: string) => api<{ url: string; name: string; mimeType?: string }>(`${B}/channels/${channelId}/files/${fileId}/url`);

/** Super Admin: delete the chosen messages, or clear the whole conversation. */
export function useClearMessages(channelId: string) {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: ["connect", "messages", channelId] });
    qc.invalidateQueries({ queryKey: ["connect", "pins", channelId] });
    qc.invalidateQueries({ queryKey: ["connect", "files", channelId] });
    qc.invalidateQueries({ queryKey: ["connect", "history", channelId] });
    qc.invalidateQueries({ queryKey: connectKeys.detail(channelId) });
  };
  return {
    deleteMany: useMutation({ mutationFn: (ids: string[]) => api<{ deleted: number }>(`${B}/channels/${channelId}/messages/bulk-delete`, { method: "POST", body: JSON.stringify({ ids }) }), onSuccess: done }),
    clearAll: useMutation({ mutationFn: () => api<{ deleted: number }>(`${B}/channels/${channelId}/messages/clear`, { method: "POST" }), onSuccess: done }),
  };
}
