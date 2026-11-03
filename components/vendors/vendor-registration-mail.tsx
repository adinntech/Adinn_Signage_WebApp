"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Clock, Hourglass, KeyRound, Paperclip, RefreshCw, UploadCloud, X } from "lucide-react";
import { MailCompose } from "@/components/mail/mail-compose";
import { AttachmentChip } from "@/components/sales/order-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import type { FileRef } from "@/lib/api/files";
import { newRequestKey } from "@/lib/api/sales";
import { useKycFiles, useRegistrationMail, useSaveRegistrationDraft, useSendRegistrationMail, useSetVendorId, type KycDocKey, type RegistrationMailDraft, type Vendor } from "@/lib/api/vendors";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCEPT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_MB = 10;
const MAX_PER_TYPE = 3;
const MAX_OTHER = 5;
type Tab = "new" | "history";
type VendorRef = Pick<Vendor, "_id" | "name" | "code">;
type Attached = RegistrationMailDraft["attachments"][number];

/** The document slots of the attachments panel, in the order GSTN | PAN, Bank | Address, then any other document. */
const SLOTS: { key: KycDocKey; label: string }[] = [
  { key: "gst", label: "GSTN" },
  { key: "pan", label: "PAN" },
  { key: "bank", label: "Bank" },
  { key: "address", label: "Address" },
  { key: "other", label: "Other documents" },
];

/**
 * The vendor registration request, written in the same mail screen as the code requests (shared MailCompose): To / Cc /
 * Bcc, subject, message, Variables, Preview, Save as Draft and Send Mail. The attachments panel is where the documents
 * are uploaded: one slot each for GSTN, PAN, Bank, Address and Other documents, with delete and replace for an uploaded
 * file. Everything in the panel is attached by the server. When Accounts reply with the vendor ID it is typed here.
 */
export function VendorRegistrationPanel({ vendor }: { vendor: VendorRef }) {
  const toast = useToast();
  const q = useRegistrationMail(vendor._id);
  const send = useSendRegistrationMail(vendor._id);
  const draft = useSaveRegistrationDraft(vendor._id);
  const setId = useSetVendorId();
  const { upload, remove } = useKycFiles();
  const [tab, setTab] = useState<Tab>("new");
  const [resend, setResend] = useState(false);
  const [no, setNo] = useState("");
  const [noError, setNoError] = useState("");
  const [busy, setBusy] = useState<KycDocKey | null>(null);
  const [deleting, setDeleting] = useState<Attached | null>(null);
  /** The file picker is shared: it adds to a slot, or replaces one uploaded file. */
  const target = useRef<{ docType: KycDocKey; replace?: Attached } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const key = useRef(newRequestKey());
  const d = q.data;
  const sent = !!d?.registration?.mailSentAt;
  const saved = d?.zohoVendorNo;

  const saveId = () => {
    if (!/^\d{2,8}$/.test(no)) return setNoError("Enter the vendor ID Accounts sent (2 to 8 digits)");
    setId.mutate({ id: vendor._id, vendorNo: no }, { onSuccess: () => toast(`Vendor ID ${no} saved. Check the documents and activate the vendor`), onError: (e) => setNoError(errorMessage(e)) });
  };

  const pick = (docType: KycDocKey, replace?: Attached) => {
    target.current = { docType, ...(replace ? { replace } : {}) };
    input.current?.click();
  };
  async function onPicked(list: FileList | null) {
    const t = target.current;
    const files = Array.from(list ?? []);
    if (!t || !files.length) return;
    const bad = files.find((f) => !ACCEPT.some((x) => f.name.toLowerCase().endsWith(x)) || f.size > MAX_MB * 1048576);
    if (bad) return toast(`${bad.name}: only PDF or images up to ${MAX_MB} MB`, "error");
    setBusy(t.docType);
    try {
      const full = (d?.attachments.filter((a) => a.docType === t.docType).length ?? 0) >= (t.docType === "other" ? MAX_OTHER : MAX_PER_TYPE);
      // A replacement is uploaded first and the old file removed after it; only a full slot has to free the place first.
      if (t.replace && full) await remove.mutateAsync({ id: vendor._id, fileId: t.replace.fileId });
      await upload.mutateAsync({ id: vendor._id, docType: t.docType, files: t.replace ? files.slice(0, 1) : files });
      if (t.replace && !full) await remove.mutateAsync({ id: vendor._id, fileId: t.replace.fileId });
      toast(t.replace ? "Document replaced" : "Document added to the mail");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  if (q.isPending) return <RowsSkeleton rows={5} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!d) return null;

  const org = d.vendorType === "ORGANIZATION";
  const attachments = (
    <aside className="flex flex-col rounded-xl border border-border bg-background" aria-label="Attachments">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Attachments ({d.attachments.length})</h3>
        <p className="text-xs text-muted-foreground">Upload each document in its place. PDF or image, up to {MAX_MB} MB.</p>
      </div>
      <input ref={input} type="file" hidden accept={ACCEPT.join(",")} multiple onChange={(e) => { void onPicked(e.target.files); e.target.value = ""; }} />
      <div className="grid grid-cols-2 gap-px bg-border">
        {SLOTS.map((slot) => {
          const files = d.attachments.filter((a) => a.docType === slot.key);
          const required = slot.key === "pan" || slot.key === "bank" || (slot.key === "gst" && org);
          const lacking = required && files.length === 0;
          const full = files.length >= (slot.key === "other" ? MAX_OTHER : MAX_PER_TYPE);
          return (
            <section key={slot.key} aria-label={slot.label} className={cn("flex min-w-0 flex-col gap-2 bg-background p-3", slot.key === "other" && "col-span-2")}>
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1 text-sm font-semibold text-navy">{slot.label}{files.length > 0 && <CheckCircle2 className="size-3.5 text-finance" aria-label="Uploaded" />}</h4>
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", required ? "bg-[#fff0e0] text-approval" : "bg-muted text-muted-foreground")}>{required ? "Required" : "Optional"}</span>
              </div>
              {files.map((a) => (
                <div key={a.fileId} className="min-w-0 rounded-lg border border-border bg-surface p-1.5">
                  <AttachmentChip file={{ fileId: a.fileId, name: a.name, size: a.size } as FileRef} source={{ vendorId: vendor._id }} />
                  <div className="mt-1 flex items-center justify-between gap-1 px-1 text-xs text-muted-foreground">
                    <span>{formatBytes(a.size)}</span>
                    <span className="flex gap-0.5">
                      <button type="button" disabled={busy === slot.key} onClick={() => pick(slot.key, a)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-royal hover:bg-[#eef4ff] disabled:opacity-50" aria-label={`Replace ${a.name}`}><RefreshCw className="size-3" aria-hidden /> Replace</button>
                      <button type="button" onClick={() => setDeleting(a)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-loss hover:bg-[#fff5f5]" aria-label={`Delete ${a.name}`}><X className="size-3" aria-hidden /> Delete</button>
                    </span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={full || busy === slot.key}
                onClick={() => pick(slot.key)}
                className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-2 py-1.5 text-xs font-medium text-royal transition-colors hover:border-royal/50 hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50", lacking ? "border-loss/60" : "border-border")}
              >
                <UploadCloud className={cn("size-4", busy === slot.key && "animate-pulse")} aria-hidden /> {busy === slot.key ? "Uploading…" : full ? "Limit reached" : slot.key === "other" ? "Add files" : files.length ? "Add another" : "Upload"}
              </button>
            </section>
          );
        })}
      </div>
      <p className="flex items-start gap-1.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground"><Paperclip className="mt-0.5 size-3 shrink-0" aria-hidden /> Everything above is attached to the mail automatically.</p>
    </aside>
  );

  const tabs: { key: Tab; label: string }[] = [{ key: "new", label: "New Mail" }, { key: "history", label: `Mail History (${d.history.length})` }];
  return (
    <div className="space-y-4">
      <ol className="grid gap-2 text-xs font-medium sm:grid-cols-3" aria-label="Progress">
        <Step done label="Vendor registered" />
        <Step done={sent} label="Request mail sent" />
        <Step done={!!saved} label="Vendor ID received" />
      </ol>

      {sent && (
        <section aria-label="Vendor ID" className="rounded-xl border border-[#cfe0ff] bg-gradient-to-br from-[#eef4ff] to-[#f7f0ff] p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy"><KeyRound className="size-4 text-royal" aria-hidden /> Vendor ID from Accounts</h3>
          {saved ? (
            <p className="mt-2 flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-finance" aria-hidden /> Vendor ID <span className="font-mono font-bold text-navy">{saved}</span> saved. You can activate the vendor once the KYC documents are checked.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">When Accounts reply to the mail with the vendor ID, type it here and proceed.</p>
              <form className="mt-3 flex flex-wrap items-start gap-2" onSubmit={(e) => { e.preventDefault(); saveId(); }}>
                <div className="min-w-44 flex-1">
                  <label htmlFor="reg-vid" className="sr-only">Vendor ID</label>
                  <Input id="reg-vid" format="digits" maxLength={8} value={no} onChange={(e) => { setNo(e.target.value); setNoError(""); }} placeholder="Vendor ID, e.g. 12543" aria-invalid={!!noError} />
                  {noError && <p role="alert" className="mt-1 text-xs text-loss">{noError}</p>}
                </div>
                <Button type="submit" className="bg-royal hover:bg-royal/90" loading={setId.isPending} disabled={no.length < 2}>Save &amp; proceed</Button>
              </form>
            </>
          )}
        </section>
      )}

      <div role="tablist" aria-label="Registration mail" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold", tab === t.key ? "border-royal text-royal" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "history" &&
        (d.history.length === 0 ? (
          <EmptyState title="Nothing sent yet" description="The request mail is recorded here once it is sent." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {d.history.map((m) => (
              <li key={m._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <Badge tone={m.status === "SENT" ? "success" : m.status === "FAILED" ? "danger" : "warning"}>{m.status === "SENT" ? "Sent" : m.status === "FAILED" ? "Failed" : "Not sent"}</Badge>
                <span className="min-w-0 flex-1 truncate" title={m.subject}>{m.subject} <span className="text-muted-foreground">→ {m.to.join(", ")}</span></span>
                <span className="text-xs text-muted-foreground">{m.attachmentNames.length} file(s) · {formatDateTime(m.sentAt)}</span>
                {m.error && <span className="w-full text-xs text-loss">{m.error}</span>}
              </li>
            ))}
          </ul>
        ))}

      {tab === "new" && sent && !resend && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground"><Hourglass className="size-4" aria-hidden /> {saved ? "Request sent and answered." : "Waiting for Accounts to reply with the vendor ID."}</span>
          <Button size="sm" variant="outline" onClick={() => setResend(true)}>Send again</Button>
        </div>
      )}
      {tab === "new" && (!sent || resend) && (
        <MailCompose
          // Only a changed mail history remounts the form; uploading or deleting a document must not throw away what is being typed.
          key={`${vendor._id}-${d.history.length}`}
          initial={{ to: d.to, cc: d.cc, bcc: d.bcc, subject: d.subject, body: d.body }}
          identities={d.mail.identities}
          mailEnabled={d.mail.enabled}
          variables={[["Vendor name", vendor.name], ["Vendor code", vendor.code]]}
          attachments={attachments}
          wideAside
          footerNote="Adinn Advertising Services Ltd. The logo and company line are added at the end of the registration request email."
          busy={send.isPending}
          blockedReason={d.missing.length ? `Upload the required documents first: ${d.missing.join(", ")}` : null}
          onSaveDraft={async (m) => void (await draft.mutateAsync({ to: m.to, cc: m.cc, bcc: m.bcc, subject: m.subject, body: m.body }))}
          onSend={async (m) => {
            try {
              const r = await send.mutateAsync({ ...m, requestKey: key.current });
              key.current = newRequestKey();
              setResend(false);
              const last = r.history[0];
              if (last?.status === "FAILED") toast(`Sending failed: ${last.error ?? "unknown error"}. It is recorded in Mail History.`, "error");
              else if (last?.status === "SKIPPED") toast("Saved, but not emailed: email is not configured on the server.", "error");
              else toast(`Registration request sent to ${m.to.join(", ")}`);
            } catch (e) {
              toast(errorMessage(e), "error");
            }
          }}
        />
      )}

      <ConfirmDialog
        autoClose
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this document?"
        description={deleting ? `${deleting.name} will be erased from storage and will not be attached to the mail.` : ""}
        confirmLabel="Delete document"
        destructive
        onConfirm={() => deleting && remove.mutate({ id: vendor._id, fileId: deleting.fileId }, { onSuccess: () => toast("Document deleted"), onError: (e) => toast(errorMessage(e), "error") })}
      />
    </div>
  );
}

/** The same panel in a popup, opened from the vendor list or details. */
export function VendorRegistrationMail({ vendor, open, onClose }: { vendor: VendorRef; open: boolean; onClose: () => void }) {
  return (
    <Modal persistent open={open} onOpenChange={(o) => !o && onClose()} title={`Registration request · ${vendor.name}`} description={`${vendor.code} · mail Accounts, then enter the vendor ID they reply with`} className="max-w-5xl">
      {open && <VendorRegistrationPanel vendor={vendor} />}
    </Modal>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  const Icon = done ? CheckCircle2 : Clock;
  return (
    <li className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${done ? "border-[#bbf0d3] bg-[#e7f9ef] text-finance" : "border-border text-muted-foreground"}`}>
      <Icon className="size-4 shrink-0" aria-hidden /> {label}
    </li>
  );
}
