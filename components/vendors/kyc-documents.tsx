"use client";

import { useRef, useState } from "react";
import { CheckCircle2, IdCard, Landmark, MapPinned, Paperclip, Receipt, UploadCloud, X } from "lucide-react";
import { AttachmentChip } from "@/components/sales/order-comments";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { KYC_ITEMS, useKycFiles, type KycFile, type KycKey, type VendorType } from "@/lib/api/vendors";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PendingKyc = Partial<Record<KycKey, File[]>>;

const ACCEPT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_MB = 10;
const MAX_PER_ITEM = 3;
const ICON: Record<KycKey, typeof IdCard> = { pan: IdCard, gst: Receipt, bank: Landmark, address: MapPinned };
const HINT: Record<KycKey, string> = { pan: "PAN card scan", gst: "GST registration certificate", bank: "Cancelled cheque or passbook first page", address: "Aadhaar, electricity bill or rent agreement" };

/**
 * The four KYC document tiles (PAN, GST, bank proof, address proof). One component for both places it is used:
 * - registration form: files are only picked (`pending`) and uploaded after the vendor is saved;
 * - vendor drawer: pass `vendorId`, files are uploaded the moment they are picked.
 * A scan never ticks the KYC checklist; Operations ticks it after viewing the document.
 */
export function KycDocuments({ type, vendorId, saved = [], pending = {}, onAdd, onRemovePending, busy, readOnly }: {
  type: VendorType;
  vendorId?: string | undefined;
  saved?: KycFile[];
  pending?: PendingKyc;
  onAdd: (docType: KycKey, files: File[]) => void;
  onRemovePending?: (docType: KycKey, index: number) => void;
  /** Document type being uploaded right now. */
  busy?: KycKey | null;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const { remove } = useKycFiles();
  const [removing, setRemoving] = useState<KycFile | null>(null);
  const inputs = useRef<Partial<Record<KycKey, HTMLInputElement | null>>>({});

  function pick(k: KycKey, list: FileList | null) {
    if (!list?.length) return;
    const room = MAX_PER_ITEM - saved.filter((f) => f.docType === k).length - (pending[k]?.length ?? 0);
    const files = Array.from(list);
    const bad = files.find((f) => !ACCEPT.some((x) => f.name.toLowerCase().endsWith(x)));
    if (bad) return toast(`${bad.name}: only PDF, JPG, PNG or WEBP files are allowed`, "error");
    const big = files.find((f) => f.size > MAX_MB * 1048576);
    if (big) return toast(`${big.name} is ${formatBytes(big.size)}. The limit is ${MAX_MB} MB`, "error");
    if (files.length > room) return toast(`Up to ${MAX_PER_ITEM} files per document. You can add ${Math.max(room, 0)} more here`, "error");
    onAdd(k, files);
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {KYC_ITEMS.map((item) => {
          const k = item.key;
          const Icon = ICON[k];
          const mine = saved.filter((f) => f.docType === k);
          const waiting = pending[k] ?? [];
          const count = mine.length + waiting.length;
          const required = k !== "gst" || type === "ORGANIZATION";
          const full = count >= MAX_PER_ITEM;
          return (
            <section key={k} aria-label={item.label} className={cn("flex flex-col rounded-xl border p-3", count ? "border-[#bbf0d3] bg-[#f4fcf7]" : "border-border bg-surface")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", count ? "bg-[#e2f8ea] text-finance" : "bg-[#f1e6ff] text-vendor")}><Icon className="size-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">{item.label.split(" (")[0]}{count > 0 && <CheckCircle2 className="size-4 text-finance" aria-label="Uploaded" />}</p>
                  <p className="text-xs text-muted-foreground">{HINT[k]}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", required ? "bg-[#fff0e0] text-approval" : "bg-muted text-muted-foreground")}>{required ? "Required" : "Optional"}</span>
              </div>

              {(mine.length > 0 || waiting.length > 0) && (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {mine.map((f) => (
                    <li key={f.fileId} className="max-w-full">
                      <AttachmentChip file={f} source={{ vendorId: vendorId! }} {...(readOnly || !vendorId ? {} : { onRemove: () => setRemoving(f) })} />
                    </li>
                  ))}
                  {waiting.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="max-w-full">
                      <span className="inline-flex max-w-full items-center rounded-lg border border-dashed border-royal/50 bg-[#eef4ff] text-xs font-medium text-royal">
                        <span className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-1"><Paperclip className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{f.name}</span><span className="shrink-0 text-muted-foreground">{formatBytes(f.size)}</span></span>
                        {onRemovePending && <button type="button" onClick={() => onRemovePending(k, i)} className="mr-1 rounded p-0.5 hover:bg-royal/10" aria-label={`Remove ${f.name}`}><X className="size-3.5" aria-hidden /></button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {!readOnly && (
                <>
                  <button
                    type="button"
                    disabled={full || busy === k}
                    onClick={() => inputs.current[k]?.click()}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-sm font-medium text-royal transition-colors hover:border-royal/50 hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UploadCloud className={cn("size-4", busy === k && "animate-pulse")} aria-hidden /> {busy === k ? "Uploading…" : full ? `${MAX_PER_ITEM} files added` : count ? "Add another file" : "Upload document"}
                  </button>
                  <input
                    ref={(el) => { inputs.current[k] = el; }}
                    type="file"
                    className="sr-only"
                    accept={ACCEPT.join(",")}
                    multiple
                    aria-label={`Upload ${item.label}`}
                    onChange={(e) => { pick(k, e.target.files); e.target.value = ""; }}
                  />
                </>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">PDF, JPG, PNG or WEBP · up to {MAX_MB} MB each · {MAX_PER_ITEM} files per document. Uploaded scans are private and only Operations and Finance can open them.</p>

      <ConfirmDialog
        autoClose
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this document?"
        description={removing ? `${removing.name ?? "The file"} will be erased from storage.` : ""}
        confirmLabel="Delete document"
        destructive
        onConfirm={() => { if (removing && vendorId) remove.mutate({ id: vendorId, fileId: removing.fileId }, { onSuccess: () => toast("Document deleted"), onError: (e) => toast(errorMessage(e), "error") }); }}
      />
    </>
  );
}
