"use client";

import { useState } from "react";
import { Ban, CheckCircle2, FileUp, Mail, MapPin, Pencil, Phone, Power, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { KYC_ITEMS, VENDOR_STATUS_LABEL, VENDOR_TYPE_LABEL, useKycFiles, useSetKyc, useSetVendorStatus, type KycKey, type Vendor } from "@/lib/api/vendors";
import { KycDocuments } from "./kyc-documents";
import { formatDate } from "@/lib/format";
import { VendorLogins } from "./vendor-logins";
import { cn } from "@/lib/utils";

export const STATUS_TONE = { ACTIVE: "success", PENDING_KYC: "warning", INACTIVE: "neutral", BLACKLISTED: "danger" } as const;

function kycDone(v: Vendor) {
  const k = v.kyc ?? {};
  return !!(k.pan && k.bank && k.address && (v.type !== "ORGANIZATION" || k.gst));
}

/** Vendor details with the KYC checklist and the activate / deactivate / blacklist actions. */
export function VendorDrawer({ vendor, onClose, onEdit }: { vendor: Vendor | null; onClose: () => void; onEdit: (v: Vendor) => void }) {
  const toast = useToast();
  const kyc = useSetKyc();
  const status = useSetVendorStatus();
  const { upload } = useKycFiles();
  const [uploading, setUploading] = useState<KycKey | null>(null);
  const [ask, setAsk] = useState<"INACTIVE" | "BLACKLISTED" | null>(null);
  const [why, setWhy] = useState("");
  const v = vendor;
  const done = !!v && kycDone(v);

  const change = (s: "ACTIVE" | "INACTIVE" | "BLACKLISTED", reason?: string) =>
    v && status.mutate({ id: v._id, status: s, reason }, { onSuccess: () => { toast(`${v.name}: ${VENDOR_STATUS_LABEL[s]}`); setAsk(null); setWhy(""); onClose(); }, onError: (e) => toast(errorMessage(e), "error") });

  return (
    <Modal open={!!v} onOpenChange={(o) => !o && onClose()} title={v?.name ?? "Vendor"} description={v ? `${v.code} · ${VENDOR_TYPE_LABEL[v.type]}` : undefined} variant="drawer" className="max-w-xl">
      {v && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[v.status]}>{VENDOR_STATUS_LABEL[v.status]}</Badge>
            {v.zohoVendorNo && <Badge tone="info">Zoho {v.zohoVendorNo}</Badge>}
            {v.statusReason && <span className="text-xs text-muted-foreground">{v.statusReason}</span>}
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(v)}><Pencil className="size-3.5" aria-hidden /> Edit</Button>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" aria-hidden /><dd>{v.mobile}{v.mobileAlt ? ` / ${v.mobileAlt}` : ""}{v.contactPerson ? ` · ${v.contactPerson}` : ""}</dd></div>
            {v.email && <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" aria-hidden /><dd>{v.email}</dd></div>}
            {(v.address || v.district) && <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden /><dd>{[v.address, v.district].filter(Boolean).join(", ")}</dd></div>}
            {!!v.serviceAreas?.length && <div className="flex flex-wrap gap-1.5 pt-1">{v.serviceAreas.map((a) => <span key={a} className="rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-xs font-medium text-royal">{a}</span>)}</div>}
          </dl>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-[#f6f0ff] p-3"><p className="text-xs text-muted-foreground">Rate per shop</p><p className="font-bold text-vendor">{v.ratePerShop != null ? `₹${v.ratePerShop}` : "Company rate"}</p></div>
            <div className="rounded-lg bg-[#f6f0ff] p-3"><p className="text-xs text-muted-foreground">Far-distance rate</p><p className="font-bold text-vendor">{v.farRatePerShop != null ? `₹${v.farRatePerShop}` : "Company rate"}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">PAN</p><p className="font-medium">{v.pan ?? "-"}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">GST</p><p className="break-all font-medium">{v.gstin ?? "-"}</p></div>
            <div className="col-span-2 rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Bank</p><p className="font-medium">{v.bank?.accountNo ? `${v.bank.accountName ?? ""} · ${v.bank.accountNo} · ${v.bank.ifsc ?? ""}` : "-"}</p></div>
          </div>

          <section aria-label="KYC documents" className="rounded-xl border border-border p-3">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-navy"><FileUp className="size-4 text-vendor" aria-hidden /> KYC documents</h3>
            <KycDocuments
              type={v.type}
              vendorId={v._id}
              saved={v.kycFiles ?? []}
              busy={uploading}
              readOnly={v.status === "BLACKLISTED"}
              onAdd={(docType, files) => {
                setUploading(docType);
                upload.mutate({ id: v._id, docType, files }, { onSuccess: () => toast("Document uploaded. View it, then tick it in the checklist below"), onError: (e) => toast(errorMessage(e), "error"), onSettled: () => setUploading(null) });
              }}
            />
          </section>

          <section aria-label="KYC checklist" className="rounded-xl border border-border p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><ShieldCheck className={cn("size-4", done ? "text-finance" : "text-approval")} aria-hidden /> KYC checklist {done && <Badge tone="success">Complete</Badge>}</h3>
            <ul className="space-y-1.5">
              {KYC_ITEMS.map((k) => (
                <li key={k.key}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4" checked={!!v.kyc?.[k.key as KycKey]} disabled={kyc.isPending || v.status === "BLACKLISTED"} onChange={(e) => kyc.mutate({ id: v._id, body: { [k.key]: e.target.checked } }, { onError: (err) => toast(errorMessage(err), "error") })} />
                    <span>{k.label}{k.key === "gst" && v.type === "ONE_MAN" ? <span className="text-xs text-muted-foreground"> (optional)</span> : null}</span>
                  </label>
                </li>
              ))}
            </ul>
            {v.kyc?.verifiedAt && <p className="mt-2 text-xs text-muted-foreground">Verified {formatDate(v.kyc.verifiedAt)}</p>}
          </section>

          <VendorLogins vendor={v} />

          <p className="text-xs text-muted-foreground">{v.allocatedShops ? `${v.allocatedShops} shop(s) currently allocated.` : "No shops allocated."}</p>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {v.status !== "ACTIVE" && v.status !== "BLACKLISTED" && <Button className="bg-finance hover:bg-finance/90" disabled={!done} loading={status.isPending && !ask} title={done ? "" : "Complete the KYC checklist first"} onClick={() => change("ACTIVE")}><CheckCircle2 className="size-4" aria-hidden /> Activate</Button>}
            {v.status === "BLACKLISTED" && <Button variant="outline" disabled={!done} onClick={() => change("ACTIVE")}>Remove from blacklist</Button>}
            {v.status === "ACTIVE" && <Button variant="outline" onClick={() => { setWhy(""); setAsk("INACTIVE"); }}><Power className="size-4" aria-hidden /> Make inactive</Button>}
            {v.status !== "BLACKLISTED" && <Button variant="outline" className="text-loss" onClick={() => { setWhy(""); setAsk("BLACKLISTED"); }}><Ban className="size-4" aria-hidden /> Blacklist</Button>}
          </div>
        </div>
      )}

      <Modal
        open={!!ask}
        onOpenChange={(o) => !o && setAsk(null)}
        title={ask === "BLACKLISTED" ? "Blacklist vendor" : "Make vendor inactive"}
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAsk(null)}>Back</Button><Button className="bg-loss hover:bg-loss/90" loading={status.isPending} disabled={why.trim().length < 3} onClick={() => ask && change(ask, why.trim())}>Confirm</Button></div>}
      >
        <Field label="Reason" htmlFor="v-reason" required><Textarea id="v-reason" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
      </Modal>
    </Modal>
  );
}
