"use client";

import { useState } from "react";
import { History, MailCheck, Paperclip } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { replyStatus } from "@/components/mail/reply-banner";
import { GetReplyButton } from "@/components/mail/get-reply-button";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { evidenceLink, useConfirmCode, useRejectCode, CODE_LABEL, STATUS_LABEL, type CodeKind, type CodeReply, type CodeReplyEntry, type CodeStatus, type KindState } from "@/lib/api/codeRequests";

const STATUS_TONE: Record<CodeStatus, Tone> = { DRAFT: "neutral", PENDING_CONFIRMATION: "warning", CONFIRMED: "success", REJECTED: "danger", FAILED: "danger" };
export const CodeStatusBadge = ({ status }: { status: CodeStatus }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;

const KIND_TONE: Record<KindState, { tone: Tone; label: string }> = {
  NOT_REQUESTED: { tone: "neutral", label: "Not requested" },
  DRAFT: { tone: "neutral", label: "Draft saved" },
  PENDING: { tone: "warning", label: "Pending confirmation" },
  BD_SENT: { tone: "info", label: "Requested by BD" },
  CONFIRMED: { tone: "success", label: "Confirmed" },
  FAILED: { tone: "danger", label: "Email failed" },
};
export const KindStateBadge = ({ state }: { state: KindState }) => <Badge tone={KIND_TONE[state].tone}>{KIND_TONE[state].label}</Badge>;

/** Typing rules: a project code is exactly 8 digits; a client code is 3 to 20 capitals, digits or dashes. */
export const cleanCode = (kind: CodeKind, v: string) => (kind === "PROJECT_CODE" ? v.replace(/\D/g, "").slice(0, 8) : v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20));
export const codeError = (kind: CodeKind, v: string) =>
  !v ? "Enter the code received" : kind === "PROJECT_CODE" ? (/^\d{8}$/.test(v) ? "" : "Project code must be exactly 8 digits") : /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(v) ? "" : "Client code must be 3 to 20 letters, digits or dashes";

/** What the reply mailbox read for a request: who answered and the code found (or that none could be found). */
export function ReplyNotice({ reply }: { reply: CodeReply }) {
  return (
    <div role="status" className="rounded-lg border border-[#cfe0ff] bg-[#eef4ff] px-3 py-2 text-sm text-navy">
      <p className="flex flex-wrap items-center gap-2 font-semibold"><MailCheck className="size-4 text-royal" aria-hidden /> Newest reply · {formatDateTime(reply.receivedAt)} · {reply.from} {replyStatus(reply.status) && <Badge tone={replyStatus(reply.status)!.tone}>{replyStatus(reply.status)!.label}</Badge>}</p>
      {reply.detectedCode ? <p className="mt-1">Code found: <span className="font-mono font-bold">{reply.detectedCode}</span>. Check it against the reply, then confirm.</p> : <p className="mt-1 text-muted-foreground">{reply.reason ?? "No single code could be read from the reply."} Type the code from the mail.</p>}
      {!!reply.estimates?.length && <p className="mt-1">Estimates: <span className="font-mono font-semibold">{reply.estimates.join(", ")}</span></p>}
      {reply.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">&ldquo;{reply.snippet}&rdquo;</p>}
      {reply.autoConfirmError && <p className="mt-1 text-xs text-danger">Not confirmed automatically: {reply.autoConfirmError}</p>}
    </div>
  );
}

/** Estimate numbers typed as "EST-020456, est 020457" become EST-020456, EST-020457 (each once). null: something is not an estimate number. */
export function parseEstimates(text: string): string[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const m = /^(?:EST)?-?(\d{3,10})$/i.exec(p);
    if (!m) return null;
    const e = `EST-${m[1]}`;
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

/** Left side of the confirm box: every reply read (newest first) and what the person has changed from what was read. */
function HistoryPanel({ history, changes }: { history: CodeReplyEntry[]; changes: { field: string; from: string; to: string }[] }) {
  const list = [...history].reverse();
  return (
    <aside className="space-y-3 rounded-xl border border-border bg-[#f7f9fd] p-3 text-xs md:max-h-[26rem] md:overflow-y-auto" aria-label="Edit history">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy"><History className="size-3.5" aria-hidden /> History</p>
      <section>
        <p className="mb-1 font-semibold text-navy">Your changes (not saved yet)</p>
        {changes.length ? (
          <ul className="space-y-1.5">{changes.map((c) => <li key={c.field} className="rounded-md bg-white px-2 py-1.5"><span className="font-semibold capitalize">{c.field}</span><span className="block text-muted-foreground line-through">{c.from || "empty"}</span><span className="block font-medium text-navy">{c.to || "empty"}</span></li>)}</ul>
        ) : <p className="text-muted-foreground">Nothing changed from what was read.</p>}
      </section>
      <section>
        <p className="mb-1 font-semibold text-navy">Replies read ({list.length})</p>
        {list.length ? (
          <ul className="space-y-1.5">
            {list.map((h, i) => (
              <li key={i} className="rounded-md bg-white px-2 py-1.5">
                <span className="font-mono font-semibold text-navy">{h.detectedCode ?? "No code found"}</span>
                {!!h.estimates?.length && <span className="block font-mono text-muted-foreground">{h.estimates.join(", ")}</span>}
                <span className="block text-muted-foreground">{h.from} · {formatDateTime(h.receivedAt ?? h.at)}{i === 0 && list.length > 1 ? " · latest, shown" : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">No reply read yet.</p>}
      </section>
    </aside>
  );
}

/** Enter the real code that came back. Never generated here. Everything read from the reply is filled in and can be edited; the changes are kept. */
export function ConfirmCodeDialog({ orderId, kind, reply, history, onClose }: { orderId: string; kind: CodeKind | null; /** The reply mail read for this request: its code is filled in for the person to check. */ reply?: CodeReply | null; /** Every reply read for it, shown on the left. */ history?: CodeReplyEntry[]; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirmCode(orderId);
  const [code, setCode] = useState(reply?.detectedCode ?? "");
  const [est, setEst] = useState((reply?.estimates ?? []).join(", "));
  const [note, setNote] = useState(reply ? `From the reply of ${reply.from}` : "");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [estError, setEstError] = useState("");
  if (!kind) return null;
  const fetchedEst = (reply?.estimates ?? []).join(", ");
  const nowEst = kind === "PROJECT_CODE" ? (parseEstimates(est) ?? []).join(", ") : "";
  const changes = reply ? [...(code !== (reply.detectedCode ?? "") ? [{ field: "code", from: reply.detectedCode ?? "", to: code }] : []), ...(kind === "PROJECT_CODE" && nowEst !== fetchedEst ? [{ field: "estimates", from: fetchedEst, to: nowEst }] : [])] : [];
  const submit = async () => {
    const e = codeError(kind, code);
    setError(e);
    const estimates = kind === "PROJECT_CODE" ? parseEstimates(est) : [];
    if (estimates === null) return setEstError("Estimate numbers look like EST-020456, separated by commas");
    setEstError("");
    if (e) return;
    try {
      await confirm.mutateAsync({ kind, code, evidenceNote: note.trim() || undefined, ...(kind === "PROJECT_CODE" ? { estimates: estimates ?? [] } : {}), files });
      toast(`${CODE_LABEL[kind]} confirmed`);
      onClose();
    } catch (err) {
      setError(fieldErrorsOf(err).code ?? errorMessage(err));
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Confirm ${CODE_LABEL[kind]}`}
      description="Enter the code exactly as the authorised team sent it back."
      className={reply || history?.length ? "max-w-3xl" : undefined}
      footer={
        <>
          <GetReplyButton className="mr-auto" onDone={(got) => got && onClose()} />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" loading={confirm.isPending} onClick={submit}>
            Confirm Code
          </Button>
        </>
      }
    >
      <div className={history?.length || reply ? "grid gap-4 md:grid-cols-[15rem_1fr]" : ""}>
      {(history?.length || reply) && <HistoryPanel history={history ?? []} changes={changes} />}
      <div className="min-w-0 space-y-4">
        {reply && <ReplyNotice reply={reply} />}
        <Field label={CODE_LABEL[kind]} htmlFor="confirm-code" required error={error}>
          <Input id="confirm-code" autoFocus inputMode={kind === "PROJECT_CODE" ? "numeric" : "text"} value={code} aria-invalid={!!error} placeholder={kind === "PROJECT_CODE" ? "8 digits" : "e.g. CLI-1234"} onChange={(e) => setCode(cleanCode(kind, e.target.value))} />
        </Field>
        {kind === "PROJECT_CODE" && (
          <Field label="Estimate numbers (optional)" htmlFor="confirm-est" error={estError} hint="From the reply. Edit if needed: EST-020456, EST-020457">
            <Input id="confirm-est" value={est} maxLength={400} aria-invalid={!!estError} placeholder="EST-020456, EST-020457" onChange={(e) => { setEst(e.target.value); setEstError(""); }} />
          </Field>
        )}
        <Field label="Evidence (optional)" htmlFor="confirm-note" hint="Where it came from: reply mail, reference number, who confirmed.">
          <Textarea id="confirm-note" className="min-h-16" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Evidence files (optional)" htmlFor="confirm-files" hint="Reply mail, screenshot or PDF. Up to 5 files, 10 MB each.">
          <FileUploader id="confirm-files" compact multiple maxSizeMb={10} accept=".pdf,.jpg,.jpeg,.png,.webp" files={files} onChange={(l) => setFiles(l.slice(0, 5))} />
        </Field>
      </div>
      </div>
    </Modal>
  );
}

export function RejectCodeDialog({ orderId, kind, onClose }: { orderId: string; kind: CodeKind | null; onClose: () => void }) {
  const toast = useToast();
  const reject = useRejectCode(orderId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!kind) return null;
  const submit = async () => {
    if (reason.trim().length < 3) return setError("Enter the reason");
    try {
      await reject.mutateAsync({ kind, reason: reason.trim() });
      toast(`${CODE_LABEL[kind]} request rejected`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Reject ${CODE_LABEL[kind]} request`}
      description="The request is closed and a new one can be sent."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" loading={reject.isPending} onClick={submit}>
            Reject Request
          </Button>
        </>
      }
    >
      <Field label="Reason" htmlFor="reject-reason" required error={error}>
        <Textarea id="reject-reason" autoFocus className="min-h-20" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

/** Evidence files kept with a confirmed code. Each opens through a short-lived link. */
export function EvidenceLinks({ orderId, files }: { orderId: string; files?: { fileId: string; name?: string }[] }) {
  const toast = useToast();
  if (!files?.length) return null;
  const open = (id: string) => evidenceLink(orderId, id).then((r) => window.open(r.url, "_blank", "noopener"), (e) => toast(errorMessage(e), "error"));
  return (
    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
      {files.map((f) => (
        <button key={f.fileId} type="button" onClick={() => open(f.fileId)} className="inline-flex max-w-48 items-center gap-1 text-xs text-brand hover:underline">
          <Paperclip className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{f.name ?? "Evidence"}</span>
        </button>
      ))}
    </span>
  );
}
