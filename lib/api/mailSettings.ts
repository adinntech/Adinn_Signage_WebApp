import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type RoutingKey = "PROJECT_CODE" | "CLIENT_CODE" | "VENDOR_REGISTRATION" | "VENDOR_RATE_APPROVAL";
/** Who one kind of request email goes to (Admin panel > Mail settings). */
export interface MailRouting {
  key: RoutingKey;
  label: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string | null;
  /** Confirm the code on its own when the reply comes from a recipient and holds exactly one valid code. */
  autoConfirm: boolean;
  /** True until an admin saves it: the built-in recipients are in use. */
  isDefault: boolean;
}
export type MailRoutingInput = Pick<MailRouting, "to" | "cc" | "bcc" | "replyTo" | "autoConfirm">;

/** Whether the reply mailbox (IMAP) is set up on the server, and how often it is read. */
export interface ReplyStatus { enabled: boolean; mailbox: string | null; everySeconds: number }
export interface ReplyCheck { checked: number; outcomes: Partial<Record<"unknown" | "rejected" | "saved" | "confirmed" | "duplicate", number>> }

/** When the reply mailbox was last read to the end (the timer or Get reply), and whether a read is running right now. */
export interface ReplyCheckState { lastCheckedAt: string | null; running: boolean }
/** Polled, so the button shows "checking" while the timer reads the mailbox and the last time stays current. */
/** `poll`: keep checking (every 20 s, 2 s while a read runs); false: read once. The query polls while any user of it polls. */
export const useReplyCheckState = (poll = true) =>
  useQuery({ queryKey: ["mail-replies", "check-state"], queryFn: () => api<ReplyCheckState>("/mail-replies/status"), refetchInterval: poll ? (q) => (q.state.data?.running ? 2000 : 20000) : false, staleTime: 0 });

const KEY = ["mail-routing"];
export const useMailRouting = () => useQuery({ queryKey: KEY, queryFn: () => api<MailRouting[]>("/mail-settings/routing") });
export const useReplyStatus = () => useQuery({ queryKey: ["mail-replies", "status"], queryFn: () => api<ReplyStatus>("/mail-settings/replies/status") });
/** "Get reply": reads the reply mailbox now instead of waiting for the next automatic check (any signed-in user). Every screen showing a reply is refreshed. */
export function useCheckReplies() {
  const qc = useQueryClient();
  return useMutation({
    // requestIds: read only the replies to these requests (fast); none: the whole reply mailbox.
    mutationFn: (v?: { requestIds?: string[] }) =>
      api<ReplyCheck>("/mail-replies/check", { method: "POST", ...(v?.requestIds?.length ? { body: JSON.stringify({ requestIds: v.requestIds }) } : {}) }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
/**
 * Automatic Get reply for one screen: reads only these requests' replies every 30 s while `enabled` (paused while the tab
 * is hidden; stops after an error such as no mailbox on the server). The server reuses a read of the same requests from
 * the last 20 s, so several open screens do not load the mailbox.
 */
export const useAutoReplyCheck = (requestIds: string[] | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["mail-replies", "auto", ...(requestIds ?? [])],
    queryFn: () => api<ReplyCheck>("/mail-replies/check", { method: "POST", body: JSON.stringify({ requestIds, auto: true }) }),
    enabled: enabled && !!requestIds?.length,
    refetchInterval: (q) => (q.state.status === "error" ? false : 30000),
    retry: false,
    staleTime: 0,
  });
export function useSaveMailRouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...body }: MailRoutingInput & { key: RoutingKey }) => api<MailRouting>(`/mail-settings/routing/${key}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
