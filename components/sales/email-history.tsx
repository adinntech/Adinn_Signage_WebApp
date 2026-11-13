"use client";

import { useState } from "react";
import { Eye, Inbox, RotateCw } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { RichTextView } from "@/components/ui/rich-text-editor";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useOrderEmails, useResendEmail, type DeliveryStatus, type SentAttachmentCategory, type SentEmail } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { AttachmentChip } from "./order-comments";

/** Project code request: what each sent file was (from the order's records, by file id). */
export const ATTACHMENT_CATEGORY: Record<SentAttachmentCategory, string> = {
  RATE_CARD: "Rate Card PDF",
  SHOP_LIST: "Shop List Excel",
  SO_DOCUMENT: "SO document",
  COMMUNICATION: "Handover communication file",
  GST_CERTIFICATE: "GST certificate",
  ADDED: "Added to this email",
};

const STATUS: Record<DeliveryStatus, { tone: Tone; label: string }> = {
  SENT: { tone: "success", label: "Sent" },
  FAILED: { tone: "danger", label: "Failed" },
  SKIPPED: { tone: "warning", label: "Not sent" },
};

export function DeliveryBadge({ e }: { e: Pick<SentEmail, "status" | "error"> }) {
  const s = STATUS[e.status];
  return (
    <Badge tone={s.tone} title={e.error}>
      {s.label}
    </Badge>
  );
}

/**
 * Project Code Request Email type, numbered in send order (oldest first) whatever order the table shows: the first
 * successfully sent email is the Initial Send, later successful ones Resend 1, 2, …. Failed / not-sent attempts keep
 * their delivery status and are not counted ("… attempt"). `sent`: successful emails; `lastSentAt`: the latest one.
 */
export function emailTypes(emails: SentEmail[]) {
  const asc = [...emails].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime() || (a._id > b._id ? 1 : -1));
  const labels = new Map<string, string>();
  let sent = 0;
  let lastSentAt: string | null = null;
  for (const e of asc) {
    if (e.status === "SENT") {
      labels.set(e._id, sent === 0 ? "Initial Send" : `Resend ${sent}`);
      sent++;
      lastSentAt = e.sentAt;
    } else labels.set(e._id, sent === 0 ? "Initial Send attempt" : "Resend attempt");
  }
  return { labels, sent, lastSentAt };
}

function EmailTypeBadge({ label }: { label?: string }) {
  if (!label) return null;
  return <Badge tone={label === "Initial Send" ? "info" : label.endsWith("attempt") ? "neutral" : "primary"}>{label}</Badge>;
}

/** Sent history for one order and email kind (company profile, rate card or customer onboarding form). */
export function EmailHistory({ orderId, kind, allowResend = true }: { orderId: string; kind: SentEmail["kind"]; allowResend?: boolean }) {
  const { can } = useAuth();
  const toast = useToast();
  const q = useOrderEmails(orderId, kind);
  const resend = useResendEmail(orderId);
  const [view, setView] = useState<SentEmail | null>(null);
  const [again, setAgain] = useState<SentEmail | null>(null);

  if (q.isPending) return <RowsSkeleton rows={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data.length) return <EmptyState icon={Inbox} title="No emails sent yet" description="Every send is recorded here with its exact content and attachment." />;
  // Project Code Request Email: Initial Send / Resend n (Delivery Status stays its own column).
  const types = kind === "PROJECT_CODE_REQUEST" ? emailTypes(q.data).labels : null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              {types && <th className="px-4 py-3">Email Type</th>}
              <th className="px-4 py-3">Sent By</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">{kind === "RATE_CARD" ? "PDF Revision" : kind === "PROJECT_CODE_REQUEST" ? "Attachments" : "PDF Attachment"}</th>
              <th className="px-4 py-3">Sent Date &amp; Time</th>
              <th className="px-4 py-3">Delivery Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.data.map((e) => (
              <tr key={e._id} className="align-top hover:bg-muted/40">
                {types && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <EmailTypeBadge label={types.get(e._id)} />
                  </td>
                )}
                <td className="px-4 py-3 font-medium">{e.sentBy?.name}</td>
                <td className="px-4 py-3">
                  <span className="block">To: {e.to.join(", ")}</span>
                  {e.cc.length > 0 && <span className="block text-xs text-muted-foreground">CC: {e.cc.join(", ")}</span>}
                  {e.from && <span className="block text-xs text-muted-foreground">From: {e.from}</span>}
                </td>
                <td className="max-w-48 px-4 py-3">
                  <span className="line-clamp-2">{e.subject}</span>
                  {/* Project code request (signage email API): its request reference. */}
                  {e.requestId && <span className="block font-mono text-xs text-muted-foreground">{e.requestId}</span>}
                  {e.resentFrom && <span className="text-xs text-muted-foreground">Resent</span>}
                </td>
                <td className="max-w-56 px-4 py-3">
                  {(kind === "RATE_CARD" || kind === "PROJECT_CODE_REQUEST") && e.revisionLabel && (
                    <Badge tone="info" className="mb-1">
                      {kind === "RATE_CARD" ? e.revisionLabel : `Rate Card ${e.revisionLabel}`}
                    </Badge>
                  )}
                  {kind === "PROJECT_CODE_REQUEST" && e.attachments.length > 0 && (
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                      {e.attachments.length} file{e.attachments.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {e.attachments.map((a) => (
                    <div key={a.fileId} className="mb-1">
                      <AttachmentChip file={a} source={{ orderId }} />
                      {e.attachmentInfo?.[a.fileId] && <span className="block pl-1 text-[11px] text-muted-foreground">{ATTACHMENT_CATEGORY[e.attachmentInfo[a.fileId]!.category]}</span>}
                    </div>
                  ))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(e.sentAt)}</td>
                <td className="px-4 py-3">
                  <DeliveryBadge e={e} />
                  {e.error && <span className="mt-1 line-clamp-3 max-w-40 text-xs text-muted-foreground" title={e.error}>{e.error}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label="View email" title="View" onClick={() => setView(e)}>
                      <Eye className="size-4" aria-hidden /> <span className="hidden 2xl:inline">View</span>
                    </Button>
                    {allowResend && can("sales:write") && (
                      <Button variant="ghost" size="sm" aria-label="Resend email" title="Resend" onClick={() => setAgain(e)}>
                        <RotateCw className="size-4" aria-hidden /> <span className="hidden 2xl:inline">Resend</span>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!view} onOpenChange={(o) => !o && setView(null)} title={view?.subject ?? "Email"} description={view ? `Sent ${formatDateTime(view.sentAt)} by ${view.sentBy?.name}` : undefined} className="max-w-2xl">
        {view && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5">
              {types && (
                <>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>
                    <EmailTypeBadge label={types.get(view._id)} />
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">From</dt>
              <dd>{view.from || "-"}</dd>
              <dt className="text-muted-foreground">To</dt>
              <dd>{view.to.join(", ")}</dd>
              <dt className="text-muted-foreground">CC</dt>
              <dd>{view.cc.join(", ") || "-"}</dd>
              {!!view.bcc?.length && (
                <>
                  <dt className="text-muted-foreground">BCC</dt>
                  <dd>{view.bcc.join(", ")}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <DeliveryBadge e={view} />
              </dd>
            </dl>
            <div className="rounded-lg border border-border bg-background p-4">
              <RichTextView html={view.body} />
            </div>
            {view.attachments.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments ({view.attachments.length})</p>
            )}
            <div className="flex flex-wrap gap-2">
              {view.attachments.map((a) => (
                <span key={a.fileId} className="inline-flex flex-col">
                  <AttachmentChip file={a} source={{ orderId }} />
                  {view.attachmentInfo?.[a.fileId] && <span className="pl-1 text-[11px] text-muted-foreground">{ATTACHMENT_CATEGORY[view.attachmentInfo[a.fileId]!.category]}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!again}
        onOpenChange={(o) => !o && setAgain(null)}
        title="Resend this email?"
        description={again ? `The same subject, content and ${again.revisionLabel ? `PDF revision ${again.revisionLabel}` : "attachment"} will be sent again to ${again.to.join(", ")}.` : undefined}
        confirmLabel="Resend"
        loading={resend.isPending}
        onConfirm={async () => {
          if (!again) return;
          try {
            const r = await resend.mutateAsync(again._id);
            toast(r.status === "SENT" ? "Email resent" : r.status === "SKIPPED" ? `Recorded, but not sent: ${r.error ?? "email is not configured"}` : `Resend failed: ${r.error}`, r.status === "SENT" ? "success" : "error");
            setAgain(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </>
  );
}
