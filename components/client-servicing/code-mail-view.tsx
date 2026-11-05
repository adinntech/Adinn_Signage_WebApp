"use client";

import { Modal } from "@/components/ui/modal";
import { RichTextView } from "@/components/ui/rich-text-editor";
import type { CodeKind, SentMail } from "@/lib/api/codeRequests";
import { formatBytes, formatDateTime } from "@/lib/format";

/** Documents that normally go with each request. Ticking one in the hub lists it in the email; the GST certificate also attaches the file on record. */
export const REQUIRED_DOCS: Record<CodeKind, string[]> = {
  CLIENT_CODE: ["Client Onboarding Form", "GST Certificate", "Customer Onboarding Form"],
  PROJECT_CODE: ["Approved Quotation", "Project Brief", "Site Photos (if any)"],
};

type MailLike = Pick<SentMail, "to" | "cc" | "status"> & Partial<SentMail>;

/** A sent (or BD-sent) email as it went out, or the note of a request recorded as already sent. */
export function ViewMailModal({ mail, note, onClose }: { mail: MailLike | null; note?: string | null; onClose: () => void }) {
  return (
    <Modal open={!!mail || !!note} onOpenChange={(o) => !o && onClose()} title={mail?.subject ?? "Request recorded"} description={mail?.sentAt ? formatDateTime(mail.sentAt) : undefined}>
      {mail ? (
        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1">
            {mail.from && (
              <>
                <dt className="text-muted-foreground">From</dt>
                <dd>{mail.from}</dd>
              </>
            )}
            <dt className="text-muted-foreground">To</dt>
            <dd>{mail.to.join(", ")}</dd>
            {mail.cc.length > 0 && (
              <>
                <dt className="text-muted-foreground">Cc</dt>
                <dd>{mail.cc.join(", ")}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Status</dt>
            <dd>{mail.status === "SENT" ? "Sent" : mail.status === "SKIPPED" ? "Recorded only (email not configured)" : "Failed"}</dd>
          </dl>
          {mail.body && <RichTextView html={mail.body} className="rounded-lg border border-border bg-background p-3" />}
          {(mail.attachments ?? []).length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {mail.attachments!.map((a, i) => (
                <li key={i}>
                  {a.name} {a.size ? `(${formatBytes(a.size)})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm">{note}</p>
      )}
    </Modal>
  );
}
