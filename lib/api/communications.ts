import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api";
import { qs, type Attachment } from "./common";
import type { Priority } from "./projects";

export type MessageType = "EMAIL" | "NOTE" | "SYSTEM" | "WHATSAPP_REF" | "FILE" | "APPROVAL";
export interface Addr {
  name?: string;
  email: string;
}
export interface Message {
  _id: string;
  threadId: string;
  parent?: string;
  project?: { _id: string; code: string; name: string } | null;
  type: MessageType;
  direction: "INBOUND" | "OUTBOUND" | "INTERNAL";
  deliveryStatus?: "RECEIVED" | "LOGGED" | "SENT" | "FAILED";
  from?: Addr;
  to?: Addr[];
  cc?: Addr[];
  subject?: string;
  body: string;
  attachments?: Attachment[];
  sentAt: string;
  actioned: boolean;
  actionNote?: string;
  approval?: {
    status: "PENDING" | "APPROVED" | "REJECTED";
    requestedTo: ({ _id: string; name?: string; role?: string } | string)[];
    decidedBy?: string;
    decidedAt?: string;
    comment?: string;
  };
  createdBy?: { _id?: string; name: string; role: string } | null;
}

export interface MessageListParams {
  page?: number;
  limit?: number;
  q?: string;
  projectId?: string;
  unlinked?: boolean;
  type?: string;
  actioned?: boolean;
  threadId?: string;
  sort?: string;
}

const listPath = (p: MessageListParams) => `/communications/messages${qs(p)}`;

export function useMessages(params: MessageListParams, enabled = true) {
  return useQuery({
    queryKey: ["communications", "messages", params],
    queryFn: () => apiPage<Message>(listPath(params)),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** "Load more" pagination for the project timeline / mail. */
export function useMessagesInfinite(params: Omit<MessageListParams, "page">, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communications", "infinite", params],
    queryFn: ({ pageParam }) => apiPage<Message>(listPath({ ...params, page: pageParam })),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled,
  });
}

export interface MessageInput {
  type: "EMAIL" | "NOTE" | "WHATSAPP_REF" | "FILE";
  direction?: "INBOUND" | "OUTBOUND" | "INTERNAL";
  projectId?: string;
  mode?: "reply" | "reply_all" | "forward";
  replyToId?: string;
  from?: Addr;
  to?: Addr[];
  cc?: Addr[];
  subject?: string;
  body: string;
  attachments?: Attachment[];
  sentAt?: string;
}

function useCommMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communications"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export const useCreateMessage = () =>
  useCommMutation((body: MessageInput) =>
    api<Message>("/communications/messages", { method: "POST", body: JSON.stringify(body) }),
  );

export const useSetActioned = () =>
  useCommMutation(({ id, ...body }: { id: string; actioned: boolean; note?: string }) =>
    api<Message>(`/communications/messages/${id}/actioned`, { method: "PATCH", body: JSON.stringify(body) }),
  );

export const useRequestApproval = () =>
  useCommMutation(({ id, ...body }: { id: string; to: string[]; comment?: string }) =>
    api<Message>(`/communications/messages/${id}/request-approval`, { method: "POST", body: JSON.stringify(body) }),
  );

export const useDecideApproval = () =>
  useCommMutation(({ id, ...body }: { id: string; status: "APPROVED" | "REJECTED"; comment?: string }) =>
    api<Message>(`/communications/messages/${id}/approval`, { method: "PATCH", body: JSON.stringify(body) }),
  );

export interface CreateProjectFromMailInput {
  id: string;
  clientId: string;
  campaign: string;
  priority: Priority;
  targetDate?: string;
  expectedSites?: number;
  coordinatorId?: string;
}
export const useCreateProjectFromMail = () =>
  useCommMutation(({ id, ...body }: CreateProjectFromMailInput) =>
    api<{ _id: string; code: string }>(`/communications/messages/${id}/create-project`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

// ---- channels ----
export type ChannelKind = "WITH_CLIENT" | "INTERNAL";
export interface Participant {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  userId?: string;
  user?: string;
  included: boolean;
}
export interface Channel {
  _id?: string;
  kind: ChannelKind;
  groupName?: string;
  participants: Participant[];
  status: "NOT_CREATED" | "LINKED";
  externalGroupId?: string;
  externalGroupUrl?: string;
}
export interface ChannelInput {
  groupName?: string;
  participants: Participant[];
  externalGroupId?: string;
  externalGroupUrl?: string;
}

export function useChannels(projectId: string) {
  return useQuery({
    queryKey: ["communications", "channels", projectId],
    queryFn: () => api<Channel[]>(`/communications/projects/${projectId}/channels`),
    enabled: !!projectId,
  });
}

export function useSaveChannel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, body }: { kind: ChannelKind; body: ChannelInput }) =>
      api<Channel>(`/communications/projects/${projectId}/channels/${kind}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communications"] }),
  });
}

export function fetchIntro(projectId: string, kind: ChannelKind) {
  return api<{ text: string; phones: string[] }>(`/communications/projects/${projectId}/channels/${kind}/intro`);
}
