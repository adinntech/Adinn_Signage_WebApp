"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, FilePlus2, Mail, Maximize2, Minimize2, Minus, Save, Send, X } from "lucide-react";
import { AdinnLogo } from "@/components/shell/adinn-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
const TEMPLATE_LABEL: Record<TemplateKey, string> = { COMBINED: "Client code & project code request", CLIENT_CODE: "Client code request", PROJECT_CODE: "Project code request" };
type MailTab = "new" | "history" | "templates" | "groups";

/** Puts the ticked required documents into the email, above the signature. */
function withEnclosures(body: string, docs: string[]) {
  if (!docs.length) return body;
  const list = `<p>Documents enclosed:</p><ul>${docs.map((d) => `<li>${d}</li>`).join("")}</ul>`;
  const at = body.lastIndexOf("<p>Regards");
  return at < 0 ? body + list : body.slice(0, at) + list + body.slice(at);
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Mail Center for code requests, all on one page: New Mail, Mail History, Templates and Recipient Groups. New Mail has
 * the include boxes, To / Cc / Bcc as chips, subject, rich message with a Variables menu, an attachments panel and
 * Save as Draft / Send Mail. Both codes go in one email, or one email per code when sent separately.
 */
export function CodeMailComposer({ data: d, initialKinds, initialMode, enclosed, onDone, history }: { data: CodesOverview; initialKinds: CodeKind[]; initialMode: SendMode; enclosed: Record<CodeKind, string[]>; onDone: () => void; history: React.ReactNode }) {
  const toast = useToast();
  const send = useSendCodes(d.order._id);
  const saveDraft = useSaveCodeDraft(d.order._id);
  const open = KINDS.filter((k) => d.kinds[k].canRequest);
  const [mailTab, setMailTab] = useState<MailTab>("new");
  const [included, setIncluded] = useState<CodeKind[]>(initialKinds);
  const [mode, setMode] = useState<SendMode>(initialMode);
  const [sendTab, setSendTab] = useState<CodeKind>(initialKinds[0] ?? "CLIENT_CODE");
  const [files, setFiles] = useState<File[]>([]);
  const [docIds, setDocIds] = useState<string[]>(() => (initialKinds.some((k) => enclosed[k].includes("GST Certificate")) ? d.client.documents.map((x) => x.fileId) : []));
  const [nonce, setNonce] = useState(0);
  const [template, setTemplate] = useState<TemplateKey | "">("");
  const [groupTo, setGroupTo] = useState<string[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const key = useRef(newRequestKey());

  const live = included.filter((k) => open.includes(k));
  const separate = live.length === 2 && mode === "SEPARATE";
  const tabKind = live.includes(sendTab) ? sendTab : live[0];
  const kinds: CodeKind[] = separate ? [tabKind!] : live;
  const sentCount = d.requests.filter((r) => r.status !== "DRAFT").length;

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

  const applyTemplate = (t: TemplateKey) => {
    setTemplate(t);
    setIncluded(t === "COMBINED" ? open : open.filter((k) => k === t));
    setMode("COMBINED");
    setGroupTo(null);
    setNonce((n) => n + 1);
    setMailTab("new");
  };
  const applyGroup = (emails: string[]) => {
    setGroupTo(emails);
    setNonce((n) => n + 1);
    setMailTab("new");
  };

  const tabs: { key: MailTab; label: string }[] = [
    { key: "new", label: "New Mail" },
    { key: "history", label: `Mail History (${sentCount})` },
    { key: "templates", label: "Templates" },
    { key: "groups", label: "Recipient Groups" },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Mail Center" className="flex gap-1 overflow-x-auto border-b border-border px-5">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={mailTab === t.key} onClick={() => setMailTab(t.key)} className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold", mailTab === t.key ? "border-royal text-royal" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {mailTab === "history" && <div className="p-5">{history}</div>}

      {mailTab === "templates" && (
        <ul className="grid gap-3 p-5 md:grid-cols-3">
          {(Object.keys(TEMPLATE_LABEL) as TemplateKey[]).map((t) => {
            const usable = t === "COMBINED" ? open.length > 0 : open.includes(t);
            return (
              <li key={t} className="flex flex-col rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-primary">{TEMPLATE_LABEL[t]}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs text-muted-foreground">{d.defaults[t].subject}</p>
                <Button size="sm" variant="brand-outline" className="mt-3" disabled={!usable} onClick={() => applyTemplate(t)}>
                  {usable ? "Use this template" : "Not needed now"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {mailTab === "groups" && (
        <ul className="grid gap-3 p-5 md:grid-cols-2">
          {KINDS.map((k) => {
            const list = d.mail.groups[k];
            return (
              <li key={k} className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-primary">{CODE_LABEL[k]} recipients</h3>
                {list.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No group is set up for this yet. The administrator can add one in the server settings.</p>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {list.map((e) => (
                        <span key={e} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {e}
                        </span>
                      ))}
                    </div>
                    <Button size="sm" variant="brand-outline" className="mt-3" onClick={() => applyGroup(list)}>
                      Use as To
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mailTab === "new" && (
        <div className="space-y-4 p-5">
          {open.length === 0 ? (
            <p className="rounded-lg bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Every code is already requested or confirmed for this order, so there is nothing to send.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
                {live.length === 2 && (
                  <button type="button" className="mr-auto text-xs font-medium text-royal hover:underline" onClick={() => setMode(mode === "COMBINED" ? "SEPARATE" : "COMBINED")}>
                    {mode === "COMBINED" ? "Send as two separate emails instead" : "Send as one combined email instead"}
                  </button>
                )}
                {open.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-[var(--color-danger)]" checked={included.includes(k)} onChange={() => toggle(k)} />
                    Include {CODE_LABEL[k]} Request
                  </label>
                ))}
              </div>

              {separate && (
                <div role="tablist" className="flex gap-1 border-b border-border">
                  {live.map((k) => (
                    <button key={k} role="tab" aria-selected={tabKind === k} onClick={() => setSendTab(k)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tabKind === k ? "border-royal text-royal" : "border-transparent text-muted-foreground")}>
                      {CODE_LABEL[k]} email
                    </button>
                  ))}
                </div>
              )}

              {kinds.length === 0 ? (
                <p className="rounded-lg bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Tick at least one request to include.</p>
              ) : (
                <MailForm
                  key={`${kinds.join()}-${separate}-${nonce}`}
                  data={d}
                  kinds={kinds}
                  templateKey={template || (kinds.length === 2 ? "COMBINED" : kinds[0]!)}
                  enclosed={kinds.flatMap((k) => enclosed[k])}
                  toOverride={groupTo}
                  busy={send.isPending}
                  attachments={
                    <aside className="flex flex-col rounded-xl border border-border bg-background">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <h3 className="text-sm font-semibold">Attachments ({attached})</h3>
                        <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
                          <FilePlus2 className="size-4" aria-hidden /> Add Files
                        </Button>
                        <input ref={input} type="file" multiple hidden accept={ACCEPT.join(",")} onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
                      </div>
                      <ul className="max-h-72 flex-1 divide-y divide-border overflow-auto">
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
                  }
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
                      if (!KINDS.some((k) => res.kinds[k].canRequest)) onDone();
                    } catch (e) {
                      toast(errorMessage(e), "error");
                    }
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
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

/** The mail itself. Remounted (by key) when the included codes, the template or the recipient group change. */
function MailForm({ data: d, kinds, templateKey, enclosed, toOverride, busy, attachments, onSend, onSaveDraft }: { data: CodesOverview; kinds: CodeKind[]; templateKey: TemplateKey; enclosed: string[]; toOverride: string[] | null; busy: boolean; attachments: React.ReactNode; onSend: (m: MailValues) => Promise<void>; onSaveDraft: (m: MailValues) => Promise<void> }) {
  const toast = useToast();
  const saved = d.drafts.find((x) => kinds.includes(x.kind));
  const base = d.defaults[templateKey];
  const group = [...new Set(kinds.flatMap((k) => d.mail.groups[k]))];
  const useSaved = !!saved && templateKey === (kinds.length === 2 ? "COMBINED" : kinds[0]);
  const [v, setV] = useState<MailValues>({
    to: toOverride ?? (useSaved ? saved.to : group),
    cc: useSaved ? saved.cc : [],
    bcc: useSaved ? saved.bcc : [],
    subject: useSaved && saved.subject ? saved.subject : base.subject,
    body: useSaved && saved.body ? saved.body : withEnclosures(base.body, enclosed),
  });
  const [from, setFrom] = useState(d.mail.identities[0] ?? "");
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

  const variables: [string, string | null][] = [
    ["Client name", d.client.name],
    ["Client ID", d.client.clientNo],
    ["GST number", d.client.gstin],
    ["PAN", d.client.pan],
    ["Order no", d.order.orderNo],
  ];
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
  const values = (): MailValues => ({ ...v, subject: v.subject.trim(), ...(d.mail.identities.length > 1 && from ? { from } : {}) });

  useEffect(() => {
    save.current = onSaveDraft;
  });
  const identities = d.mail.identities.length;

  // Autosave: the draft is kept a moment after the last change (not for the untouched form).
  useEffect(() => {
    if (!dirty.current) {
      dirty.current = true;
      return;
    }
    setAuto("saving");
    const t = setTimeout(() => {
      save.current({ ...v, subject: v.subject.trim(), ...(identities > 1 && from ? { from } : {}) }).then(
        () => setAuto("saved"),
        () => setAuto("failed"),
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [v, from, identities]);

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
          {!d.mail.enabled && (
            <p className="mx-4 mt-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">Email is not configured on the server. Sending will be recorded as &quot;Not sent&quot; until SMTP is set up.</p>
          )}
          <div>
            {d.mail.identities.length > 1 && (
              <Row label="From" htmlFor="cm-from">
                <Select id="cm-from" value={from} onChange={(e) => setFrom(e.target.value)} className="bare-field border-0 shadow-none">
                  {d.mail.identities.map((i) => (
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
              <TagInput id="cm-to" value={v.to} onChange={(to) => setV({ ...v, to })} placeholder="Type an email and press Enter" max={20} />
            </Row>
            {showCc && (
              <Row label="Cc" htmlFor="cm-cc" error={errors.cc}>
                <TagInput id="cm-cc" value={v.cc} onChange={(cc) => setV({ ...v, cc })} placeholder="Optional" max={20} />
              </Row>
            )}
            {showBcc && (
              <Row label="Bcc" htmlFor="cm-bcc" error={errors.bcc}>
                <TagInput id="cm-bcc" value={v.bcc} onChange={(bcc) => setV({ ...v, bcc })} placeholder="Hidden from the other recipients" max={20} />
              </Row>
            )}
            <Row label="Subject" required htmlFor="cm-subject" error={errors.subject}>
              <Input id="cm-subject" placeholder="Email subject" value={v.subject} maxLength={250} aria-invalid={!!errors.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} className="bare-field border-0 px-0 shadow-none" />
            </Row>
          </div>
          <div className="space-y-3 px-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
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
            <p className="text-xs text-muted-foreground">Adinn Advertising Services Ltd. The logo and company line are added at the end of every code request email.</p>
          </div>
        </div>
        {attachments}
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
          <Save className="size-4" aria-hidden /> Save as Draft
        </Button>
        <Button variant="destructive" loading={busy} onClick={() => validate() && onSend(values())}>
          {busy ? <Mail className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />} Send Mail
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
