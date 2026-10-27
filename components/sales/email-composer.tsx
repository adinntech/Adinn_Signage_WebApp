"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Mail, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import type { FileRef } from "@/lib/api/files";
import { newRequestKey, type EmailInput, type SentEmail } from "@/lib/api/sales";
import { AttachmentChip } from "./order-comments";

const isEmail = (v: string) => z.email().safeParse(v).success;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export interface ComposerDraft {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

/**
 * The one email composer used by every stage: From (display only), To, CC, Subject, rich body, optional notes and
 * the attachment the server will add. Nothing is sent until Send Email is clicked. Give it a `key` that changes
 * when a new draft is loaded.
 */
export function EmailComposer({
  idPrefix,
  orderId,
  from,
  mailEnabled,
  draft,
  attachments,
  attachmentLabel,
  blockedReason,
  showNotes,
  onSend,
  sending,
  notConfigured = "Email delivery is not configured on the server (SMTP). Sending will be recorded as \"Not sent\" until it is set up.",
  attachmentArea,
}: {
  idPrefix: string;
  orderId: string;
  from: string | null;
  mailEnabled: boolean;
  draft: ComposerDraft;
  attachments: FileRef[];
  attachmentLabel: string;
  blockedReason?: string | null;
  showNotes?: boolean;
  onSend: (v: EmailInput) => Promise<SentEmail>;
  sending: boolean;
  /** Warning shown while the mail transport for this email is not configured. */
  notConfigured?: string;
  /** Replaces the fixed attachment box, e.g. a file picker for files the person attaches themselves. */
  attachmentArea?: React.ReactNode;
}) {
  const toast = useToast();
  const [v, setV] = useState(draft);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestKey = useRef(newRequestKey());


  const send = async () => {
    const e: Record<string, string> = {};
    if (!v.to.length) e.to = "Enter at least one recipient";
    else if (v.to.some((x) => !isEmail(x))) e.to = `Invalid email: ${v.to.find((x) => !isEmail(x))}`;
    if (v.cc.some((x) => !isEmail(x))) e.cc = `Invalid email: ${v.cc.find((x) => !isEmail(x))}`;
    if (!v.subject.trim()) e.subject = "Enter the email subject";
    if (!v.body.replace(/<[^>]+>/g, "").trim()) e.body = "Enter the email content";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = notes.trim() ? `${v.body}<p><b>Additional Notes:</b><br>${esc(notes.trim()).replace(/\n/g, "<br>")}</p>` : v.body;
    try {
      const r = await onSend({ to: v.to, cc: v.cc, subject: v.subject.trim(), body, requestKey: requestKey.current });
      requestKey.current = newRequestKey();
      if (r.status === "SENT") toast(`Email sent to ${r.to.join(", ")}`);
      else if (r.status === "SKIPPED") toast(`Saved in history, but not sent: ${r.error ?? "email is not configured on the server"}.`, "error");
      else toast(`Sending failed: ${r.error ?? "unknown error"}. It is recorded in history.`, "error");
      if (r.status === "SENT") setNotes("");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="space-y-4">
      {!mailEnabled && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {notConfigured}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="From Email" htmlFor={id("from")} hint="Auto display">
          <Input id={id("from")} value={from ?? "Not configured"} readOnly disabled />
        </Field>
        <Field label="To Email" htmlFor={id("to")} required error={errors.to}>
          <TagInput id={id("to")} value={v.to} onChange={(to) => setV({ ...v, to })} placeholder="Type an email and press Enter" max={20} />
        </Field>
        <Field label="CC Email" htmlFor={id("cc")} error={errors.cc} className="md:col-span-2">
          <TagInput id={id("cc")} value={v.cc} onChange={(cc) => setV({ ...v, cc })} placeholder="Optional" max={20} />
        </Field>
        <Field label="Subject" htmlFor={id("subject")} required error={errors.subject} className="md:col-span-2">
          <Input id={id("subject")} value={v.subject} maxLength={250} aria-invalid={!!errors.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />
        </Field>
      </div>
      <Field label="Email Body" htmlFor={id("body")} required error={errors.body}>
        <RichTextEditor id={id("body")} ariaLabel="Email body" value={v.body} onChange={(body) => setV({ ...v, body })} invalid={!!errors.body} />
      </Field>
      {showNotes && (
        <Field label="Additional Notes" htmlFor={id("notes")} hint="Added below the email content for this send only.">
          <Textarea id={id("notes")} className="min-h-16" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      )}
      <div className="rounded-lg border border-border bg-background p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{attachmentLabel}</p>
        {attachmentArea ??
          (attachments.length ? (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <AttachmentChip key={a.fileId} file={a} source={{ orderId }} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-danger">{blockedReason ?? "No attachment available"}</p>
          ))}
      </div>
      <div className="flex justify-end">
        <Button variant="brand" onClick={send} loading={sending} disabled={!!blockedReason}>
          {sending ? <Mail className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />} Send Email
        </Button>
      </div>
    </div>
  );
}
