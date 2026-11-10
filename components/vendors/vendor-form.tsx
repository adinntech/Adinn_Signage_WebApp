"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, FileUp, IndianRupee, Mail, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useAddVendorType, useGstCheck, useKycFiles, usePincode, useSaveVendor, useVendorTypes, type KycDocKey, type KycFile, type Vendor, type VendorInput, type VendorType } from "@/lib/api/vendors";
import { KycDocuments, missingDocs, type PendingKyc } from "./kyc-documents";
import { gstinInfo } from "@/lib/gstin";
import { INDIA_STATES } from "@/lib/india-states";
import { isValidFormat } from "@/lib/input-format";
import { VendorRegistrationPanel } from "./vendor-registration-mail";
import { cn } from "@/lib/utils";

// The same three data steps for a new vendor and for editing one (a new vendor adds the mail step). Documents: a new vendor's files are uploaded right after it is saved; an existing vendor's files are uploaded as soon as they are picked.
const STEPS = [
  { key: "business", title: "Business details", icon: Building2, fields: ["typeName", "name", "contactPerson", "mobile", "mobileAlt", "email", "address", "district"] },
  { key: "kyc", title: "KYC & documents", icon: FileUp, fields: ["pan", "gstin", "bank.accountName", "bank.accountNo", "bank.ifsc", "documents"] },
  { key: "rates", title: "Service area & rates", icon: IndianRupee, fields: ["serviceAreas", "ratePerShop", "farRatePerShop", "notes"] },
  // New vendor only: after the vendor is saved, the registration request mail is written and sent in the same form.
  { key: "mail", title: "Registration mail", icon: Mail, fields: [] },
] as const;
const BUILT_IN: Record<VendorType, string> = { ORGANIZATION: "Organization", ONE_MAN: "One-man / Freelancer" };
const NEW_TYPE = "__new__";
type StepKey = (typeof STEPS)[number]["key"];

type Form = { typeName: string; typed: Record<"pan" | "gst" | "bank" | "aadhaar", boolean>; /** null until the person answers "Does the vendor have GST?"; then an organization defaults to yes. */ hasGst: boolean | null; name: string; contactPerson: string; designation: string; mobile: string; mobileAlt: string; email: string; address: string; pincode: string; state: string; district: string; aadhaar: string; pan: string; gstin: string; accountName: string; accountNo: string; ifsc: string; serviceAreas: string; ratePerShop: string; farRatePerShop: string; notes: string };
const fromVendor = (v?: Vendor): Form => ({
  typeName: v?.typeName ?? BUILT_IN[v?.type ?? "ONE_MAN"], typed: { pan: !!v?.pan, gst: !!v?.gstin, bank: !!v?.bank?.accountNo, aadhaar: !!v?.aadhaar }, hasGst: v ? (v.hasGst ?? !!v.gstin) : null, name: v?.name ?? "", contactPerson: v?.contactPerson ?? "", designation: v?.designation ?? "", mobile: v?.mobile ?? "", mobileAlt: v?.mobileAlt ?? "", email: v?.email ?? "", address: v?.address ?? "", pincode: v?.pincode ?? "", state: v?.state ?? "", district: v?.district ?? "", aadhaar: v?.aadhaar ?? "",
  pan: v?.pan ?? "", gstin: v?.gstin ?? "", accountName: v?.bank?.accountName ?? "", accountNo: v?.bank?.accountNo ?? "", ifsc: v?.bank?.ifsc ?? "",
  serviceAreas: (v?.serviceAreas ?? []).join(", "), ratePerShop: v?.ratePerShop != null ? String(v.ratePerShop) : "", farRatePerShop: v?.farRatePerShop != null ? String(v.farRatePerShop) : "", notes: v?.notes ?? "",
});

/**
 * Vendor registration / onboarding (new vendor) and edit (existing vendor): the same steps. A new vendor starts as
 * "Pending KYC"; after it is saved the registration request mail to Accounts opens. The form never closes by itself:
 * only Cancel / Close do, so a failed save keeps everything that was typed.
 */
export function VendorForm({ open, vendor, onClose }: { open: boolean; vendor?: Vendor | undefined; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveVendor();
  const { upload } = useKycFiles();
  const types = useVendorTypes();
  const addType = useAddVendorType();
  const [newType, setNewType] = useState<{ name: string; rules: VendorType; error: string } | null>(null);
  /** Set once a new vendor is saved: the form then edits that vendor and the mail step is for it. */
  const [created, setCreated] = useState<Pick<Vendor, "_id" | "name" | "code"> | null>(null);
  /** Quick registration: skip the optional details and the rates, only the basics, documents and the mail. */
  const [quick, setQuick] = useState(false);
  const vid = vendor?._id ?? created?._id;
  const [missing, setMissing] = useState<KycDocKey[]>([]);
  const [pending, setPending] = useState<PendingKyc>({});
  const [saved, setSaved] = useState<KycFile[]>(vendor?.kycFiles ?? []);
  const [busy, setBusy] = useState<KycDocKey | null>(null);
  const [step, setStep] = useState(0);
  const steps = STEPS.filter((s) => (s.key === "mail" ? !vendor : !(quick && s.key !== "business")));
  const key: StepKey = steps[Math.min(step, steps.length - 1)]!.key;
  const lastData = quick ? "business" : "rates";
  const [f, setF] = useState<Form>(() => fromVendor(vendor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set =(k: keyof Form) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const options = types.data ?? Object.entries(BUILT_IN).map(([rules, name]) => ({ _id: rules, name, rules: rules as VendorType }));
  const rules: VendorType = options.find((t) => t.name === f.typeName)?.rules ?? vendor?.type ?? "ONE_MAN";
  const org = rules === "ORGANIZATION";
  /** Does the vendor have GST? It decides the GST number and certificate (yes) or the Aadhaar number and card (no). */
  const hasGst = f.hasGst ?? org;
  /** A new vendor on the full form: every detail is mandatory. Quick registration and editing ask for less. */
  const strict = !quick && !vendor;
  // PAN, and the GST number (GST yes) or Aadhaar number (GST no), are typed and mandatory on the full form; the bank number is optional.
  const typedOpen = { pan: !quick && (strict || f.typed.pan), gst: hasGst, aadhaar: !quick && !hasGst && (strict || f.typed.aadhaar), bank: !quick && f.typed.bank };
  // The pincode fills the state and city. Only after the person typed a pincode, so an existing vendor's own values are never overwritten.
  const pinTyped = useRef(false);
  const pin = usePincode(f.pincode);
  useEffect(() => {
    const d = pin.data;
    if (pinTyped.current && d && d.pincode === f.pincode) setF((s) => ({ ...s, state: d.state, district: d.district }));
  }, [pin.data, f.pincode]);
  const pickType = (v: string) => (v === NEW_TYPE ? setNewType({ name: "", rules: "ONE_MAN", error: "" }) : setF((s) => ({ ...s, typeName: v })));

  function createType() {
    if (!newType) return;
    const name = newType.name.trim();
    if (name.length < 2) return setNewType({ ...newType, error: "Enter the type name" });
    addType.mutate({ name, rules: newType.rules }, {
      onSuccess: (t) => { setF((s) => ({ ...s, typeName: t.name })); setNewType(null); toast(`Vendor type "${t.name}" added`); },
      onError: (e) => setNewType({ ...newType, error: errorMessage(e) }),
    });
  }

  /** An existing vendor's document is uploaded the moment it is picked; a new vendor's waits until the vendor is saved. */
  function addDocs(k: KycDocKey, files: File[]) {
    setMissing((m) => m.filter((x) => x !== k));
    setErrors((x) => ({ ...x, documents: "" }));
    if (!vid) return setPending((p) => ({ ...p, [k]: [...(p[k] ?? []), ...files] }));
    setBusy(k);
    upload.mutate({ id: vid, docType: k, files }, { onSuccess: (v) => { setSaved(v.kycFiles ?? []); toast("Document uploaded"); }, onError: (e) => toast(errorMessage(e), "error"), onSettled: () => setBusy(null) });
  }

  const stepErrors = (k: StepKey) => {
    const e: Record<string, string> = {};
    if (k === "business") {
      if (f.name.trim().length < 2) e.name = "Enter the vendor name";
      if (!f.mobile.trim()) e.mobile = "Enter the phone number";
      if (f.email.trim() && !isValidFormat("email", f.email)) e.email = "Enter a valid email";
      if (strict) {
        if (!f.contactPerson.trim()) e.contactPerson = "Enter the contact person name";
        if (!f.designation.trim()) e.designation = "Enter the designation";
        if (!f.email.trim()) e.email = "Enter the email";
        if (!f.pincode.trim()) e.pincode = "Enter the pincode";
        else if (!isValidFormat("pincode", f.pincode)) e.pincode = "Enter a 6-digit pincode";
        if (!f.state.trim()) e.state = "Choose the state";
        if (!f.district.trim()) e.district = "Enter the city / district";
        if (!f.address.trim()) e.address = "Enter the address";
      }
    }
    if (k === "kyc") {
      if (hasGst && !f.gstin.trim()) e.gstin = "Enter the GST number";
      if (strict) {
        if (!f.pan.trim()) e.pan = "Enter the PAN number";
        else if (!isValidFormat("pan", f.pan)) e.pan = "Enter a valid PAN, e.g. ABCDE1234F";
        if (!hasGst) {
          if (!f.aadhaar.trim()) e.aadhaar = "Enter the Aadhaar number";
          else if (!isValidFormat("aadhaar", f.aadhaar)) e.aadhaar = "Aadhaar number must be 12 digits";
        }
      }
      // A new vendor's documents are uploaded after saving, so they are checked here. An existing vendor keeps what it has.
      if (!vid && !quick) { const m = missingDocs({ type: rules, hasGst }, [], pending); if (m.length) e.documents = `Upload: ${m.map((x) => x.label.split(" (")[0]).join(", ")}`; }
    }
    if (k === "rates") for (const k of ["ratePerShop", "farRatePerShop"] as const) if (f[k].trim() !== "" && !(Number(f[k]) >= 0)) e[k] = "Enter an amount";
    return e;
  };
  const stepOf = (errs: Record<string, string>) => STEPS.findIndex((s) => (s.fields as readonly string[]).some((x) => x in errs));
  const flagMissing = (e: Record<string, string>) => setMissing(e.documents ? missingDocs({ type: rules, hasGst }, [], pending).map((x) => x.key) : []);
  const next = () => { const e = stepErrors(key); setErrors(e); flagMissing(e); if (!Object.keys(e).length) setStep((s) => s + 1); };

  /** Saves the vendor (a new one once, then it is edited). `advance`: go on to the mail step afterwards. */
  function submit(advance = false) {
    const e = { ...stepErrors("business"), ...stepErrors("kyc"), ...(quick ? {} : stepErrors("rates")) };
    setErrors(e);
    flagMissing(e);
    if (Object.keys(e).length) { setStep(Math.max(steps.findIndex((s) => (s.fields as readonly string[]).some((x) => x in e)), 0)); return; }
    const t = (s: string) => (s.trim() === "" ? undefined : s.trim());
    const body: VendorInput = {
      type: rules, typeName: f.typeName, name: f.name.trim(), mobile: f.mobile.trim(),
      hasGst, ...(strict ? { fullDetails: true } : {}),
      ...(!quick && t(f.contactPerson) ? { contactPerson: t(f.contactPerson) as string } : {}), ...(!quick && t(f.designation) ? { designation: t(f.designation) as string } : {}), ...(!quick && t(f.mobileAlt) ? { mobileAlt: t(f.mobileAlt) as string } : {}), ...(!quick && t(f.email) ? { email: t(f.email) as string } : {}),
      ...(!quick && t(f.address) ? { address: t(f.address) as string } : {}), ...(!quick && t(f.pincode) ? { pincode: t(f.pincode) as string } : {}), ...(!quick && t(f.state) ? { state: t(f.state) as string } : {}), ...(!quick && t(f.district) ? { district: t(f.district) as string } : {}),
      ...(typedOpen.pan && t(f.pan) ? { pan: t(f.pan) as string } : {}), ...(typedOpen.gst && t(f.gstin) ? { gstin: t(f.gstin) as string } : {}), ...(typedOpen.aadhaar && t(f.aadhaar) ? { aadhaar: t(f.aadhaar) as string } : {}),
      ...(typedOpen.bank && (f.accountName.trim() || f.accountNo.trim() || f.ifsc.trim()) ? { bank: { ...(t(f.accountName) ? { accountName: t(f.accountName) as string } : {}), ...(t(f.accountNo) ? { accountNo: t(f.accountNo) as string } : {}), ...(t(f.ifsc) ? { ifsc: t(f.ifsc) as string } : {}) } } : {}),
      ...(quick ? {} : { serviceAreas: f.serviceAreas.split(/[,;]/).map((x) => x.trim()).filter(Boolean) }),
      ...(!quick && t(f.ratePerShop) ? { ratePerShop: Number(f.ratePerShop) } : {}), ...(!quick && t(f.farRatePerShop) ? { farRatePerShop: Number(f.farRatePerShop) } : {}), ...(!quick && t(f.notes) ? { notes: t(f.notes) as string } : {}),
    };
    save.mutate(
      { id: vid, body },
      {
        onSuccess: async (done) => {
          if (vendor) { toast("Vendor updated"); return onClose(); }
          const docs = (Object.entries(pending) as [KycDocKey, File[]][]).filter(([, files]) => files.length);
          const failed: string[] = [];
          let latest: KycFile[] | undefined;
          for (const [docType, files] of docs) await upload.mutateAsync({ id: done._id, docType, files }).then((v) => { latest = v.kycFiles; }).catch(() => failed.push(docType.toUpperCase()));
          setPending({});
          if (latest) setSaved(latest);
          toast(failed.length ? `Vendor saved, but the ${failed.join(", ")} document(s) did not upload. Add them in the mail step (Add Files) or go Back` : created ? "Vendor updated" : "Vendor saved. Now write and send the registration request mail", failed.length ? "error" : "success");
          setCreated({ _id: done._id, name: done.name, code: done.code });
          if (advance) setStep(steps.length - 1);
        },
        // Whatever the server says, the form stays open with everything typed; the step with the problem is shown.
        onError: (err) => {
          const fe = fieldErrorsOf(err);
          if (Object.keys(fe).length) {
            setErrors(fe);
            const s = stepOf(fe);
            if (s >= 0) setStep(s);
            toast(Object.values(fe)[0] ?? errorMessage(err), "error");
          } else toast(errorMessage(err), "error");
        },
      },
    );
  }

  const err = (k: string) => errors[k];
  const panField = <Field label="PAN number" htmlFor="v-pan" required={strict} error={err("pan")} hint="e.g. ABCDE1234F"><Input id="v-pan" format="pan" value={f.pan} onChange={set("pan")} /></Field>;
  const gst = gstinInfo(f.gstin);
  const gstCheck = useGstCheck(gst ? f.gstin.trim().toUpperCase() : "", !!gst);
  const known = gstCheck.data?.zoho ?? gstCheck.data?.registered ?? null;
  const portal = gstCheck.data?.portal;
  const gd = portal?.available ? portal.details : null;
  /** Fills the empty fields from the GST portal details (the name, address, pincode, state, city and PAN); what was typed is kept. */
  const fillFromGst = () => {
    if (!gd) return;
    pinTyped.current = false;
    setF((s) => ({
      ...s, name: s.name.trim() ? s.name : (gd.legalName ?? s.name), address: s.address.trim() ? s.address : (gd.address ?? s.address), pincode: s.pincode || gd.pincode || "",
      state: s.state || gd.state || "", district: s.district.trim() ? s.district : (gd.district ?? s.district), pan: s.pan || gd.pan || "", typed: { ...s.typed, pan: s.typed.pan || !!gd.pan },
    }));
  };
  const onGst = (e: { target: { value: string } }) => {
    const v = e.target.value;
    const info = gstinInfo(v);
    // The PAN is inside the GST number: fill it (and show it) unless one was typed already.
    setF((s) => ({ ...s, gstin: v, ...(info && !s.pan ? { pan: info.pan, typed: { ...s.typed, pan: true } } : {}) }));
  };
  const gstField = (
    <Field label="GST number" htmlFor="v-gst" required error={err("gstin")} hint="Required: the vendor has GST">
      <Input id="v-gst" format="gst" value={f.gstin} onChange={onGst} aria-invalid={!!err("gstin")} />
      {gst && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-[#eef4ff] p-2.5 text-xs" aria-label="Details from the GST number">
          <dt className="text-muted-foreground">State</dt><dd className="font-medium text-navy">{gst.state} ({gst.stateCode})</dd>
          <dt className="text-muted-foreground">PAN</dt><dd className="font-mono font-medium text-navy">{gst.pan}</dd>
          <dt className="text-muted-foreground">Business type</dt><dd className="font-medium text-navy">{gst.entity}</dd>
        </dl>
      )}
      {gst && gd && (
        <div role="status" aria-label="GST portal details" className={cn("mt-2 rounded-lg border p-2.5 text-xs", /^active$/i.test(gd.status ?? "") ? "border-[#bbf0d3] bg-[#f4fcf7]" : "border-loss bg-[#fff5f5]")}>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-navy">
            {gd.legalName ?? "Name not available"}
            {gd.status && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", /^active$/i.test(gd.status) ? "bg-[#e2f8ea] text-finance" : "bg-[#fde8e8] text-loss")}>{gd.status}</span>}
          </p>
          {gd.tradeName && gd.tradeName !== gd.legalName && <p className="text-muted-foreground">Trade name: {gd.tradeName}</p>}
          <p className="text-muted-foreground">{[gd.constitution, gd.taxpayerType, gd.registrationDate && `Registered ${gd.registrationDate}`].filter(Boolean).join(" · ")}</p>
          {gd.address && <p className="mt-0.5 text-muted-foreground">{gd.address}</p>}
          {gd.status && !/^active$/i.test(gd.status) && <p className="mt-1 font-medium text-loss">This GST registration is {gd.status}. Check before registering this vendor.</p>}
          <button type="button" className="mt-1 font-semibold text-royal hover:underline" onClick={fillFromGst}>Fill name, address and PAN from GST</button>
        </div>
      )}
      {gst && portal?.available && portal.error && <p role="status" className="mt-2 text-xs text-muted-foreground">GST portal: {portal.error}</p>}
      {gst && (
        <div role="status" className="mt-2 text-xs">
          {gstCheck.isPending ? <span className="text-muted-foreground">Checking the GST number…</span>
            : gstCheck.isError ? <span className="text-muted-foreground">Could not check this GST number now.</span>
            : known ? (
              <div className="rounded-lg border border-[#bbf0d3] bg-[#f4fcf7] p-2.5">
                <p className="font-semibold text-navy">{known.name}</p>
                <p className="text-muted-foreground">
                  {gstCheck.data?.zoho ? `In Zoho Books${gstCheck.data.zoho.vendorNo ? ` · Vendor ID ${gstCheck.data.zoho.vendorNo}` : ""}` : ""}
                  {gstCheck.data?.zoho && gstCheck.data?.registered ? " · " : ""}
                  {gstCheck.data?.registered ? `Registered here as ${gstCheck.data.registered.code}` : ""}
                </p>
                {gstCheck.data?.registered && !vendor && <p className="mt-1 font-medium text-approval">This GST number is already registered. Check before registering it again.</p>}
                {!f.name.trim() && <button type="button" className="mt-1 font-semibold text-royal hover:underline" onClick={() => setF((s) => ({ ...s, name: known.name }))}>Use this name</button>}
              </div>
            ) : <span className="text-muted-foreground">Not found in Zoho Books or the registered vendors.</span>}
        </div>
      )}
    </Field>
  );
  const bankFields = (
    <>
      <Field label="Account holder" htmlFor="v-ah" error={err("bank.accountName")}><Input id="v-ah" value={f.accountName} onChange={set("accountName")} /></Field>
      <Field label="Account number" htmlFor="v-an" error={err("bank.accountNo")}><Input id="v-an" format="account" value={f.accountNo} onChange={set("accountNo")} /></Field>
      <Field label="IFSC" htmlFor="v-ifsc" error={err("bank.ifsc")}><Input id="v-ifsc" format="ifsc" value={f.ifsc} onChange={set("ifsc")} /></Field>
    </>
  );
  const aadhaarField = <Field label="Aadhaar number" htmlFor="v-aadhaar" required={strict} error={err("aadhaar")} hint="12 digits"><Input id="v-aadhaar" format="aadhaar" value={f.aadhaar} onChange={set("aadhaar")} aria-invalid={!!err("aadhaar")} /></Field>;
  const toggle = (k: "pan" | "gst" | "bank" | "aadhaar") => (on: boolean) => setF((s) => ({ ...s, typed: { ...s.typed, [k]: on } }));

  return (
    <>
    <Modal
      persistent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={vendor ? `Edit ${vendor.name}` : "New vendor registration"}
      description={`Step ${Math.min(step, steps.length - 1) + 1} of ${steps.length}: ${steps[Math.min(step, steps.length - 1)]!.title}`}
      className={cn(key === "mail" ? "max-w-5xl" : "max-w-3xl")}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => (step === 0 ? onClose() : setStep(Math.min(step, steps.length - 1) - 1))}>{step === 0 ? "Cancel" : <><ArrowLeft className="size-4" aria-hidden /> Back</>}</Button>
          {key === "mail" ? (
            <Button className="bg-royal hover:bg-royal/90" onClick={onClose}>Done</Button>
          ) : key !== lastData ? (
            <Button className="bg-royal hover:bg-royal/90" onClick={next}>Next <ArrowRight className="size-4" aria-hidden /></Button>
          ) : (
            <Button className="bg-finance hover:bg-finance/90" loading={save.isPending || upload.isPending} onClick={() => submit(!vendor)}>{vendor ? "Save changes" : "Save & continue to mail"}</Button>
          )}
        </div>
      }
    >
      <ol className={cn("mb-4 grid grid-cols-1 gap-2", steps.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")} aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button type="button" onClick={() => i <= step && (key !== "mail" || i < step) && setStep(i)} className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium", i === step ? "border-royal bg-[#e8f0ff] text-royal" : i < step ? "border-[#bbf0d3] bg-[#e7f9ef] text-finance" : "border-border text-muted-foreground")}>
              <s.icon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      {key === "business" && !vendor && !created && (
        <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#cfe0ff] bg-gradient-to-br from-[#eef4ff] to-[#f7f0ff] p-3 has-[:checked]:border-royal">
          <input type="checkbox" className="mt-1 size-4" checked={quick} onChange={(e) => { setQuick(e.target.checked); setStep(0); }} />
          <span className="text-sm"><span className="flex items-center gap-1.5 font-semibold text-navy"><Zap className="size-4 text-royal" aria-hidden /> Quick registration</span><span className="text-xs text-muted-foreground">Give only the name, phone and whether the vendor has GST, and go straight to the mail. The documents are uploaded there and attached to it.</span></span>
        </label>
      )}
      {key === "business" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor type" htmlFor="v-type" error={err("typeName")}>
            <Select id="v-type" value={f.typeName} onChange={(e) => pickType(e.target.value)}>
              {options.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
              <option value={NEW_TYPE}>+ Add new type…</option>
            </Select>
          </Field>
          <Field label="Name of the company / firm" htmlFor="v-name" required error={err("name")}><Input id="v-name" value={f.name} onChange={set("name")} aria-invalid={!!err("name")} /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-navy">Does the vendor have GST? <span className="text-loss" aria-hidden>*</span></legend>
            <div className="flex flex-wrap gap-2">
              {([[true, "Yes, has GST", "GST number, PAN number, GST certificate, PAN card and cancelled cheque"], [false, "No GST", "PAN number, Aadhaar number, PAN card, Aadhaar card and cancelled cheque"]] as const).map(([v, label, hint]) => (
                <label key={label} className="flex min-w-60 flex-1 cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm has-[:checked]:border-royal has-[:checked]:bg-[#eef4ff]">
                  <input type="radio" name="v-hasgst" className="mt-1" checked={hasGst === v} onChange={() => setF((s) => ({ ...s, hasGst: v }))} />
                  <span><span className="block font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {quick && hasGst && gstField}
          {!quick && <Field label="Contact person name" htmlFor="v-cp" required={strict} error={err("contactPerson")}><Input id="v-cp" value={f.contactPerson} onChange={set("contactPerson")} aria-invalid={!!err("contactPerson")} /></Field>}
          {!quick && <Field label="Designation" htmlFor="v-desig" required={strict} error={err("designation")}><Input id="v-desig" maxLength={80} value={f.designation} onChange={set("designation")} aria-invalid={!!err("designation")} placeholder="e.g. Owner, Manager" /></Field>}
          <Field label="Phone" htmlFor="v-mobile" required error={err("mobile")}><Input id="v-mobile" format="phone" value={f.mobile} onChange={set("mobile")} aria-invalid={!!err("mobile")} /></Field>
          {!quick && <Field label="Alternate phone" htmlFor="v-alt" error={err("mobileAlt")}><Input id="v-alt" format="phone" value={f.mobileAlt} onChange={set("mobileAlt")} /></Field>}
          {!quick && <Field label="Email" htmlFor="v-email" required={strict} error={err("email")}><Input id="v-email" format="email" value={f.email} onChange={set("email")} aria-invalid={!!err("email")} /></Field>}
          {!quick && (
            <>
              <Field label="Pincode" htmlFor="v-pin" required={strict} error={err("pincode")} hint={pin.isFetching ? "Fetching the state and city…" : pin.isError && /^\d{6}$/.test(f.pincode) ? "Could not fetch the state and city. Choose them yourself." : pin.data ? "State and city filled from the pincode" : "6 digits: the state and city are filled from it"}>
                <Input id="v-pin" format="pincode" value={f.pincode} onChange={(e) => { pinTyped.current = true; set("pincode")(e); }} aria-invalid={!!err("pincode")} />
              </Field>
              <Field label="State" htmlFor="v-state" required={strict} error={err("state")}>
                <Select id="v-state" value={f.state} onChange={set("state")} aria-invalid={!!err("state")}>
                  <option value="">Select the state</option>
                  {f.state && !(INDIA_STATES as readonly string[]).includes(f.state) && <option value={f.state}>{f.state}</option>}
                  {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="City / district" htmlFor="v-district" required={strict} error={err("district")}><Input id="v-district" value={f.district} onChange={set("district")} aria-invalid={!!err("district")} /></Field>
              <Field label="Address" htmlFor="v-address" required={strict} error={err("address")} hint="Door number, street, area"><Input id="v-address" value={f.address} onChange={set("address")} aria-invalid={!!err("address")} /></Field>
            </>
          )}
        </div>
      )}

      {key === "kyc" && (
        <section aria-label="KYC documents">
          <p className="mb-2 text-sm text-muted-foreground">{hasGst ? "GST vendor: GST certificate, PAN card and cancelled cheque are required." : "Vendor without GST: PAN card, Aadhaar card and cancelled cheque are required."} The vendor agreement is optional (upload it under Vendor agreement / other documents).{!vendor && " Everything uploaded is attached to the registration mail to Accounts."}</p>
          <KycDocuments
            type={rules}
            hasGst={hasGst}
            {...(vid ? { vendorId: vid, saved } : {})}
            pending={pending}
            missing={missing}
            busy={busy}
            readOnly={vendor?.status === "BLACKLISTED"}
            typed={quick
              ? (hasGst ? { gst: { label: "GST number", open: true, locked: true, onToggle: toggle("gst"), children: gstField } } : {})
              : {
                  pan: { label: strict ? "PAN number" : "Type the PAN number too", open: typedOpen.pan, locked: strict, onToggle: toggle("pan"), children: panField },
                  ...(hasGst
                    ? { gst: { label: "GST number", open: true, locked: true, onToggle: toggle("gst"), children: gstField } }
                    : { aadhaar: { label: strict ? "Aadhaar number" : "Type the Aadhaar number too", open: typedOpen.aadhaar, locked: strict, onToggle: toggle("aadhaar"), children: aadhaarField } }),
                  bank: { label: "Type the account number and IFSC too", open: typedOpen.bank, onToggle: toggle("bank"), children: bankFields },
                }}
            onAdd={addDocs}
            onRemovePending={(k, i) => setPending((p) => ({ ...p, [k]: (p[k] ?? []).filter((_, j) => j !== i) }))}
          />
          {err("documents") && <p role="alert" className="mt-2 text-sm font-medium text-loss">{err("documents")}</p>}
        </section>
      )}

      {key === "mail" && created && <VendorRegistrationPanel vendor={created} />}

      {key === "rates" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service areas" htmlFor="v-areas" error={err("serviceAreas")} hint="Districts / areas, comma separated" className="sm:col-span-2"><Input id="v-areas" value={f.serviceAreas} onChange={set("serviceAreas")} placeholder="Madurai, Theni, Dindigul" /></Field>
          <Field label="Rate per shop (₹)" htmlFor="v-rate" error={err("ratePerShop")} hint="Blank = company rate"><Input id="v-rate" format="decimal" value={f.ratePerShop} onChange={set("ratePerShop")} /></Field>
          <Field label="Travelling cost per shop (₹)" htmlFor="v-far" error={err("farRatePerShop")} hint="Blank = company travelling cost"><Input id="v-far" format="decimal" value={f.farRatePerShop} onChange={set("farRatePerShop")} /></Field>
          <Field label="Notes" htmlFor="v-notes" className="sm:col-span-2"><Textarea id="v-notes" rows={2} value={f.notes} onChange={set("notes")} /></Field>
        </div>
      )}
    </Modal>
    <Modal
      persistent
      open={!!newType}
      onOpenChange={(o) => !o && setNewType(null)}
      title="Add vendor type"
      description="It appears in the Vendor type list for everyone."
      className="max-w-md"
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewType(null)}>Cancel</Button><Button className="bg-royal hover:bg-royal/90" loading={addType.isPending} onClick={createType}><Plus className="size-4" aria-hidden /> Add type</Button></div>}
    >
      {newType && (
        <div className="space-y-3">
          <Field label="Type name" htmlFor="nt-name" required error={newType.error}><Input id="nt-name" maxLength={60} value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value, error: "" })} placeholder="e.g. Partnership firm" /></Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-navy">Which rules should it follow?</legend>
            {([["ORGANIZATION", "Like an organization", "A company or firm"], ["ONE_MAN", "Like a one-man / freelancer", "An individual"]] as const).map(([v, label, hint]) => (
              <label key={v} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm has-[:checked]:border-royal has-[:checked]:bg-[#eef4ff]">
                <input type="radio" name="nt-rules" className="mt-1" checked={newType.rules === v} onChange={() => setNewType({ ...newType, rules: v })} />
                <span><span className="block font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </Modal>
    </>
  );
}
