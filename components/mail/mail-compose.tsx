"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, Mail, Maximize2, Minimize2, Minus, Save, Send } from "lucide-react";
import { AdinnLogo } from "@/components/shell/adinn-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichTextEditor, RichTextView } from "@/components/ui/rich-text-editor";
import { Select } from "@/components/ui/select";
import { EmailTagInput } from "@/components/mail/email-tag-input";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface MailValues {
  to: string[];
  cc: string[];
  bcc: string[];
  from?: string;
  subject: string;
  body: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** One row of the mail header, Gmail style: a plain label, the field, an optional action at the right corner and a divider. */
function Row({ label, required, error, htmlFor, children, aside }: { label?: string; required?: boolean; error?: string; htmlFor: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-1">
      <div className="flex items-start gap-3">
        {label && (
          <label htmlFor={htmlFor} className="w-14 shrink-0 pt-2.5 text-sm text-muted-foreground">
            {label}
            {required && <span className="ml-0.5 text-danger">*</span>}
          </label>
        )}
        <div className="min-w-0 flex-1">{children}</div>
        {aside}
      </div>
      {error && (
        <p role="alert" className={cn("pb-1 text-xs text-danger", label && "ml-[4.25rem]")}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The one mail writing form (used by the code requests and the vendor registration): From, To / Cc / Bcc chips, subject,
 * rich message with a Variables menu, an attachments panel next to it, Preview, Save as Draft and Send. The draft is
 * autosaved a moment after the last change. Give it a `key` that changes when a different template or recipient group is loaded.
 */
export function MailCompose({
  initial,
  identities,
  mailEnabled,
  variables,
  attachments,
  footerNote,
  busy,
  blockedReason,
  sendLabel = "Send Mail",
  wideAside,
  onSend,
  onSaveDraft,
}: {
  initial: MailValues;
  identities: string[];
  mailEnabled: boolean;
  /** Label + value pairs the Variables menu inserts into the message. */
  variables: [string, string | null][];
  attachments: React.ReactNode;
  footerNote: string;
  busy: boolean;
  /** Sending is disabled (with this reason shown) while it is set. */
  blockedReason?: string | null;
  sendLabel?: string;
  /** A wider attachments column (for a panel with document slots). */
  wideAside?: boolean;
  onSend: (m: MailValues) => Promise<void>;
  onSaveDraft: (m: MailValues) => Promise<void>;
}) {
  const toast = useToast();
  const [v, setV] = useState<MailValues>(initial);
  const [from, setFrom] = useState(identities[0] ?? "");
  const [showCc, setShowCc] = useState(v.cc.length > 0);
  const [showBcc, setShowBcc] = useState(v.bcc.length > 0);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [auto, setAuto] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const dirty = useRef(false);
  const save = useRef(onSaveDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vars, setVars] = useState(false);

  const insertVar = (label: string, value: string | null) => {
    setVars(false);
    setV((x) => ({ ...x, body: `${x.body}<p><strong>${esc(label)}:</strong> ${esc(value ?? "-")}</p>` }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    for (const f of ["to", "cc", "bcc"] as const) {
      const bad = v[f].find((x) => !EMAIL_RE.test(x));
      if (bad) e[f] = `Invalid email: ${bad}`;
    }
    if (!v.to.length) e.to = "Enter at least one recipient";
    if (!v.subject.trim()) e.subject = "Enter the email subject";
    if (!v.body.replace(/<[^>]+>/g, "").trim()) e.body = "Enter the email content";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const values = (): MailValues => ({ ...v, subject: v.subject.trim(), ...(identities.length > 1 && from ? { from } : {}) });

  useEffect(() => {
    save.current = onSaveDraft;
  });
  const idCount = identities.length;

  // Autosave: the draft is kept a moment after the last change (not for the untouched form).
  useEffect(() => {
    if (!dirty.current) {
      dirty.current = true;
      return;
    }
    setAuto("saving");
    const t = setTimeout(() => {
      save.current({ ...v, subject: v.subject.trim(), ...(idCount > 1 && from ? { from } : {}) }).then(
        () => setAuto("saved"),
        () => setAuto("failed"),
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [v, from, idCount]);

  const status = auto === "saving" ? "Saving draft..." : auto === "saved" ? "Draft saved" : auto === "failed" ? "Draft not saved" : "";
  return (
    <>
      {expanded && <div className="fixed inset-0 z-40 bg-black/40" aria-hidden onClick={() => setExpanded(false)} />}
      <div className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-soft", expanded && "fixed inset-4 z-50 overflow-auto shadow-card md:inset-x-[8%] md:inset-y-6")}>
        <div className="flex items-center gap-2 bg-muted px-4 py-2.5">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{v.subject.trim() || "New Message"}</h3>
          {status && <span className={cn("text-xs", auto === "failed" ? "text-danger" : "text-muted-foreground")}>{status}</span>}
          <button type="button" aria-label={minimized ? "Restore" : "Minimize"} title={minimized ? "Restore" : "Minimize"} onClick={() => setMinimized(!minimized)} className="rounded-md p-1 text-muted-foreground hover:bg-surface">
            <Minus className="size-4" aria-hidden />
          </button>
          <button type="button" aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"} onClick={() => (setExpanded(!expanded), setMinimized(false))} className="rounded-md p-1 text-muted-foreground hover:bg-surface">
            {expanded ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
          </button>
        </div>
        <div className={cn("space-y-3 pb-4", minimized && "hidden")}>
          {!mailEnabled && (
            <p className="mx-4 mt-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">Email is not configured on the server. Sending will be recorded as &quot;Not sent&quot; until SMTP is set up.</p>
          )}
          <div>
            {identities.length > 1 && (
              <Row label="From" htmlFor="cm-from">
                <Select id="cm-from" value={from} onChange={(e) => setFrom(e.target.value)} className="bare-field border-0 shadow-none">
                  {identities.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Row>
            )}
            <Row
              label="To"
              required
              htmlFor="cm-to"
              error={errors.to}
              aside={
                (!showCc || !showBcc) && (
                  <span className="flex gap-2 pt-2.5 text-sm text-muted-foreground">
                    {!showCc && (
                      <button type="button" className="hover:text-foreground hover:underline" onClick={() => setShowCc(true)}>
                        Cc
                      </button>
                    )}
                    {!showBcc && (
                      <button type="button" className="hover:text-foreground hover:underline" onClick={() => setShowBcc(true)}>
                        Bcc
                      </button>
                    )}
                  </span>
                )
              }
            >
              <EmailTagInput id="cm-to" value={v.to} onChange={(to) => setV({ ...v, to })} placeholder="Type an email and press Enter" max={20} />
            </Row>
            {showCc && (
              <Row label="Cc" htmlFor="cm-cc" error={errors.cc}>
                <EmailTagInput id="cm-cc" value={v.cc} onChange={(cc) => setV({ ...v, cc })} placeholder="Optional" max={20} />
              </Row>
            )}
            {showBcc && (
              <Row label="Bcc" htmlFor="cm-bcc" error={errors.bcc}>
                <EmailTagInput id="cm-bcc" value={v.bcc} onChange={(bcc) => setV({ ...v, bcc })} placeholder="Hidden from the other recipients" max={20} />
              </Row>
            )}
            <Row label="Subject" required htmlFor="cm-subject" error={errors.subject}>
              <Input id="cm-subject" placeholder="Email subject" value={v.subject} maxLength={250} aria-invalid={!!errors.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} className="bare-field border-0 px-0 shadow-none" />
            </Row>
          </div>
          <div className="space-y-3 px-4">
            <div className={cn("grid gap-4", wideAside ? "lg:grid-cols-[1fr_25rem]" : "lg:grid-cols-[1fr_19rem]")}>
              <div className="min-w-0 space-y-2">
                <div className="flex items-center justify-end">
                  <span className="relative">
                    <Button size="sm" variant="outline" aria-expanded={vars} onClick={() => setVars(!vars)}>
                      Variables <ChevronDown className="size-4" aria-hidden />
                    </Button>
                    {vars && (
                      <ul role="menu" className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-card">
                        {variables.map(([label, value]) => (
                          <li key={label} role="none">
                            <button role="menuitem" type="button" onClick={() => insertVar(label, value)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-muted">
                              <span className="font-medium">{label}</span>
                              <span className="max-w-28 truncate text-xs text-muted-foreground">{value ?? "-"}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </span>
                </div>
                <RichTextEditor id="cm-body" ariaLabel="Email body" value={v.body} onChange={(body) => setV({ ...v, body })} invalid={!!errors.body} minHeight={260} />
                {errors.body && (
                  <p role="alert" className="text-xs text-danger">
                    {errors.body}
                  </p>
                )}
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
                  <AdinnLogo className="h-10 w-28 shadow-none ring-1 ring-border" />
                  <p className="text-xs text-muted-foreground">{footerNote}</p>
                </div>
              </div>
              {attachments}
            </div>

            {blockedReason && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{blockedReason}</p>}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPreviewing(true)}>
                <Eye className="size-4" aria-hidden /> Preview
              </Button>
              <Button
                variant="outline"
                loading={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSaveDraft(values());
                    toast("Draft saved");
                  } catch (e) {
                    toast(errorMessage(e), "error");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Save className="size-4" aria-hidden /> Save as Draft
              </Button>
              <Button variant="destructive" loading={busy} disabled={!!blockedReason} onClick={() => validate() && onSend(values())}>
                {busy ? <Mail className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />} {sendLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Modal open={previewing} onOpenChange={setPreviewing} title={v.subject || "Preview"} description={`To: ${v.to.join(", ") || "-"}`}>
        <RichTextView html={v.body} />
        <Badge tone="neutral" className="mt-3">
          Footer is added when sent
        </Badge>
      </Modal>
    </>
  );
}
