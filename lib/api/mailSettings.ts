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
export const useReplyCheckState = () => useQuery({ queryKey: ["mail-replies", "check-state"], queryFn: () => api<ReplyCheckState>("/mail-replies/status"), refetchInterval: (q) => (q.state.data?.running ? 2000 : 20000), staleTime: 0 });

const KEY = ["mail-routing"];
export const useMailRouting = () => useQuery({ queryKey: KEY, queryFn: () => api<MailRouting[]>("/mail-settings/routing") });
export const useReplyStatus = () => useQuery({ queryKey: ["mail-replies", "status"], queryFn: () => api<ReplyStatus>("/mail-settings/replies/status") });
/** "Get reply": reads the reply mailbox now instead of waiting for the next automatic check (any signed-in user). Every screen showing a reply is refreshed. */
export function useCheckReplies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ReplyCheck>("/mail-replies/check", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useSaveMailRouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...body }: MailRoutingInput & { key: RoutingKey }) => api<MailRouting>(`/mail-settings/routing/${key}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
