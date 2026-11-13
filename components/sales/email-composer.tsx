"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Mail, Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { clearStepDraft, useStepDraft } from "@/lib/step-drafts";
import { AttachmentChip } from "./order-comments";

const isEmail = (v: string) => z.email().safeParse(v).success;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export interface ComposerDraft {
  to: string[];
  cc: string[];
  /** Blind copies (only where the composer allows them: `allowBcc`). */
  bcc?: string[];
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
  persistKey,
  sendLabel = "Send Email",
  allowBcc = false,
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
  /** Workflow steps: what is typed is kept while moving to another step and back (until it is sent). */
  persistKey?: string;
  /** Send button text, e.g. "Resend Email" once a Project Code Request Email went. */
  sendLabel?: string;
  /** Compact (Project Code Request Email): Gmail-style Cc / Bcc links that reveal optional rows (the API sends BCC). */
  allowBcc?: boolean;
}) {
  const toast = useToast();
  const id = (k: string) => `${idPrefix}-${k}`;
  const [v, setV] = useStepDraft(persistKey ? `${persistKey}:mail` : null, draft);
  const [notes, setNotes] = useStepDraft(persistKey ? `${persistKey}:notes` : null, "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestKey = useRef(newRequestKey());
  // Typed in To / CC but not yet a chip (Send without pressing Enter still uses it).
  const pending = useRef({ to: "", cc: "", bcc: "" });
  const busy = useRef(false);
  const bccList = v.bcc ?? [];
  // Compact: Cc / Bcc rows open on demand, and open by themselves when they hold addresses (a kept draft).
  const [showCc, setShowCc] = useState(() => v.cc.length > 0);
  const [showBcc, setShowBcc] = useState(() => allowBcc && bccList.length > 0);

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
    const bcc = allowBcc ? withPending(bccList, pending.current.bcc) : [];
    const e: Record<string, string> = {};
    if (!to.length) e.to = "To Email is required";
    else if (to.some((x) => !isEmail(x))) e.to = `Invalid To email address: ${to.find((x) => !isEmail(x))}`;
    if (cc.some((x) => !isEmail(x))) e.cc = `Invalid CC email address: ${cc.find((x) => !isEmail(x))}`;
    if (bcc.some((x) => !isEmail(x))) e.bcc = `Invalid BCC email address: ${bcc.find((x) => !isEmail(x))}`;
    if (!v.subject.trim()) e.subject = "Enter the email subject";
    if (!v.body.replace(/<[^>]+>/g, "").trim()) e.body = "Enter the email content";
    setErrors(e);
    if (Object.keys(e).length) {
      // Say what is wrong and put the cursor there (opening a collapsed Cc / Bcc row); nothing typed is lost.
      if (e.cc) setShowCc(true);
      if (e.bcc) setShowBcc(true);
      toast(e.to ?? e.cc ?? e.bcc ?? e.subject ?? e.body!, "error");
      const at = e.to ? "to" : e.cc ? "cc" : e.bcc ? "bcc" : e.subject ? "subject" : "body";
      setTimeout(() => document.getElementById(id(at))?.focus(), 0);
      return;
    }
    if (to.length !== v.to.length || cc.length !== v.cc.length || bcc.length !== bccList.length) setV({ ...v, to, cc, ...(allowBcc ? { bcc } : {}) });
    const body = notes.trim() ? `${v.body}<p><b>Additional Notes:</b><br>${esc(notes.trim()).replace(/\n/g, "<br>")}</p>` : v.body;
    busy.current = true;
    try {
      const r = await onSend({ to, cc, ...(allowBcc ? { bcc } : {}), subject: v.subject.trim(), body, requestKey: requestKey.current });
      requestKey.current = newRequestKey();
      if (r.status === "SENT") toast(`Email sent to ${r.to.join(", ")}`);
      else if (r.status === "SKIPPED") toast(`Saved in history, but not sent: ${r.error ?? "email is not configured on the server"}.`, "error");
      else toast(`Sending failed: ${r.error ?? "unknown error"}. It is recorded in history.`, "error");
      if (r.status === "SENT") setNotes("");
      // Recorded (sent, or not sent only because the transport is off): the kept draft is no longer needed.
      if (persistKey && r.status !== "FAILED") clearStepDraft(persistKey);
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
        // Request email (Gmail style): To with Cc / Bcc links on its right; each optional row opens on demand and can
        // be folded again (its addresses are kept and still sent; the link shows how many). Subject always last.
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          {(["to", "cc", "bcc"] as const)
            .filter((k) => k === "to" || (k === "cc" ? showCc : allowBcc && showBcc))
            .map((k) => {
              const list = k === "bcc" ? bccList : v[k];
              return (
                <div key={k} className="grid items-start gap-x-3 gap-y-1 px-4 py-2 transition-colors focus-within:bg-brand-soft/20 sm:grid-cols-[64px_1fr_auto]">
                  <label htmlFor={id(k)} className="pt-2.5 text-sm font-semibold text-muted-foreground">
                    {k === "to" ? "To" : k === "cc" ? "Cc" : "Bcc"}
                    {k === "to" && <span className="ml-0.5 text-danger">*</span>}
                  </label>
                  <div className="min-w-0">
                    <TagInput
                      id={id(k)}
                      name={`${idPrefix}-${k}-recipients`}
                      value={list}
                      invalid={!!errors[k]}
                      onDraftChange={(t) => (pending.current[k] = t)}
                      onChange={(next) => setV((p) => ({ ...p, [k]: next }))}
                      placeholder={k === "to" ? "name@company.com (Enter or comma to add more)" : k === "bcc" ? "Hidden from the other recipients" : "Optional"}
                      max={20}
                    />
                    {errors[k] && (
                      <p className="mt-1 text-xs text-danger" role="alert">
                        {errors[k]}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pt-1.5 text-sm">
                    {k === "to" ? (
                      <>
                        {!showCc && (
                          <button type="button" onClick={() => setShowCc(true)} className="rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-ring">
                            Cc{v.cc.length ? ` (${v.cc.length})` : ""}
                          </button>
                        )}
                        {allowBcc && !showBcc && (
                          <button type="button" onClick={() => setShowBcc(true)} className="rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-ring">
                            Bcc{bccList.length ? ` (${bccList.length})` : ""}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => (k === "cc" ? setShowCc(false) : setShowBcc(false))}
                        aria-label={`Hide ${k === "cc" ? "Cc" : "Bcc"} (its addresses are kept)`}
                        title="Hide (addresses are kept)"
                        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          <div className="grid items-start gap-x-3 gap-y-1 px-4 py-2 transition-colors focus-within:bg-brand-soft/20 sm:grid-cols-[64px_1fr]">
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
      <Field
        label="Email Body"
        htmlFor={id("body")}
        required
        error={errors.body}
        className={cn(
          "[&_.ProseMirror]:min-h-56 [&_[contenteditable]]:min-h-56 [&_[contenteditable]]:leading-relaxed",
          // Request email: a white writing canvas, a lighter grouped toolbar, and readable section headings / tables.
          compact &&
            "[&_[contenteditable]]:min-h-72 [&_[contenteditable]]:bg-white [&_[contenteditable]]:px-5 [&_[contenteditable]]:py-4 [&_[role=toolbar]]:gap-1 [&_[role=toolbar]]:bg-surface [&_[role=toolbar]]:px-3 [&_[role=toolbar]]:py-1.5 " +
              "[&_[contenteditable]_h3]:text-sm [&_[contenteditable]_h3]:uppercase [&_[contenteditable]_h3]:tracking-wide [&_[contenteditable]_h3]:text-navy [&_[contenteditable]_th]:bg-muted/50 [&_[contenteditable]_th]:px-3 [&_[contenteditable]_td]:px-3 [&_[contenteditable]_td]:py-2",
        )}
      >
        <RichTextEditor id={id("body")} ariaLabel="Email body" value={v.body} onChange={(body) => setV({ ...v, body })} invalid={!!errors.body} />
      </Field>
      {showNotes && (
        <Field label="Additional Notes" htmlFor={id("notes")} hint="Added below the email content for this send only.">
          <Textarea id={id("notes")} className="min-h-16" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      )}
      <div className={compact ? "rounded-xl border border-border bg-surface p-4 shadow-soft" : "rounded-xl border border-border bg-background p-4"}>
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
      <div
        className={cn(
          "sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 py-3 backdrop-blur",
          compact ? "-mx-1 rounded-b-xl px-3 shadow-[0_-6px_16px_-10px_rgba(16,36,73,0.25)]" : "-mx-1 px-1",
        )}
      >
        <span className="text-xs text-muted-foreground">
          {mailEnabled ? (compact ? "Sent from the company mailbox configured on the server." : `Sends from ${from ?? "the configured mailbox"}`) : "Email is off: the email is recorded, not sent."}
          {compact && blockedReason && <span className="mt-0.5 block font-medium text-danger">{blockedReason}</span>}
        </span>
        <Button variant="brand" className={compact ? "bg-navy hover:bg-navy/90" : undefined} onClick={() => void send()} loading={sending} disabled={!!blockedReason || sending}>
          {sending ? <Mail className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />} {sendLabel}
        </Button>
      </div>
    </div>
  );
}
