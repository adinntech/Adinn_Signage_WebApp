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

const KEY = ["mail-routing"];
export const useMailRouting = () => useQuery({ queryKey: KEY, queryFn: () => api<MailRouting[]>("/mail-settings/routing") });
export const useReplyStatus = () => useQuery({ queryKey: ["mail-replies", "status"], queryFn: () => api<ReplyStatus>("/mail-settings/replies/status") });
/** Reads the reply mailbox now instead of waiting for the next automatic check. */
export function useCheckReplies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ReplyCheck>("/mail-settings/replies/check", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", "codes"] }),
  });
}
export function useSaveMailRouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...body }: MailRoutingInput & { key: RoutingKey }) => api<MailRouting>(`/mail-settings/routing/${key}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
