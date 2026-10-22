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
import { useOrderEmails, useResendEmail, type DeliveryStatus, type SentEmail } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { AttachmentChip } from "./order-comments";

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

/** Sent history for one order and email kind (company profile or rate card). */
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

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sent By</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">{kind === "RATE_CARD" ? "PDF Revision" : "PDF Attachment"}</th>
              <th className="px-4 py-3">Sent Date &amp; Time</th>
              <th className="px-4 py-3">Delivery Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.data.map((e) => (
              <tr key={e._id} className="align-top hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{e.sentBy?.name}</td>
                <td className="px-4 py-3">
                  <span className="block">To: {e.to.join(", ")}</span>
                  {e.cc.length > 0 && <span className="block text-xs text-muted-foreground">CC: {e.cc.join(", ")}</span>}
                  {e.from && <span className="block text-xs text-muted-foreground">From: {e.from}</span>}
                </td>
                <td className="max-w-64 px-4 py-3">
                  <span className="line-clamp-2">{e.subject}</span>
                  {e.resentFrom && <span className="text-xs text-muted-foreground">Resent</span>}
                </td>
                <td className="px-4 py-3">
                  {kind === "RATE_CARD" && e.revisionLabel && <Badge tone="info" className="mb-1">{e.revisionLabel}</Badge>}
                  {e.attachments.map((a) => (
                    <div key={a.fileId}>
                      <AttachmentChip file={a} source={{ orderId }} />
                    </div>
                  ))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(e.sentAt)}</td>
                <td className="px-4 py-3">
                  <DeliveryBadge e={e} />
                  {e.error && <span className="mt-1 block max-w-48 text-xs text-muted-foreground">{e.error}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setView(e)}>
                      <Eye className="size-4" aria-hidden /> View
                    </Button>
                    {allowResend && can("sales:write") && (
                      <Button variant="ghost" size="sm" onClick={() => setAgain(e)}>
                        <RotateCw className="size-4" aria-hidden /> Resend
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
              <dt className="text-muted-foreground">From</dt>
              <dd>{view.from || "-"}</dd>
              <dt className="text-muted-foreground">To</dt>
              <dd>{view.to.join(", ")}</dd>
              <dt className="text-muted-foreground">CC</dt>
              <dd>{view.cc.join(", ") || "-"}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <DeliveryBadge e={view} />
              </dd>
            </dl>
            <div className="rounded-lg border border-border bg-background p-4">
              <RichTextView html={view.body} />
            </div>
            <div className="flex flex-wrap gap-2">
              {view.attachments.map((a) => (
                <AttachmentChip key={a.fileId} file={a} source={{ orderId }} />
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
            toast(r.status === "SENT" ? "Email resent" : r.status === "SKIPPED" ? "Recorded, but not sent: SMTP is not configured" : `Resend failed: ${r.error}`, r.status === "SENT" ? "success" : "error");
            setAgain(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </>
  );
}
