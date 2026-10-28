"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, FileCheck2, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useSaveVendor, type Vendor, type VendorInput, type VendorType } from "@/lib/api/vendors";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Business details", icon: Building2, fields: ["type", "name", "contactPerson", "mobile", "mobileAlt", "email", "address", "district"] },
  { title: "KYC & bank", icon: FileCheck2, fields: ["pan", "gstin", "bank.accountName", "bank.accountNo", "bank.ifsc"] },
  { title: "Service area & rates", icon: IndianRupee, fields: ["serviceAreas", "ratePerShop", "farRatePerShop", "notes"] },
] as const;

type Form = { type: VendorType; name: string; contactPerson: string; mobile: string; mobileAlt: string; email: string; address: string; district: string; pan: string; gstin: string; accountName: string; accountNo: string; ifsc: string; serviceAreas: string; ratePerShop: string; farRatePerShop: string; notes: string };
const fromVendor = (v?: Vendor): Form => ({
  type: v?.type ?? "ONE_MAN", name: v?.name ?? "", contactPerson: v?.contactPerson ?? "", mobile: v?.mobile ?? "", mobileAlt: v?.mobileAlt ?? "", email: v?.email ?? "", address: v?.address ?? "", district: v?.district ?? "",
  pan: v?.pan ?? "", gstin: v?.gstin ?? "", accountName: v?.bank?.accountName ?? "", accountNo: v?.bank?.accountNo ?? "", ifsc: v?.bank?.ifsc ?? "",
  serviceAreas: (v?.serviceAreas ?? []).join(", "), ratePerShop: v?.ratePerShop != null ? String(v.ratePerShop) : "", farRatePerShop: v?.farRatePerShop != null ? String(v.farRatePerShop) : "", notes: v?.notes ?? "",
});

/** Vendor registration / onboarding in three steps. A new vendor starts as "Pending KYC". */
export function VendorForm({ open, vendor, onClose }: { open: boolean; vendor?: Vendor | undefined; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveVendor();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(() => fromVendor(vendor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const stepErrors = (n: number) => {
    const e: Record<string, string> = {};
    if (n === 0) {
      if (f.name.trim().length < 2) e.name = "Enter the vendor name";
      if (!f.mobile.trim()) e.mobile = "Enter the mobile number";
    }
    if (n === 2) for (const k of ["ratePerShop", "farRatePerShop"] as const) if (f[k].trim() !== "" && !(Number(f[k]) >= 0)) e[k] = "Enter an amount";
    return e;
  };
  const next = () => { const e = stepErrors(step); setErrors(e); if (!Object.keys(e).length) setStep((s) => s + 1); };

  function submit() {
    const e = { ...stepErrors(0), ...stepErrors(2) };
    setErrors(e);
    if (Object.keys(e).length) { setStep(stepErrors(0) && Object.keys(stepErrors(0)).length ? 0 : 2); return; }
    const t = (s: string) => (s.trim() === "" ? undefined : s.trim());
    const body: VendorInput = {
      type: f.type, name: f.name.trim(), mobile: f.mobile.trim(),
      ...(t(f.contactPerson) ? { contactPerson: t(f.contactPerson) as string } : {}), ...(t(f.mobileAlt) ? { mobileAlt: t(f.mobileAlt) as string } : {}), ...(t(f.email) ? { email: t(f.email) as string } : {}),
      ...(t(f.address) ? { address: t(f.address) as string } : {}), ...(t(f.district) ? { district: t(f.district) as string } : {}), ...(t(f.pan) ? { pan: t(f.pan) as string } : {}), ...(t(f.gstin) ? { gstin: t(f.gstin) as string } : {}),
      ...(f.accountName.trim() || f.accountNo.trim() || f.ifsc.trim() ? { bank: { ...(t(f.accountName) ? { accountName: t(f.accountName) as string } : {}), ...(t(f.accountNo) ? { accountNo: t(f.accountNo) as string } : {}), ...(t(f.ifsc) ? { ifsc: t(f.ifsc) as string } : {}) } } : {}),
      serviceAreas: f.serviceAreas.split(/[,;]/).map((x) => x.trim()).filter(Boolean),
      ...(t(f.ratePerShop) ? { ratePerShop: Number(f.ratePerShop) } : {}), ...(t(f.farRatePerShop) ? { farRatePerShop: Number(f.farRatePerShop) } : {}), ...(t(f.notes) ? { notes: t(f.notes) as string } : {}),
    };
    save.mutate(
      { id: vendor?._id, body },
      {
        onSuccess: () => { toast(vendor ? "Vendor updated" : "Vendor registered. Complete the KYC checklist to activate them"); onClose(); },
        onError: (err) => {
          const fe = fieldErrorsOf(err);
          if (Object.keys(fe).length) {
            setErrors(fe);
            const s = STEPS.findIndex((st) => (st.fields as readonly string[]).some((x) => x in fe));
            if (s >= 0) setStep(s);
          } else toast(errorMessage(err), "error");
        },
      },
    );
  }

  const err = (k: string) => errors[k];
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={vendor ? `Edit ${vendor.name}` : "New vendor registration"}
      description={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]!.title}`}
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>{step === 0 ? "Cancel" : <><ArrowLeft className="size-4" aria-hidden /> Back</>}</Button>
          {step < STEPS.length - 1 ? (
            <Button className="bg-royal hover:bg-royal/90" onClick={next}>Next <ArrowRight className="size-4" aria-hidden /></Button>
          ) : (
            <Button className="bg-finance hover:bg-finance/90" loading={save.isPending} onClick={submit}>{vendor ? "Save changes" : "Register vendor"}</Button>
          )}
        </div>
      }
    >
      <ol className="mb-4 grid grid-cols-3 gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button type="button" onClick={() => i <= step && setStep(i)} className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium", i === step ? "border-royal bg-[#e8f0ff] text-royal" : i < step ? "border-[#bbf0d3] bg-[#e7f9ef] text-finance" : "border-border text-muted-foreground")}>
              <s.icon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor type" htmlFor="v-type"><Select id="v-type" value={f.type} onChange={set("type")}><option value="ONE_MAN">One-man vendor</option><option value="ORGANIZATION">Organization</option></Select></Field>
          <Field label="Vendor / firm name" htmlFor="v-name" required error={err("name")}><Input id="v-name" value={f.name} onChange={set("name")} aria-invalid={!!err("name")} /></Field>
          <Field label="Contact person" htmlFor="v-cp" error={err("contactPerson")}><Input id="v-cp" value={f.contactPerson} onChange={set("contactPerson")} /></Field>
          <Field label="Mobile" htmlFor="v-mobile" required error={err("mobile")}><Input id="v-mobile" format="phone" value={f.mobile} onChange={set("mobile")} aria-invalid={!!err("mobile")} /></Field>
          <Field label="Alternate mobile" htmlFor="v-alt" error={err("mobileAlt")}><Input id="v-alt" format="phone" value={f.mobileAlt} onChange={set("mobileAlt")} /></Field>
          <Field label="Email" htmlFor="v-email" error={err("email")}><Input id="v-email" type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="District" htmlFor="v-district" error={err("district")}><Input id="v-district" value={f.district} onChange={set("district")} /></Field>
          <Field label="Address" htmlFor="v-address" error={err("address")}><Input id="v-address" value={f.address} onChange={set("address")} /></Field>
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="PAN" htmlFor="v-pan" error={err("pan")} hint="e.g. ABCDE1234F"><Input id="v-pan" format="pan" value={f.pan} onChange={set("pan")} /></Field>
          <Field label="GST number" htmlFor="v-gst" error={err("gstin")} hint={f.type === "ORGANIZATION" ? "Needed for an organization" : "Optional for one-man vendors"}><Input id="v-gst" format="gst" value={f.gstin} onChange={set("gstin")} /></Field>
          <Field label="Account holder" htmlFor="v-ah" error={err("bank.accountName")}><Input id="v-ah" value={f.accountName} onChange={set("accountName")} /></Field>
          <Field label="Account number" htmlFor="v-an" error={err("bank.accountNo")}><Input id="v-an" format="account" value={f.accountNo} onChange={set("accountNo")} /></Field>
          <Field label="IFSC" htmlFor="v-ifsc" error={err("bank.ifsc")}><Input id="v-ifsc" format="ifsc" value={f.ifsc} onChange={set("ifsc")} /></Field>
          <p className="self-end rounded-lg bg-[#eef4ff] p-3 text-xs text-navy">After registering, tick each document in the vendor&apos;s KYC checklist once you have checked the originals. Then activate the vendor.</p>
        </div>
      )}
      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service areas" htmlFor="v-areas" error={err("serviceAreas")} hint="Districts / areas, comma separated" className="sm:col-span-2"><Input id="v-areas" value={f.serviceAreas} onChange={set("serviceAreas")} placeholder="Madurai, Theni, Dindigul" /></Field>
          <Field label="Rate per shop (₹)" htmlFor="v-rate" error={err("ratePerShop")} hint="Blank = company rate"><Input id="v-rate" format="decimal" value={f.ratePerShop} onChange={set("ratePerShop")} /></Field>
          <Field label="Far-distance rate per shop (₹)" htmlFor="v-far" error={err("farRatePerShop")} hint="Blank = company far rate"><Input id="v-far" format="decimal" value={f.farRatePerShop} onChange={set("farRatePerShop")} /></Field>
          <Field label="Notes" htmlFor="v-notes" className="sm:col-span-2"><Textarea id="v-notes" rows={2} value={f.notes} onChange={set("notes")} /></Field>
        </div>
      )}
    </Modal>
  );
}
