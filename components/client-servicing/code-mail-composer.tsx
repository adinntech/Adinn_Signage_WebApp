"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Eye, FilePlus2, Mail, Save, Send, X } from "lucide-react";
import { AdinnLogo } from "@/components/shell/adinn-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichTextEditor, RichTextView } from "@/components/ui/rich-text-editor";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { useToast } from "@/components/ui/toast";
import { FileTypeIcon, kindOfName } from "@/components/upload/file-drop";
import { errorMessage } from "@/lib/api";
import { CODE_LABEL, useSaveCodeDraft, useSendCodes, type CodeKind, type CodesOverview } from "@/lib/api/codeRequests";
import { newRequestKey } from "@/lib/api/sales";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SendMode = "COMBINED" | "SEPARATE";
const KINDS: CodeKind[] = ["CLIENT_CODE", "PROJECT_CODE"];
const ACCEPT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_MB = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fp = (name: string, size: number) => `${name.trim().toLowerCase()}|${size}`;

type TemplateKey = "COMBINED" | CodeKind;
const TEMPLATE_LABEL: Record<TemplateKey, string> = { COMBINED: "Client & project code request", CLIENT_CODE: "Client code request", PROJECT_CODE: "Project code request" };

/** Puts the ticked required documents into the email, above the signature. */
function withEnclosures(body: string, docs: string[]) {
  if (!docs.length) return body;
  const list = `<p>Documents enclosed:</p><ul>${docs.map((d) => `<li>${d}</li>`).join("")}</ul>`;
  const at = body.lastIndexOf("<p>Regards");
  return at < 0 ? body + list : body.slice(0, at) + list + body.slice(at);
}

/**
 * Combined Email Composer (reference screen 06): include the client code and/or project code request, recipients,
 * subject, rich body, merged attachments with Add Files, Save Draft and Send Mail. Both codes go in one email, or
 * one email per code when "Send separately" is chosen.
 */
export function CodeMailComposer({ data: d, initialKinds, initialMode, enclosed, onBack }: { data: CodesOverview; initialKinds: CodeKind[]; initialMode: SendMode; enclosed: Record<CodeKind, string[]>; onBack: () => void }) {
  const toast = useToast();
  const send = useSendCodes(d.order._id);
  const saveDraft = useSaveCodeDraft(d.order._id);
  const open = KINDS.filter((k) => d.kinds[k].canRequest);
  const [included, setIncluded] = useState<CodeKind[]>(initialKinds);
  const [mode, setMode] = useState<SendMode>(initialMode);
  const [tab, setTab] = useState<CodeKind>(initialKinds[0] ?? "CLIENT_CODE");
  const [files, setFiles] = useState<File[]>([]);
  const [docIds, setDocIds] = useState<string[]>(() => (initialKinds.some((k) => enclosed[k].includes("GST Certificate")) ? d.client.documents.map((x) => x.fileId) : []));
  const [nonce, setNonce] = useState(0);
  const [template, setTemplate] = useState<TemplateKey | "">("");
  const input = useRef<HTMLInputElement>(null);
  const key = useRef(newRequestKey());

  const live = included.filter((k) => open.includes(k));
  const separate = live.length === 2 && mode === "SEPARATE";
  const tabKind = live.includes(tab) ? tab : live[0];
  const kinds: CodeKind[] = separate ? [tabKind!] : live;

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const bad = picked.find((f) => !ACCEPT.some((x) => f.name.toLowerCase().endsWith(x)) || f.size > MAX_MB * 1024 * 1024);
    if (bad) return toast(`${bad.name}: only PDF or images up to ${MAX_MB} MB`, "error");
    const have = new Set(files.map((f) => fp(f.name, f.size)));
    const fresh = picked.filter((f) => !have.has(fp(f.name, f.size)));
    if (fresh.length < picked.length) toast("A file with the same name and size is already attached", "error");
    if (files.length + fresh.length > 10) return toast("At most 10 files", "error");
    setFiles([...files, ...fresh]);
  };
  const attached = files.length + docIds.length;

  const toggle = (k: CodeKind) => setIncluded((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-navy via-[#173a8a] to-royal px-5 py-4 text-white">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="text-white hover:bg-white/15 hover:text-white">
          <ArrowLeft className="size-5" aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{live.length === 2 ? "Send Client Code & Project Code Request" : live.length === 1 ? `Send ${CODE_LABEL[live[0]!]} Request` : "Send Code Request"}</h2>
          <p className="text-xs text-white/75">{live.length === 2 ? (separate ? "Each request goes in its own email. Send them one after the other." : "Both requests will be sent in a single email with the selected attachments.") : "The request will be sent with the selected attachments."}</p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {open.map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-[var(--color-royal)]" checked={included.includes(k)} onChange={() => toggle(k)} />
              Include {CODE_LABEL[k]} Request
            </label>
          ))}
          {live.length === 2 && (
            <button type="button" className="text-xs font-medium text-royal hover:underline" onClick={() => setMode(mode === "COMBINED" ? "SEPARATE" : "COMBINED")}>
              {mode === "COMBINED" ? "Send as two separate emails instead" : "Send as one combined email instead"}
            </button>
          )}
          <div className="ml-auto w-60">
            <Select
              aria-label="Load template"
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value as TemplateKey | "");
                setNonce((n) => n + 1);
              }}
            >
              <option value="">Load Template</option>
              {(Object.keys(TEMPLATE_LABEL) as TemplateKey[]).map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {separate && (
          <div role="tablist" className="flex gap-1 border-b border-border">
            {live.map((k) => (
              <button key={k} role="tab" aria-selected={tabKind === k} onClick={() => setTab(k)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tabKind === k ? "border-royal text-royal" : "border-transparent text-muted-foreground")}>
                {CODE_LABEL[k]} email
              </button>
            ))}
          </div>
        )}

        {kinds.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Tick at least one request to include.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
            <MailForm
              key={`${kinds.join()}-${separate}-${nonce}`}
              data={d}
              kinds={kinds}
              templateKey={template || (kinds.length === 2 ? "COMBINED" : kinds[0]!)}
              enclosed={kinds.flatMap((k) => enclosed[k])}
              busy={send.isPending}
              onSaveDraft={async (m) => void (await saveDraft.mutateAsync([{ kinds, ...m }]))}
              onSend={async (m) => {
                try {
                  const res = await send.mutateAsync({ mails: [{ kinds, ...m }], requestKey: `${key.current}-${kinds.length}`, includeClientDocs: docIds, files });
                  key.current = newRequestKey();
                  setFiles([]);
                  const row = res.requests.find((r) => r.kind === kinds[0] && r.mail);
                  if (row?.mail?.status === "FAILED") toast(`Sending failed: ${row.mail.error ?? "unknown error"}. Retry it from Code Confirmation.`, "error");
                  else if (row?.mail?.status === "SKIPPED") toast("Saved, but not emailed: email is not configured on the server.", "error");
                  else toast(kinds.length === 2 ? "Combined request sent" : `${CODE_LABEL[kinds[0]!]} request sent`);
                  if (!KINDS.some((k) => res.kinds[k].canRequest)) onBack();
                } catch (e) {
                  toast(errorMessage(e), "error");
                }
              }}
            />
            <aside className="flex flex-col rounded-xl border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Attachments ({attached})</h3>
                <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
                  <FilePlus2 className="size-4" aria-hidden /> Add Files
                </Button>
                <input ref={input} type="file" multiple hidden accept={ACCEPT.join(",")} onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
              </div>
              <ul className="max-h-80 flex-1 divide-y divide-border overflow-auto">
                {d.client.documents
                  .filter((x) => docIds.includes(x.fileId))
                  .map((x) => (
                    <li key={x.fileId} className="flex items-center gap-3 px-4 py-2.5">
                      <FileTypeIcon kind={kindOfName(x.name ?? "a.pdf")} name={x.name ?? "a.pdf"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{x.name ?? "GST certificate"}</span>
                        <span className="text-xs text-muted-foreground">Client document {x.size ? `· ${formatBytes(x.size)}` : ""}</span>
                      </span>
                      <button type="button" aria-label={`Remove ${x.name}`} className="text-muted-foreground hover:text-danger" onClick={() => setDocIds(docIds.filter((i) => i !== x.fileId))}>
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                {files.map((f) => (
                  <li key={fp(f.name, f.size)} className="flex items-center gap-3 px-4 py-2.5">
                    <FileTypeIcon kind={kindOfName(f.name)} name={f.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                    </span>
                    <button type="button" aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-danger" onClick={() => setFiles(files.filter((x) => x !== f))}>
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
                {attached === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No files attached. PDF or images, up to 10.</li>}
              </ul>
              {d.client.documents.some((x) => !docIds.includes(x.fileId)) && (
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Client documents on record</p>
                  {d.client.documents
                    .filter((x) => !docIds.includes(x.fileId))
                    .map((x) => (
                      <button key={x.fileId} type="button" onClick={() => setDocIds([...docIds, x.fileId])} className="flex w-full items-center gap-2 py-1 text-left text-sm text-royal hover:underline">
                        <FilePlus2 className="size-3.5" aria-hidden /> {x.name ?? "GST certificate"}
                      </button>
                    ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </Card>
  );
}

interface MailValues {
  to: string[];
  cc: string[];
  bcc: string[];
  from?: string;
  subject: string;
  body: string;
}

/** The text part of one email. Remounted (by key) when the included codes or the template change. */
function MailForm({ data: d, kinds, templateKey, enclosed, busy, onSend, onSaveDraft }: { data: CodesOverview; kinds: CodeKind[]; templateKey: TemplateKey; enclosed: string[]; busy: boolean; onSend: (m: MailValues) => Promise<void>; onSaveDraft: (m: MailValues) => Promise<void> }) {
  const toast = useToast();
  const saved = d.drafts.find((x) => kinds.includes(x.kind));
  const base = d.defaults[templateKey];
  const group = [...new Set(kinds.flatMap((k) => d.mail.groups[k]))];
  const useSaved = !!saved && templateKey === (kinds.length === 2 ? "COMBINED" : kinds[0]);
  const [v, setV] = useState<MailValues>({
    to: useSaved ? saved.to : group,
    cc: useSaved ? saved.cc : [],
    bcc: useSaved ? saved.bcc : [],
    subject: useSaved && saved.subject ? saved.subject : base.subject,
    body: useSaved && saved.body ? saved.body : withEnclosures(base.body, enclosed),
  });
  const [from, setFrom] = useState(d.mail.identities[0] ?? "");
  const [showBcc, setShowBcc] = useState(v.bcc.length > 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const values = (): MailValues => ({ ...v, subject: v.subject.trim(), ...(d.mail.identities.length > 1 && from ? { from } : {}) });

  return (
    <div className="min-w-0 space-y-4">
      {!d.mail.enabled && (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">Email is not configured on the server. Sending will be recorded as &quot;Not sent&quot; until SMTP is set up.</p>
      )}
      {d.mail.identities.length > 1 && (
        <Field label="From" htmlFor="cm-from">
          <Select id="cm-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {d.mail.identities.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="To" htmlFor="cm-to" required error={errors.to}>
        <TagInput id="cm-to" value={v.to} onChange={(to) => setV({ ...v, to })} placeholder="Type an email and press Enter" max={20} />
      </Field>
      <Field label="Cc" htmlFor="cm-cc" error={errors.cc}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <TagInput id="cm-cc" value={v.cc} onChange={(cc) => setV({ ...v, cc })} placeholder="Optional" max={20} />
          </div>
          {!showBcc && (
            <button type="button" className="pt-2.5 text-xs font-medium text-royal hover:underline" onClick={() => setShowBcc(true)}>
              Bcc
            </button>
          )}
        </div>
      </Field>
      {showBcc && (
        <Field label="Bcc" htmlFor="cm-bcc" error={errors.bcc} hint="Hidden from the other recipients">
          <TagInput id="cm-bcc" value={v.bcc} onChange={(bcc) => setV({ ...v, bcc })} placeholder="Optional" max={20} />
        </Field>
      )}
      <Field label="Subject" htmlFor="cm-subject" required error={errors.subject}>
        <Input id="cm-subject" value={v.subject} maxLength={250} aria-invalid={!!errors.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />
      </Field>
      <Field label="Message" htmlFor="cm-body" required error={errors.body}>
        <RichTextEditor id="cm-body" ariaLabel="Email body" value={v.body} onChange={(body) => setV({ ...v, body })} invalid={!!errors.body} minHeight={220} />
      </Field>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
        <AdinnLogo className="h-10 w-28 shadow-none ring-1 ring-border" />
        <p className="text-xs text-muted-foreground">Adinn Advertising Services Ltd. The logo and company line are added to the end of every code request email.</p>
      </div>
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
          <Save className="size-4" aria-hidden /> Save Draft
        </Button>
        <Button variant="destructive" loading={busy} onClick={() => validate() && onSend(values())}>
          {busy ? <Mail className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />} Send Mail
        </Button>
      </div>
      <Modal open={previewing} onOpenChange={setPreviewing} title={v.subject || "Preview"} description={`To: ${v.to.join(", ") || "-"}`}>
        <RichTextView html={v.body} />
        <Badge tone="neutral" className="mt-3">
          Footer is added when sent
        </Badge>
      </Modal>
    </div>
  );
}
