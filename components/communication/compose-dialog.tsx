"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { AttachmentInput } from "@/components/communication/attachment-meta";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import type { Attachment } from "@/lib/api/common";
import { useCreateMessage, type Addr, type Message } from "@/lib/api/communications";
import { useAuth } from "@/lib/auth";
import { toDateTimeInput } from "@/lib/format";

export type ComposeMode = "note" | "log" | "reply" | "reply_all" | "forward";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toAddrs = (list: string[]): Addr[] => list.map((email) => ({ email: email.toLowerCase() }));
const baseSubject = (s?: string) => (s ?? "").replace(/^(re|fwd?):\s*/i, "");

const TITLES: Record<ComposeMode, string> = {
  note: "Add note",
  log: "Log received email",
  reply: "Reply",
  reply_all: "Reply all",
  forward: "Forward",
};

export function ComposeDialog({
  mode,
  onClose,
  projectId,
  source,
  onDone,
}: {
  mode: ComposeMode;
  onClose: () => void;
  projectId?: string;
  source?: Message;
  onDone?: (m: Message) => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const create = useCreateMessage();
  const isReply = mode === "reply" || mode === "reply_all";
  const isMail = mode !== "note";

  const initialTo = (() => {
    if (!source) return [];
    if (mode === "reply") return source.from ? [source.from.email] : [];
    if (mode === "reply_all")
      return [...(source.from ? [source.from] : []), ...(source.to ?? [])]
        .map((a) => a.email)
        .filter((e) => e && e !== user?.email?.toLowerCase());
    return [];
  })();
  const initialCc = mode === "reply_all" ? (source?.cc ?? []).map((a) => a.email).filter((e) => e !== user?.email?.toLowerCase()) : [];

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [to, setTo] = useState<string[]>(Array.from(new Set(initialTo)));
  const [cc, setCc] = useState<string[]>(Array.from(new Set(initialCc)));
  const [subject, setSubject] = useState(
    mode === "forward" ? `Fwd: ${baseSubject(source?.subject)}` : isReply ? `Re: ${baseSubject(source?.subject)}` : "",
  );
  const [body, setBody] = useState(
    mode === "forward" && source
      ? `\n\n---------- Forwarded message ----------\nFrom: ${source.from?.name ?? ""} <${source.from?.email ?? ""}>\nSubject: ${source.subject ?? ""}\n\n${source.body}`
      : "",
  );
  const [attachments, setAttachments] = useState<Attachment[]>(mode === "forward" ? (source?.attachments ?? []) : []);
  const [sentAt, setSentAt] = useState(toDateTimeInput());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (mode === "note" && !body.trim()) errs.body = "Note cannot be empty";
    if (mode === "log") {
      if (!fromEmail.trim()) errs.from = "Sender email is required";
      else if (!EMAIL_RE.test(fromEmail.trim())) errs.from = "Invalid email";
    }
    if (isMail && !isReply && !subject.trim()) errs.subject = "Subject is required";
    if (mode === "forward" && to.length === 0) errs.to = "Add at least one recipient";
    if (isReply && to.length === 0) errs.to = "Add at least one recipient";
    if (to.some((x) => !EMAIL_RE.test(x))) errs.to = "One or more recipient emails are invalid";
    if (cc.some((x) => !EMAIL_RE.test(x))) errs.cc = "One or more CC emails are invalid";
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    try {
      const m = await create.mutateAsync(
        mode === "note"
          ? { type: "NOTE", direction: "INTERNAL", projectId, body: body.trim() }
          : mode === "log"
            ? {
                type: "EMAIL",
                direction: "INBOUND",
                projectId,
                from: { name: fromName.trim() || undefined, email: fromEmail.trim().toLowerCase() },
                to: toAddrs(to),
                cc: toAddrs(cc),
                subject: subject.trim(),
                body,
                attachments,
                sentAt: sentAt ? new Date(sentAt).toISOString() : undefined,
              }
            : {
                type: "EMAIL",
                direction: "OUTBOUND",
                mode,
                replyToId: source?._id,
                projectId,
                to: toAddrs(to),
                cc: toAddrs(cc),
                subject: subject.trim() || undefined,
                body,
                attachments,
              },
      );
      toast(isMail && mode !== "log" ? "Logged (email provider not configured) - not sent" : "Saved");
      onDone?.(m);
      onClose();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      if (Object.keys(fe).length) setErrors({ ...fe, from: fe["from"] ?? fe["from.email"] ?? "" });
      else setFormError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={TITLES[mode]}
      description={source && mode !== "log" && mode !== "note" ? `Regarding: ${source.subject ?? "(no subject)"}` : undefined}
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="compose-form" loading={create.isPending}>
            {mode === "note" ? "Save note" : mode === "log" ? "Log email" : `Log ${mode === "forward" ? "forward" : "reply"}`}
          </Button>
        </>
      }
    >
      <form id="compose-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        {(isReply || mode === "forward") && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            Email provider is not configured. This is recorded in the project communication log only and is not actually sent.
          </p>
        )}
        {mode === "log" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From (name)" htmlFor="cm-fromname">
              <Input id="cm-fromname" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </Field>
            <Field label="From (email)" htmlFor="cm-from" required error={errors.from}>
              <Input id="cm-from" type="email" value={fromEmail} aria-invalid={!!errors.from} onChange={(e) => setFromEmail(e.target.value)} />
            </Field>
          </div>
        )}
        {isMail && (
          <>
            <Field label="To" htmlFor="cm-to" error={errors.to} hint="Press Enter or comma after each address." required={mode !== "log"}>
              <TagInput id="cm-to" value={to} onChange={setTo} placeholder="name@company.com" />
            </Field>
            <Field label="CC" htmlFor="cm-cc" error={errors.cc}>
              <TagInput id="cm-cc" value={cc} onChange={setCc} placeholder="name@company.com" />
            </Field>
            <Field label="Subject" htmlFor="cm-subject" required={!isReply} error={errors.subject}>
              <Input id="cm-subject" value={subject} aria-invalid={!!errors.subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          </>
        )}
        <Field label={mode === "note" ? "Note" : "Body"} htmlFor="cm-body" required={mode === "note"} error={errors.body}>
          <Textarea id="cm-body" className="min-h-40" value={body} aria-invalid={!!errors.body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {isMail && (
          <Field label="Attachments" htmlFor="cm-att">
            <AttachmentInput id="cm-att" value={attachments} onChange={setAttachments} />
          </Field>
        )}
        {mode === "log" && (
          <Field label="Received at" htmlFor="cm-sent" error={errors.sentAt}>
            <Input id="cm-sent" type="datetime-local" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
