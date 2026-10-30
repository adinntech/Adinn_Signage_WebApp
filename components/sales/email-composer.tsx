"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Mail, Paperclip, Send } from "lucide-react";
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
  compact = false,
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
  /** Project Code Request Email: no From field (the server's configured sender), To / CC as compact rows. */
  compact?: boolean;
}) {
  const toast = useToast();
  const id = (k: string) => `${idPrefix}-${k}`;
  const [v, setV] = useState(draft);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestKey = useRef(newRequestKey());
  // Typed in To / CC but not yet a chip (Send without pressing Enter still uses it).
  const pending = useRef({ to: "", cc: "" });
  const busy = useRef(false);

  /** Chips + the text still being typed (comma separated), without duplicates. */
  const withPending = (list: string[], typed: string) => {
    const out = [...list];
    for (const p of typed.split(",").map((s) => s.trim()).filter(Boolean)) if (!out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p);
    return out;
  };

  const send = async () => {
    if (busy.current || sending) return; // one submission at a time
    const to = withPending(v.to, pending.current.to);
    const cc = withPending(v.cc, pending.current.cc);
    const e: Record<string, string> = {};
    if (!to.length) e.to = "To Email is required";
    else if (to.some((x) => !isEmail(x))) e.to = `Invalid To email address: ${to.find((x) => !isEmail(x))}`;
    if (cc.some((x) => !isEmail(x))) e.cc = `Invalid CC email address: ${cc.find((x) => !isEmail(x))}`;
    if (!v.subject.trim()) e.subject = "Enter the email subject";
    if (!v.body.replace(/<[^>]+>/g, "").trim()) e.body = "Enter the email content";
    setErrors(e);
    if (Object.keys(e).length) {
      // Say what is wrong and put the cursor there; nothing is sent and nothing typed is lost.
      toast(e.to ?? e.cc ?? e.subject ?? e.body!, "error");
      document.getElementById(id(e.to ? "to" : e.cc ? "cc" : e.subject ? "subject" : "body"))?.focus();
      return;
    }
    if (to.length !== v.to.length || cc.length !== v.cc.length) setV({ ...v, to, cc });
    const body = notes.trim() ? `${v.body}<p><b>Additional Notes:</b><br>${esc(notes.trim()).replace(/\n/g, "<br>")}</p>` : v.body;
    busy.current = true;
    try {
      const r = await onSend({ to, cc, subject: v.subject.trim(), body, requestKey: requestKey.current });
      requestKey.current = newRequestKey();
      if (r.status === "SENT") toast(`Email sent to ${r.to.join(", ")}`);
      else if (r.status === "SKIPPED") toast(`Saved in history, but not sent: ${r.error ?? "email is not configured on the server"}.`, "error");
      else toast(`Sending failed: ${r.error ?? "unknown error"}. It is recorded in history.`, "error");
      if (r.status === "SENT") setNotes("");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="space-y-4">
      {!mailEnabled && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {notConfigured}
        </p>
      )}
      {compact ? (
        // Request email: one white card with compact To / CC rows and a full-width Subject (sender set by the server).
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {(["to", "cc"] as const).map((k) => (
            <div key={k} className="grid items-start gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[72px_1fr]">
              <label htmlFor={id(k)} className="pt-2.5 text-sm font-semibold text-muted-foreground">
                {k === "to" ? "To" : "CC"}
                {k === "to" && <span className="ml-0.5 text-danger">*</span>}
              </label>
              <div>
                <TagInput
                  id={id(k)}
                  value={v[k]}
                  invalid={!!errors[k]}
                  onDraftChange={(t) => (pending.current[k] = t)}
                  onChange={(list) => setV((p) => ({ ...p, [k]: list }))}
                  placeholder={k === "to" ? "name@company.com (Enter or comma to add more)" : "Optional"}
                  max={20}
                />
                {errors[k] && <p className="mt-1 text-xs text-danger" role="alert">{errors[k]}</p>}
              </div>
            </div>
          ))}
          <div className="grid items-start gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[72px_1fr]">
            <label htmlFor={id("subject")} className="pt-2.5 text-sm font-semibold text-muted-foreground">
              Subject<span className="ml-0.5 text-danger">*</span>
            </label>
            <div>
              <Input id={id("subject")} value={v.subject} maxLength={250} aria-invalid={!!errors.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />
              {errors.subject && <p className="mt-1 text-xs text-danger" role="alert">{errors.subject}</p>}
            </div>
          </div>
        </div>
      ) : (
      <div className="grid items-start gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="From Email" htmlFor={id("from")} hint="Auto display">
          <Input id={id("from")} value={from ?? "Not configured"} readOnly disabled />
        </Field>
        <Field label="To Email" htmlFor={id("to")} required error={errors.to}>
          <TagInput id={id("to")} value={v.to} invalid={!!errors.to} onDraftChange={(t) => (pending.current.to = t)} onChange={(to) => setV((p) => ({ ...p, to }))} placeholder="Type an email and press Enter" max={20} />
        </Field>
        <Field label="CC Email" htmlFor={id("cc")} error={errors.cc} className="md:col-span-2">
          <TagInput id={id("cc")} value={v.cc} invalid={!!errors.cc} onDraftChange={(t) => (pending.current.cc = t)} onChange={(cc) => setV((p) => ({ ...p, cc }))} placeholder="Optional" max={20} />
        </Field>
        <Field label="Subject" htmlFor={id("subject")} required error={errors.subject} className="md:col-span-2">
          <Input id={id("subject")} value={v.subject} maxLength={250} aria-invalid={!!errors.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />
        </Field>
      </div>
      )}
      <Field label="Email Body" htmlFor={id("body")} required error={errors.body} className="[&_.ProseMirror]:min-h-56 [&_[contenteditable]]:min-h-56 [&_[contenteditable]]:leading-relaxed">
        <RichTextEditor id={id("body")} ariaLabel="Email body" value={v.body} onChange={(body) => setV({ ...v, body })} invalid={!!errors.body} />
      </Field>
      {showNotes && (
        <Field label="Additional Notes" htmlFor={id("notes")} hint="Added below the email content for this send only.">
          <Textarea id={id("notes")} className="min-h-16" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      )}
      <div className={compact ? "rounded-xl border border-border bg-surface p-4" : "rounded-xl border border-border bg-background p-4"}>
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Paperclip className="size-4 text-muted-foreground" aria-hidden /> {attachmentLabel}
        </p>
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
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
        <span className="text-xs text-muted-foreground">{mailEnabled ? (compact ? "Sent from the company mailbox configured on the server." : `Sends from ${from ?? "the configured mailbox"}`) : "Email is off: the email is recorded, not sent."}</span>
        <Button variant="brand" onClick={() => void send()} loading={sending} disabled={!!blockedReason || sending}>
          {sending ? <Mail className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />} Send Email
        </Button>
      </div>
    </div>
  );
}
