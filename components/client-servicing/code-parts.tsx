"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { evidenceLink, useConfirmCode, useRejectCode, CODE_LABEL, STATUS_LABEL, type CodeKind, type CodeStatus, type KindState } from "@/lib/api/codeRequests";

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

/** Enter the real code that came back. Never generated here. */
export function ConfirmCodeDialog({ orderId, kind, onClose }: { orderId: string; kind: CodeKind | null; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirmCode(orderId);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  if (!kind) return null;
  const submit = async () => {
    const e = codeError(kind, code);
    setError(e);
    if (e) return;
    try {
      await confirm.mutateAsync({ kind, code, evidenceNote: note.trim() || undefined, files });
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
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" loading={confirm.isPending} onClick={submit}>
            Confirm Code
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={CODE_LABEL[kind]} htmlFor="confirm-code" required error={error}>
          <Input id="confirm-code" autoFocus inputMode={kind === "PROJECT_CODE" ? "numeric" : "text"} value={code} aria-invalid={!!error} placeholder={kind === "PROJECT_CODE" ? "8 digits" : "e.g. CLI-1234"} onChange={(e) => setCode(cleanCode(kind, e.target.value))} />
        </Field>
        <Field label="Evidence (optional)" htmlFor="confirm-note" hint="Where it came from: reply mail, reference number, who confirmed.">
          <Textarea id="confirm-note" className="min-h-16" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Evidence files (optional)" htmlFor="confirm-files" hint="Reply mail, screenshot or PDF. Up to 5 files, 10 MB each.">
          <FileUploader id="confirm-files" compact multiple maxSizeMb={10} accept=".pdf,.jpg,.jpeg,.png,.webp" files={files} onChange={(l) => setFiles(l.slice(0, 5))} />
        </Field>
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
