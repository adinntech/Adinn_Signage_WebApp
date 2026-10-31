"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CheckCircle2, CloudDownload, FileCheck2, FileUp, IndianRupee, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useKycFiles, useLookupZohoVendor, useSaveVendor, type KycKey, type Vendor, type VendorInput, type VendorType, type ZohoVendorLookup } from "@/lib/api/vendors";
import { KycDocuments, type PendingKyc } from "./kyc-documents";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "business", title: "Business details", icon: Building2, fields: ["type", "name", "contactPerson", "mobile", "mobileAlt", "email", "address", "district"] },
  { key: "kyc", title: "KYC & bank", icon: FileCheck2, fields: ["pan", "gstin", "bank.accountName", "bank.accountNo", "bank.ifsc"] },
  // Only when registering: the scans are uploaded right after the vendor is saved. For an existing vendor they are managed in the vendor details panel.
  { key: "documents", title: "KYC documents", icon: FileUp, fields: [] },
  { key: "rates", title: "Service area & rates", icon: IndianRupee, fields: ["serviceAreas", "ratePerShop", "farRatePerShop", "notes"] },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

type Form = { type: VendorType; name: string; contactPerson: string; mobile: string; mobileAlt: string; email: string; address: string; district: string; pan: string; gstin: string; accountName: string; accountNo: string; ifsc: string; serviceAreas: string; ratePerShop: string; farRatePerShop: string; notes: string };
const fromVendor = (v?: Vendor): Form => ({
  type: v?.type ?? "ONE_MAN", name: v?.name ?? "", contactPerson: v?.contactPerson ?? "", mobile: v?.mobile ?? "", mobileAlt: v?.mobileAlt ?? "", email: v?.email ?? "", address: v?.address ?? "", district: v?.district ?? "",
  pan: v?.pan ?? "", gstin: v?.gstin ?? "", accountName: v?.bank?.accountName ?? "", accountNo: v?.bank?.accountNo ?? "", ifsc: v?.bank?.ifsc ?? "",
  serviceAreas: (v?.serviceAreas ?? []).join(", "), ratePerShop: v?.ratePerShop != null ? String(v.ratePerShop) : "", farRatePerShop: v?.farRatePerShop != null ? String(v.farRatePerShop) : "", notes: v?.notes ?? "",
});

/** Only values that passed the server checks arrive from Zoho; whatever Zoho lacks (often the mobile) is left for the person to fill. */
const fromZoho = (z: ZohoVendorLookup["vendor"]): Partial<Form> => Object.fromEntries(
  Object.entries({ type: z.type, name: z.name, contactPerson: z.contactPerson, mobile: z.mobile, email: z.email, gstin: z.gstin, pan: z.pan, address: z.address, district: z.district }).filter(([, v]) => !!v),
) as Partial<Form>;

/**
 * Vendor registration / onboarding. A new vendor starts as "Pending KYC".
 * New vendor: type the Zoho vendor number to fill the form, add the KYC scans, save. Existing vendor: edit details only.
 */
export function VendorForm({ open, vendor, fromZohoContact, onClose }: { open: boolean; vendor?: Vendor | undefined; /** Zoho contact id of a row picked in the Zoho vendors list: its details are fetched as soon as the form opens. */ fromZohoContact?: string | undefined; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveVendor();
  const steps = vendor ? STEPS.filter((s) => s.key !== "documents") : STEPS;
  const { upload } = useKycFiles();
  const lookup = useLookupZohoVendor();
  const [zohoNo, setZohoNo] = useState("");
  const [zoho, setZoho] = useState<ZohoVendorLookup | null>(null);
  const [zohoError, setZohoError] = useState("");
  const [pending, setPending] = useState<PendingKyc>({});
  const [step, setStep] = useState(0);
  const key: StepKey = steps[step]!.key;
  const [f, setF] = useState<Form>(() => fromVendor(vendor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  function fetchZoho(by: { vendorNo: string } | { contactId: string } = { vendorNo: zohoNo }) {
    if ("vendorNo" in by && by.vendorNo.length < 2) return setZohoError("Enter the Zoho vendor number (at least 2 digits)");
    setZohoError("");
    setZoho(null);
    lookup.mutate(by, {
      onSuccess: (r) => {
        setZoho(r);
        if (r.vendorNo) setZohoNo(r.vendorNo);
        if (r.existing) return; // already registered: show who, fill nothing
        setF((s) => ({ ...s, ...fromZoho(r.vendor) }));
        setErrors({});
        toast(`Details of ${r.vendor.name} filled from Zoho. Please check them`);
      },
      onError: (e) => setZohoError(errorMessage(e)),
    });
  }

  const autoFetched = useRef(false);
  useEffect(() => {
    if (!fromZohoContact || vendor || autoFetched.current) return;
    autoFetched.current = true;
    fetchZoho({ contactId: fromZohoContact });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepErrors = (k: StepKey) => {
    const e: Record<string, string> = {};
    if (k === "business") {
      if (f.name.trim().length < 2) e.name = "Enter the vendor name";
      if (!f.mobile.trim()) e.mobile = "Enter the mobile number";
    }
    if (k === "rates") for (const k of ["ratePerShop", "farRatePerShop"] as const) if (f[k].trim() !== "" && !(Number(f[k]) >= 0)) e[k] = "Enter an amount";
    return e;
  };
  const next = () => { const e = stepErrors(key); setErrors(e); if (!Object.keys(e).length) setStep((s) => s + 1); };

  function submit() {
    const e = { ...stepErrors("business"), ...stepErrors("rates") };
    setErrors(e);
    if (Object.keys(e).length) { setStep(steps.findIndex((s) => (s.fields as readonly string[]).some((x) => x in e))); return; }
    const t = (s: string) => (s.trim() === "" ? undefined : s.trim());
    const body: VendorInput = {
      type: f.type, name: f.name.trim(), mobile: f.mobile.trim(),
      ...(t(f.contactPerson) ? { contactPerson: t(f.contactPerson) as string } : {}), ...(t(f.mobileAlt) ? { mobileAlt: t(f.mobileAlt) as string } : {}), ...(t(f.email) ? { email: t(f.email) as string } : {}),
      ...(t(f.address) ? { address: t(f.address) as string } : {}), ...(t(f.district) ? { district: t(f.district) as string } : {}), ...(t(f.pan) ? { pan: t(f.pan) as string } : {}), ...(t(f.gstin) ? { gstin: t(f.gstin) as string } : {}),
      ...(f.accountName.trim() || f.accountNo.trim() || f.ifsc.trim() ? { bank: { ...(t(f.accountName) ? { accountName: t(f.accountName) as string } : {}), ...(t(f.accountNo) ? { accountNo: t(f.accountNo) as string } : {}), ...(t(f.ifsc) ? { ifsc: t(f.ifsc) as string } : {}) } } : {}),
      serviceAreas: f.serviceAreas.split(/[,;]/).map((x) => x.trim()).filter(Boolean),
      ...(t(f.ratePerShop) ? { ratePerShop: Number(f.ratePerShop) } : {}), ...(t(f.farRatePerShop) ? { farRatePerShop: Number(f.farRatePerShop) } : {}), ...(t(f.notes) ? { notes: t(f.notes) as string } : {}),
      ...(!vendor && zoho && !zoho.existing ? { zohoContactId: zoho.contactId, zohoVendorNo: zoho.vendorNo } : {}),
    };
    save.mutate(
      { id: vendor?._id, body },
      {
        onSuccess: async (saved) => {
          const docs = (Object.entries(pending) as [KycKey, File[]][]).filter(([, files]) => files.length);
          const failed: string[] = [];
          for (const [docType, files] of docs) await upload.mutateAsync({ id: saved._id, docType, files }).catch(() => failed.push(docType.toUpperCase()));
          if (failed.length) toast(`Vendor registered, but the ${failed.join(", ")} document(s) did not upload. Open the vendor and upload them again`, "error");
          else toast(vendor ? "Vendor updated" : docs.length ? "Vendor registered with KYC documents. Check them, tick the checklist and activate" : "Vendor registered. Upload the KYC documents to activate them");
          onClose();
        },
        onError: (err) => {
          const fe = fieldErrorsOf(err);
          if (Object.keys(fe).length) {
            setErrors(fe);
            const s = steps.findIndex((st) => (st.fields as readonly string[]).some((x) => x in fe));
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
      description={`Step ${step + 1} of ${steps.length}: ${steps[step]!.title}`}
      className="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>{step === 0 ? "Cancel" : <><ArrowLeft className="size-4" aria-hidden /> Back</>}</Button>
          {step < steps.length - 1 ? (
            <Button className="bg-royal hover:bg-royal/90" onClick={next}>Next <ArrowRight className="size-4" aria-hidden /></Button>
          ) : (
            <Button className="bg-finance hover:bg-finance/90" loading={save.isPending || upload.isPending} onClick={submit}>{vendor ? "Save changes" : "Register vendor"}</Button>
          )}
        </div>
      }
    >
      <ol className={cn("mb-4 grid grid-cols-2 gap-2", steps.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")} aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button type="button" onClick={() => i <= step && setStep(i)} className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium", i === step ? "border-royal bg-[#e8f0ff] text-royal" : i < step ? "border-[#bbf0d3] bg-[#e7f9ef] text-finance" : "border-border text-muted-foreground")}>
              <s.icon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      {key === "business" && !vendor && (
        <section aria-label="Fetch from Zoho" className="mb-4 rounded-xl border border-[#cfe0ff] bg-gradient-to-br from-[#eef4ff] to-[#f7f0ff] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-royal text-white"><CloudDownload className="size-4" aria-hidden /></span>
            <div>
              <h3 className="text-sm font-bold text-navy">Already in Zoho Books?</h3>
              <p className="text-xs text-muted-foreground">Type the Zoho vendor number (for example 12543) and the form is filled for you. You can still change anything.</p>
            </div>
          </div>
          <form className="mt-3 flex flex-wrap items-start gap-2" onSubmit={(e) => { e.preventDefault(); fetchZoho(); }}>
            <div className="min-w-44 flex-1">
              <label htmlFor="zoho-no" className="sr-only">Zoho vendor number</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="zoho-no" format="digits" maxLength={8} value={zohoNo} onChange={(e) => { setZohoNo(e.target.value); setZohoError(""); }} placeholder="Zoho vendor number" className="pl-9" aria-invalid={!!zohoError} aria-describedby={zohoError ? "zoho-err" : undefined} />
              </div>
              {zohoError && <p id="zoho-err" role="alert" className="mt-1 text-xs text-loss">{zohoError}</p>}
            </div>
            <Button type="submit" className="bg-royal hover:bg-royal/90" loading={lookup.isPending} disabled={zohoNo.length < 2}>Fetch details</Button>
          </form>
          {zoho && !zoho.existing && (
            <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-[#bbf0d3] bg-[#f4fcf7] p-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-finance" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-navy">{zoho.vendor.name} <span className="font-normal text-muted-foreground">· Zoho no. {zoho.vendorNo}</span></p>
                <p className="text-xs text-muted-foreground">Filled from Zoho. {!zoho.vendor.mobile && "Zoho has no valid mobile number, please enter it. "}Check the details below and add the KYC documents.</p>
              </div>
            </div>
          )}
          {zoho?.existing && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-[#ffd8a8] bg-[#fff8ee] p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-approval" aria-hidden />
              <p><span className="font-semibold text-navy">{zoho.existing.name}</span> is already registered as <span className="font-semibold">{zoho.existing.code}</span>. Search for it in the vendor list instead of registering again.</p>
            </div>
          )}
        </section>
      )}
      {key === "business" && (
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
      {key === "kyc" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="PAN" htmlFor="v-pan" error={err("pan")} hint="e.g. ABCDE1234F"><Input id="v-pan" format="pan" value={f.pan} onChange={set("pan")} /></Field>
          <Field label="GST number" htmlFor="v-gst" error={err("gstin")} hint={f.type === "ORGANIZATION" ? "Needed for an organization" : "Optional for one-man vendors"}><Input id="v-gst" format="gst" value={f.gstin} onChange={set("gstin")} /></Field>
          <Field label="Account holder" htmlFor="v-ah" error={err("bank.accountName")}><Input id="v-ah" value={f.accountName} onChange={set("accountName")} /></Field>
          <Field label="Account number" htmlFor="v-an" error={err("bank.accountNo")}><Input id="v-an" format="account" value={f.accountNo} onChange={set("accountNo")} /></Field>
          <Field label="IFSC" htmlFor="v-ifsc" error={err("bank.ifsc")}><Input id="v-ifsc" format="ifsc" value={f.ifsc} onChange={set("ifsc")} /></Field>
          <p className="self-end rounded-lg bg-[#eef4ff] p-3 text-xs text-navy">After registering, tick each document in the vendor&apos;s KYC checklist once you have checked the originals. Then activate the vendor.</p>
        </div>
      )}
      {key === "documents" && (
        <KycDocuments
          type={f.type}
          pending={pending}
          onAdd={(k, files) => setPending((p) => ({ ...p, [k]: [...(p[k] ?? []), ...files] }))}
          onRemovePending={(k, i) => setPending((p) => ({ ...p, [k]: (p[k] ?? []).filter((_, j) => j !== i) }))}
        />
      )}
      {key === "rates" && (
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
