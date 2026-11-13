"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart3, Building2, CalendarDays, ClipboardList, Copy, Download, Eye, History, ListChecks, Lock, Mail, MailCheck, MapPin, Phone, Plus, Save, ScrollText, Send, SkipForward, Trash2, UserRound } from "lucide-react";
import { z } from "zod";
import { normalizeMobile } from "@/components/clients/company-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/page-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { downloadFile, openFile, type FileSource } from "@/lib/api/files";
import { RATE_UNITS, rateCardFileName, useQuotation, useRateItems, useSaveQuotation, type QuotationState, type QuotationValues, type RateItem, type RateUnit, type Revision } from "@/lib/api/ratecards";
import { useSendEmail } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatCurrency, toDateInput } from "@/lib/format";
import { clearStepDraft, readStepDraft, writeStepDraft } from "@/lib/step-drafts";
import { cn } from "@/lib/utils";
import { EmailComposer } from "../email-composer";
import { EmailHistory } from "../email-history";
import { EditHistory } from "./edit-history";
import { QuotationPreview } from "./quotation-preview";
import { CompareRatesDialog, CopyFromMasterDialog } from "./rate-dialogs";

const UNITS = Object.keys(RATE_UNITS) as [RateUnit, ...RateUnit[]];
const email = (v: string) => z.email().safeParse(v).success;

const line = z
  .object({
    masterItemId: z.string().nullable().optional(),
    particulars: z.string().trim().min(1, "Enter the particulars").max(150),
    specifications: z.string().trim().max(300),
    unit: z.enum(UNITS, { error: "Choose a unit" }),
    masterRate: z.number().nullable().optional(),
    quotedRate: z.number({ error: "Enter the quoted rate" }).positive("Must be greater than 0").max(100000000),
    overrideReason: z.string().trim().max(300),
  })
  .superRefine((l, ctx) => {
    if (l.masterRate != null && l.quotedRate !== l.masterRate && !l.overrideReason)
      ctx.addIssue({ code: "custom", path: ["overrideReason"], message: "Reason required: differs from master rate" });
  });

const schema = z.object({
  clientAddress: z.string().trim().max(500),
  contact: z.object({ name: z.string().trim().min(1, "Select the contact person"), designation: z.string(), phone: z.string(), email: z.string() }),
  quotationDate: z.string().min(1, "Enter the quotation date"),
  items: z.array(line).min(1, "Add at least one signage item").max(100),
  terms: z.string(),
  regards: z.object({
    name: z.string().trim().min(1, "Enter the client service name"),
    designation: z.string().trim(),
    mobile: z.string().trim().refine((v) => /^[6-9]\d{9}$/.test(normalizeMobile(v)), "Enter a 10-digit mobile number"),
    email: z.string().trim().refine(email, "Enter a valid email address"),
  }),
});
type FormValues = z.infer<typeof schema>;
/** Client Servicing rate cards (Rate Card step, Rate Card Creation): the contact person is optional. */
const csSchema = schema.extend({ contact: schema.shape.contact.extend({ name: z.string().trim().max(120) }) });

/**
 * `typedContact` (Rate Card step): the contact is typed; a new rate card starts with the name of the order's primary
 * contact person (the Zoho client's, else the one saved in Assign Type & Details; from the server's draft), editable.
 * Same step: a saved Bill To that is empty or only the city (the earlier default) starts as the full address instead;
 * an address typed by the user is kept.
 */
function toForm(d: QuotationState, typedContact = false): FormValues {
  const src = d.latest ?? d.draft!;
  // New rate card: the point of contact's name and phone (Kind Attn), both editable.
  const contact = typedContact && !d.latest ? { name: src.contact?.name ?? "", designation: "", phone: src.contact?.phone ?? "", email: "" } : src.contact;
  const saved = (src.clientAddress ?? "").trim();
  const full = d.billTo?.full;
  const cityOnly = !saved || saved.toLowerCase() === (d.billTo?.city ?? "").trim().toLowerCase();
  return {
    clientAddress: full && cityOnly ? full : (src.clientAddress ?? ""),
    contact: { name: contact?.name ?? "", designation: contact?.designation ?? "", phone: contact?.phone ?? "", email: contact?.email ?? "" },
    quotationDate: toDateInput(src.quotationDate) || toDateInput(new Date().toISOString()),
    items: (src.items ?? []).map((i) => ({
      masterItemId: "masterItem" in i ? (i.masterItem ?? null) : ((i as { masterItemId?: string | null }).masterItemId ?? null),
      particulars: i.particulars,
      specifications: i.specifications ?? "",
      unit: i.unit,
      masterRate: i.masterRate ?? null,
      quotedRate: i.quotedRate,
      overrideReason: i.overrideReason ?? "",
    })),
    terms: src.terms ?? "",
    regards: { name: src.regards?.name ?? "", designation: src.regards?.designation ?? "", mobile: src.regards?.mobile ?? "", email: src.regards?.email ?? "" },
  };
}

const toApi = (v: FormValues): QuotationValues => ({
  clientAddress: v.clientAddress || undefined,
  contact: { name: v.contact.name, designation: v.contact.designation || undefined, phone: v.contact.phone || undefined, email: v.contact.email || undefined },
  quotationDate: v.quotationDate,
  items: v.items.map((i) => ({ ...i, specifications: i.specifications || undefined, overrideReason: i.overrideReason || undefined, masterItemId: i.masterItemId || undefined })),
  terms: v.terms,
  regards: { ...v.regards, mobile: normalizeMobile(v.regards.mobile) },
});

/** Today in India (Asia/Kolkata), YYYY-MM-DD: the date a new Rate Card step version gets (set on the server). */
const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

type BottomTab = "history" | "send" | "emails";

function Editor({ data, orderId, withEmail, step }: { data: QuotationState; orderId: string; withEmail: boolean; step?: RateCardStepProps }) {
  const toast = useToast();
  const { can } = useAuth();
  // Rate Card step: saved through the Client Servicing flow (the server checks who may save).
  const editable = data.editable && (!!step || can("sales:write"));
  const save = useSaveQuotation(orderId, step ? "recce/rate-card" : "rate-card");
  // Rate Card Creation: its own PDFs and save; an order's rate card otherwise.
  const source: FileSource = step?.source ?? { orderId };
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  // Download / Preview of the saved PDF: which one is running, and what to say when there is nothing saved yet.
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
  const savedPdf = data.latest?.pdf?.fileId ?? null;
  const runPdf = async (kind: "download" | "preview") => {
    if (!savedPdf || !data.latest) return toast("Save the rate card first: its PDF is generated when it is saved.", "info");
    setPdfBusy(kind);
    try {
      if (kind === "download") {
        const file = rateCardFileName(step?.clientName ?? data.clientName);
        await downloadFile(savedPdf, source, file, file);
      }
      else await openFile(savedPdf, source);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPdfBusy(null);
    }
  };
  const send = useSendEmail(orderId, "RATE_CARD");
  const [copyOpen, setCopyOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [tab, setTab] = useState<BottomTab>("history");
  const bottomRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(step ? csSchema : schema), defaultValues: toForm(data, !!step), mode: "onTouched" });
  const { register, control, handleSubmit, reset, setValue, setError, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control }) as FormValues;
  const dirty = formState.isDirty;
  useUnsavedWarning(dirty);

  const latestId = data.latest?._id;
  useEffect(() => {
    reset(toForm(data, !!step));
    // Reset only when a new revision arrives, not on every refetch of the same data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId, reset]);

  // Create Project Rate Card step: unsaved edits are kept while another step of the drawer is open (Previous / Next)
  // and come back here; a newer saved version, or a save, drops them.
  const draftKey = step && !step.save && orderId ? `${orderId}:ratecard` : null;
  const savedRef = useRef(false);
  useEffect(() => {
    if (!draftKey) return;
    const kept = readStepDraft<{ latestId: string | null; values: FormValues }>(draftKey);
    if (kept && kept.latestId === (data.latest?._id ?? null)) {
      seeded.current = true;
      reset(kept.values, { keepDefaultValues: true });
    }
    return () => {
      if (!savedRef.current && form.formState.isDirty) writeStepDraft(draftKey, { latestId: data.latest?._id ?? null, values: form.getValues() });
      else clearStepDraft(draftKey);
    };
    // Once per opening of the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rate Card step, new rate card: the contact name of a draft read later (e.g. refetched after contacts were saved in
  // Assign Type & Details) fills an untouched, empty Contact Person; a typed or saved name is never overwritten.
  const draftContact = !data.latest ? (data.draft?.contact?.name ?? "") : "";
  const draftPhone = !data.latest ? (data.draft?.contact?.phone ?? "") : "";
  useEffect(() => {
    if (!step || data.latest) return;
    // Untouched (not dirty) means it still holds a prefill: a newer point of contact (refetched after the POC contacts
    // were saved, no page refresh needed) replaces it.
    if (draftContact && !form.getFieldState("contact.name").isDirty && form.getValues("contact.name") !== draftContact) form.resetField("contact.name", { defaultValue: draftContact });
    // The phone the same way (shown after the name in Kind Attn).
    if (draftPhone && !form.getFieldState("contact.phone").isDirty && form.getValues("contact.phone") !== draftPhone) form.resetField("contact.phone", { defaultValue: draftPhone });
  }, [step, data.latest, draftContact, draftPhone, form]);

  // Rate Card step, saved version: the point of contact changed in Assign Type & Details since. Once per opening, the
  // new contact replaces the saved one as an UNSAVED change (preview updates; Save & Continue makes the next version),
  // only while the fields still hold the saved contact. "Keep" puts the saved contact back.
  const poc = step && data.editable ? (data.pocUpdate ?? null) : null;
  const [pocNotice, setPocNotice] = useState(false);
  /** "Keep" was clicked: the saved contact stays for this opening. */
  const [keptSaved, setKeptSaved] = useState(false);
  // The contact this effect filled last: a newer point of contact (the rate card data is refetched after the POC
  // contacts are saved, without a page refresh) may replace it, as it may replace the saved contact. Applying again
  // after a form reset (mount, React's dev double-run) is harmless; a name the person typed is never touched.
  const autoPoc = useRef<{ name: string; phone: string } | null>(null);
  const pocName = poc?.name ?? null;
  const pocPhone = poc?.phone ?? null;
  useEffect(() => {
    if (!step || !data.latest || keptSaved) return;
    const same = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
    const cur = form.getValues("contact.name");
    const auto = autoPoc.current;
    const untouched = same(cur, data.latest.contact?.name) || (!!auto && same(cur, auto.name) && same(form.getValues("contact.phone"), auto.phone));
    if (!untouched) {
      // Typed by the person (or a kept draft): left alone; the notice still explains a matching new contact.
      if (pocName && same(cur, pocName)) setPocNotice(true);
      return;
    }
    if (pocName) {
      if (!same(cur, pocName) || !same(form.getValues("contact.phone"), pocPhone)) {
        setValue("contact.name", pocName, { shouldDirty: true });
        setValue("contact.phone", pocPhone ?? "", { shouldDirty: true });
      }
      autoPoc.current = { name: pocName, phone: pocPhone ?? "" };
      setPocNotice(true);
    } else if (auto) {
      // The point of contact is the saved one again: back to the saved contact.
      setValue("contact.name", data.latest.contact?.name ?? "", { shouldDirty: true });
      setValue("contact.phone", data.latest.contact?.phone ?? "", { shouldDirty: true });
      autoPoc.current = null;
      setPocNotice(false);
    }
  }, [step, pocName, pocPhone, data.latest, keptSaved, form, setValue]);
  const keepSavedContact = () => {
    setKeptSaved(true);
    setValue("contact.name", data.latest?.contact?.name ?? "", { shouldDirty: true });
    setValue("contact.phone", data.latest?.contact?.phone ?? "", { shouldDirty: true });
    setPocNotice(false);
  };

  // Rate Card step, new rate card: every master rate (Rate Card Management) is loaded once as the starting lines, as
  // the form's defaults. A saved rate card keeps its own lines and rates (never reloaded from the master).
  // Seeded from a fresh read (not an older cached list), so the latest master prices are used.
  const master = useRateItems({ limit: 500 }, !!step && !data.latest);
  const seeded = useRef(false);
  useEffect(() => {
    if (!step || data.latest || seeded.current || !master.data || !master.isFetchedAfterMount || form.getValues("items").length) return;
    seeded.current = true;
    reset({
      ...form.getValues(),
      items: master.data.data.map((r) => ({ masterItemId: r._id, particulars: r.particulars, specifications: r.specifications ?? "", unit: r.unit, masterRate: r.rate, quotedRate: r.rate, overrideReason: "" })),
    });
  }, [step, data.latest, master.data, master.isFetchedAfterMount, form, reset]);

  // Rate Card step: a new version is dated today (IST); the saved one shows its own date.
  const previewValues = useMemo(() => {
    const v = toApi({ ...watched, items: (watched.items ?? []).map((i) => ({ ...i, quotedRate: Number(i?.quotedRate) || 0 })) } as FormValues);
    return step && (dirty || !data.latest) ? { ...v, quotationDate: todayIst() } : v;
  }, [watched, step, dirty, data.latest]);
  const e = (p: string) =>
    (p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], formState.errors) as { message?: string } | undefined)?.message;

  const goBottom = (t: BottomTab) => {
    setTab(t);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const onSave = handleSubmit(
    async (v) => {
      if (saving) return;
      setSaving(true);
      try {
        const r = step?.save ? await step.save(toApi(v)) : await save.mutateAsync(toApi(v));
        if (r.saved) toast(`Rate card saved as ${r.revision.label}. PDF generated.`);
        else toast("No changes since the last saved revision.", "info");
        savedRef.current = true;
        if (draftKey) clearStepDraft(draftKey);
        step?.onContinue?.();
      } catch (err) {
        const fe = fieldErrorsOf(err);
        for (const [path, message] of Object.entries(fe)) setError(path as FieldPath<FormValues>, { message });
        toast(errorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    },
    () => toast("Fix the highlighted fields before saving.", "error"),
  );

  const addFromMaster = (items: RateItem[]) => {
    for (const r of items) append({ masterItemId: r._id, particulars: r.particulars, specifications: r.specifications ?? "", unit: r.unit, masterRate: r.rate, quotedRate: r.rate, overrideReason: "" });
    toast(`${items.length} item${items.length === 1 ? "" : "s"} copied from the master rate card`);
  };

  // Editor actions: below the editor, or (Client Servicing Rate Card step) in a sticky bar under its heading.
  /** Skip Rate Card: the request email goes without a rate card; unsaved edits are not saved (and never attached). */
  const onSkip = async () => {
    if (!step?.onSkip || skipping) return;
    if (dirty && !window.confirm("Skip the rate card? Your unsaved edits here are not saved, and no rate card goes with the request email.")) return;
    setSkipping(true);
    try {
      savedRef.current = true;
      if (draftKey) clearStepDraft(draftKey);
      await step.onSkip();
    } catch (err) {
      savedRef.current = false;
      toast(errorMessage(err), "error");
    } finally {
      setSkipping(false);
    }
  };

  // Create Project > Recce Team > Rate Card and Rate Card Creation: the save button (Save & Continue / Save Changes)
  // sits at the bottom right of the editor, below Quote & Contact, instead of in the top toolbar.
  const bottomSave = !!step;
  const saveButton = editable && (
    <Button variant="brand" onClick={onSave} loading={saving}>
      <Save className="size-4" aria-hidden /> {step?.onContinue ? "Save & Continue" : "Save Changes"}
    </Button>
  );
  const actions = (
    <>
      {!bottomSave && saveButton}
      {step?.onSkip && (
        <Button variant="outline" onClick={() => void onSkip()} loading={skipping} disabled={saving}>
          <SkipForward className="size-4" aria-hidden /> Skip Rate Card
        </Button>
      )}
      <Button
        variant="brand-outline"
        loading={pdfBusy === "download"}
        title={!savedPdf ? "Save the rate card first to generate its PDF" : dirty ? `Downloads saved version ${data.latest?.label}; save to include your changes` : undefined}
        onClick={() => void runPdf("download")}
      >
        <Download className="size-4" aria-hidden /> Download PDF
      </Button>
      <Button
        variant="outline"
        loading={pdfBusy === "preview"}
        title={!savedPdf ? "Save the rate card first to generate its PDF" : dirty ? `Opens saved version ${data.latest?.label}; save to include your changes` : undefined}
        onClick={() => void runPdf("preview")}
      >
        <Eye className="size-4" aria-hidden /> Preview PDF
      </Button>
      <Button variant="outline" onClick={() => setCompareOpen(true)} disabled={!watched.items?.length}>
        <BarChart3 className="size-4" aria-hidden /> Compare Rates
      </Button>
      {withEmail && can("sales:write") && (
        <Button variant="outline" onClick={() => goBottom("send")} disabled={!data.latest}>
          <Send className="size-4" aria-hidden /> Send Email
        </Button>
      )}
      <Button variant="outline" onClick={() => goBottom("history")}>
        <History className="size-4" aria-hidden /> View Edit History
      </Button>
      {withEmail && (
        <Button variant="outline" onClick={() => goBottom("emails")}>
          <MailCheck className="size-4" aria-hidden /> View Email History
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="xl:sticky xl:top-0 xl:h-[max(600px,calc(100dvh-17rem))]">
          <QuotationPreview orderId={orderId} source={source} values={previewValues} quotationRef={data.quotationRef} clientName={step?.clientName ?? data.clientName} company={data.company} latest={data.latest} dirty={dirty} fitWidth={!!step} />
        </div>

        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-primary">Rate Card Editor</h2>
              <p className="text-xs text-muted-foreground">Update client details, signage items, pricing and terms. Changes reflect in the PDF preview.</p>
            </div>
            {!data.editable ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground" title={data.lockedReason ?? undefined}>
                <Lock className="size-3.5" aria-hidden /> Locked
              </span>
            ) : data.latest && !step && data.leadStage !== "RATE_CARD" ? (
              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">Negotiation in progress · {data.latest.label}</span>
            ) : data.latest ? (
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Saved · {data.latest.label}</span>
            ) : (
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Not saved yet</span>
            )}
          </div>

          {step && (
            // Stays at the top of the drawer while the fields scroll (opaque, so fields pass under it, not through it).
            <div role="toolbar" aria-label="Rate card actions" className="sticky top-0 z-10 -mx-5 -mt-2 mb-5 flex flex-wrap gap-2 border-b border-border bg-surface px-5 py-3 sm:-mx-6 sm:px-6">
              {actions}
            </div>
          )}
          {data.lockedReason && <p className="-mt-2 mb-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{data.lockedReason}</p>}
          {/* min-w-0: a fieldset is min-content wide by default, which pushed the fields past the card edge. */}
          <fieldset disabled={!editable} className="min-w-0 space-y-6">
            <section>
              <SectionTitle icon={ClipboardList} title="Client & Quotation Details" />
              {pocNotice && poc && (
                <div role="status" className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 px-4 py-3 text-sm">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground">Point of contact changed in Assign Type &amp; Details</span>
                    <span className="block text-muted-foreground">
                      {poc.previousName || "(none)"} → <b className="text-foreground">{poc.name}</b>. Contact Person and Contact Phone are updated (not saved yet). Save &amp; Continue to create the next version; {data.latest?.label} stays in the history.
                    </span>
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={keepSavedContact}>
                    Keep {poc.previousName || "saved contact"}
                  </Button>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {step?.company ? (
                  // Rate Card Creation: the Zoho company picker; choosing fills the contact person and address (editable).
                  step.company((d) => {
                    setValue("contact.name", d?.contactName ?? "", { shouldDirty: true, shouldValidate: !!d });
                    setValue("clientAddress", d?.address ?? "", { shouldDirty: true });
                  })
                ) : (
                <Field label={step ? "Company Name" : "Client Name"} htmlFor="rc-client" hint="Auto-filled">
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input id="rc-client" value={data.clientName} readOnly className="pl-9" />
                  </div>
                </Field>
                )}
                <Field label="Contact Person" htmlFor="rc-contact" required={!step} hint={step ? "Optional: shown as Kind Attn on the PDF" : undefined} error={e("contact.name")}>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    {/* Rate Card step: typed (saved with this rate card for "Kind Attn"; not a Zoho contact). */}
                    {step ? (
                      <Input id="rc-contact" className="pl-9" placeholder="Contact person's name (optional)" aria-invalid={!!e("contact.name")} {...register("contact.name")} />
                    ) : (
                    <Select
                      id="rc-contact"
                      className="pl-9"
                      aria-invalid={!!e("contact.name")}
                      value={watched.contact?.name ?? ""}
                      onChange={(ev) => {
                        const k = data.contacts.find((c) => c.name === ev.target.value);
                        setValue("contact", { name: k?.name ?? "", designation: k?.designation ?? "", phone: k?.phone ?? "", email: k?.email ?? "" }, { shouldDirty: true, shouldValidate: true });
                      }}
                    >
                      <option value="">Select contact</option>
                      {data.contacts.map((c, i) => (
                        <option key={`${c.name}-${i}`} value={c.name}>
                          {c.name}
                          {c.designation ? ` (${c.designation})` : ""}
                        </option>
                      ))}
                      {watched.contact?.name && !data.contacts.some((c) => c.name === watched.contact?.name) && <option value={watched.contact.name}>{watched.contact.name} (saved)</option>}
                    </Select>
                    )}
                  </div>
                </Field>
                {/* Rate Card step: the contact person's phone (auto-filled; shown after the name in Kind Attn on the PDF). */}
                {step && (
                  <Field label="Contact Phone" htmlFor="rc-contact-phone" hint="Optional: shown after the contact person on the PDF" error={e("contact.phone")}>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="rc-contact-phone"
                        className="pl-9 tabular-nums"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="10-digit mobile (optional)"
                        aria-invalid={!!e("contact.phone")}
                        {...register("contact.phone", { onChange: (ev) => form.setValue("contact.phone", String(ev.target.value).replace(/\D/g, "").slice(0, 10)) })}
                      />
                    </div>
                  </Field>
                )}
                {/* Rate Card step: no date input; each new version is dated today (IST) when it is saved. */}
                {!step && (
                <Field label="Quotation Date" htmlFor="rc-date" required error={e("quotationDate")}>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input id="rc-date" type="date" className="pl-9" aria-invalid={!!e("quotationDate")} {...register("quotationDate")} />
                  </div>
                </Field>
                )}
                <Field label="Bill To (City / Address)" htmlFor="rc-address" error={e("clientAddress")} className={step ? "md:col-span-2" : undefined}>
                  <div className="relative">
                    <MapPin className={cn("pointer-events-none absolute left-3 size-4 text-muted-foreground", step ? "top-3" : "top-1/2 -translate-y-1/2")} aria-hidden />
                    {/* Rate Card step: the full address, wrapping. */}
                    {step ? (
                      <Textarea id="rc-address" rows={3} maxLength={500} className="min-h-20 pl-9" aria-invalid={!!e("clientAddress")} {...register("clientAddress")} />
                    ) : (
                      <Input id="rc-address" className="pl-9" {...register("clientAddress")} />
                    )}
                  </div>
                </Field>
              </div>
            </section>

            <section>
              <SectionTitle
                icon={ListChecks}
                title="Signage Items & Pricing"
                description={step ? undefined : "Copy from the master rate card and adjust quoted rates. A reason is required when the quoted rate differs from the master rate."}
                action={
                  step ? undefined : (
                    <Button type="button" variant="brand-outline" size="sm" onClick={() => setCopyOpen(true)}>
                      <Copy className="size-4" aria-hidden /> Copy From Master Rate Card
                    </Button>
                  )
                }
              />
              {typeof formState.errors.items?.message === "string" && (
                <p role="alert" className="mb-2 text-sm text-danger">
                  {formState.errors.items.message}
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-10 px-2 py-2.5">#</th>
                      <th className="px-2 py-2.5">Signage Particulars *</th>
                      <th className="px-2 py-2.5">Specifications</th>
                      <th className="w-32 px-2 py-2.5">Rate Unit *</th>
                      <th className="w-28 px-2 py-2.5 text-right">Master Rate (₹)</th>
                      <th className="w-32 px-2 py-2.5">Quoted Rate (₹)*</th>
                      <th className="px-2 py-2.5">Reason for Amount Override</th>
                      <th className="w-12 px-2 py-2.5">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          {step ? (master.isFetching ? "Loading the rates from Rate Card Management…" : "No items yet. Add a custom item.") : "No items yet. Copy from the master rate card or add a custom item."}
                        </td>
                      </tr>
                    )}
                    {fields.map((f, i) => {
                      const it = watched.items?.[i];
                      const differs = it?.masterRate != null && Number(it.quotedRate) !== it.masterRate;
                      return (
                        <tr key={f.id} className="align-top">
                          <td className="px-2 py-2 pt-4 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-2">
                            <Input aria-label={`Particulars ${i + 1}`} aria-invalid={!!e(`items.${i}.particulars`)} {...register(`items.${i}.particulars`)} />
                            {e(`items.${i}.particulars`) && <p className="mt-1 text-xs text-danger">{e(`items.${i}.particulars`)}</p>}
                          </td>
                          <td className="px-2 py-2">
                            <Input aria-label={`Specifications ${i + 1}`} {...register(`items.${i}.specifications`)} />
                          </td>
                          <td className="px-2 py-2">
                            <Select aria-label={`Rate unit ${i + 1}`} {...register(`items.${i}.unit`)}>
                              {UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {RATE_UNITS[u]}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-2 pt-4 text-right tabular-nums text-muted-foreground">{it?.masterRate != null ? formatCurrency(it.masterRate) : <span className="text-xs">Custom</span>}</td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              aria-label={`Quoted rate ${i + 1}`}
                              aria-invalid={!!e(`items.${i}.quotedRate`)}
                              className={cn("text-right tabular-nums", differs && "border-warning bg-warning-soft/40")}
                              {...register(`items.${i}.quotedRate`, { valueAsNumber: true })}
                            />
                            {e(`items.${i}.quotedRate`) && <p className="mt-1 text-xs text-danger">{e(`items.${i}.quotedRate`)}</p>}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              aria-label={`Override reason ${i + 1}`}
                              placeholder={differs ? "Required" : ""}
                              aria-invalid={!!e(`items.${i}.overrideReason`)}
                              {...register(`items.${i}.overrideReason`, { deps: [`items.${i}.quotedRate`] })}
                            />
                            {e(`items.${i}.overrideReason`) && <p className="mt-1 text-xs text-danger">{e(`items.${i}.overrideReason`)}</p>}
                          </td>
                          <td className="px-2 py-2 pt-3">
                            <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${i + 1}`} onClick={() => remove(i)}>
                              <Trash2 className="size-4 text-danger" aria-hidden />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                variant="brand-outline"
                size="sm"
                className="mt-3"
                onClick={() => append({ masterItemId: null, particulars: "", specifications: "", unit: "SQFT", masterRate: null, quotedRate: Number.NaN, overrideReason: "" })}
              >
                <Plus className="size-4" aria-hidden /> Add Item
              </Button>
            </section>

            <div className="grid gap-6 2xl:grid-cols-2">
              <section>
                <SectionTitle icon={ScrollText} title="Terms & Conditions" />
                <Controller
                  control={control}
                  name="terms"
                  render={({ field }) => <RichTextEditor id="rc-terms" ariaLabel="Terms and conditions" value={field.value} onChange={field.onChange} disabled={!editable} minHeight={140} />}
                />
              </section>
              <section>
                <SectionTitle icon={UserRound} title="Quote & Contact" description="Client Service details printed on the rate card." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Client Service" htmlFor="rc-rname" required error={e("regards.name")} className="sm:col-span-2">
                    <Input id="rc-rname" aria-invalid={!!e("regards.name")} {...register("regards.name")} />
                  </Field>
                  <Field label="Email ID" htmlFor="rc-remail" required error={e("regards.email")}>
                    <Input id="rc-remail" type="email" aria-invalid={!!e("regards.email")} {...register("regards.email")} />
                  </Field>
                  <Field label="Phone Number" htmlFor="rc-rmob" required error={e("regards.mobile")}>
                    <Input id="rc-rmob" inputMode="numeric" maxLength={10} aria-invalid={!!e("regards.mobile")} {...register("regards.mobile")} />
                  </Field>
                </div>
              </section>
            </div>
          </fieldset>

          {!step && <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">{actions}</div>}
          {bottomSave && saveButton && (
            // Sticky action bar: Save & Continue stays visible at the bottom of the scroll area while the fields scroll
            // (opaque, flush with the card edges, so fields pass under it; it rests at the card bottom at the end).
            <div role="toolbar" aria-label="Save rate card" className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-6 flex justify-end rounded-b-lg border-t border-border bg-surface px-5 py-3 shadow-[0_-4px_12px_-6px_rgba(16,36,73,0.15)] sm:-mx-6 sm:-mb-6 sm:px-6">
              {saveButton}
            </div>
          )}
        </Card>
      </div>

      <div ref={bottomRef} className="scroll-mt-4">
        <Card className="p-5 sm:p-6">
          <Tabs
            idPrefix="rc-bottom"
            className="mb-5"
            value={tab}
            onChange={setTab}
            items={[
              { key: "history", label: "Edit History", icon: History },
              ...(withEmail && can("sales:write") ? [{ key: "send" as const, label: "Email Sending", icon: Mail }] : []),
              ...(withEmail ? [{ key: "emails" as const, label: "Email History", icon: MailCheck }] : []),
            ]}
          />
          <div id="rc-bottom-panel" role="tabpanel">
            {tab === "history" && <EditHistory orderId={orderId} source={source} revisions={data.revisions} />}
            {tab === "send" &&
              (data.latest && data.emailDraft ? (
                <>
                  {dirty && <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">You have unsaved edits. The email attaches saved revision {data.latest.label}; save first to send the revised PDF.</p>}
                  <EmailComposer
                    orderId={orderId}
                    key={data.latest._id}
                    idPrefix="rc-mail"
                    from={data.from}
                    mailEnabled={data.mailEnabled}
                    draft={data.emailDraft}
                    attachments={data.latest.pdf ? [data.latest.pdf] : []}
                    attachmentLabel={`Current PDF revision ${data.latest.label} (auto attached)`}
                    sending={send.isPending}
                    onSend={async (v) => {
                      const r = await send.mutateAsync(v);
                      setTab("emails");
                      return r;
                    }}
                  />
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Save the rate card first. The saved revision&apos;s PDF is attached to the email.</p>
              ))}
            {tab === "emails" && <EmailHistory orderId={orderId} kind="RATE_CARD" />}
          </div>
        </Card>
      </div>

      <CopyFromMasterDialog open={copyOpen} onOpenChange={setCopyOpen} existingIds={(watched.items ?? []).map((i) => i?.masterItemId).filter((x): x is string => !!x)} onAdd={addFromMaster} />
      <CompareRatesDialog open={compareOpen} onOpenChange={setCompareOpen} items={previewValues.items} />
    </div>
  );
}

/**
 * Client Servicing Rate Card step (Create Project): saves through the step's API. `onContinue`: the step is not done
 * yet, so the button reads Save & Continue and a successful save (PDF generated) moves on. Afterwards: Save Changes.
 */
export interface RateCardStepProps {
  onContinue?: () => void;
  /** Create Project: Skip Rate Card (the request email goes without a rate card; saved versions are kept). */
  onSkip?: () => Promise<void>;
  /** Rate Card Creation (no order): where its PDFs are read from, and its own save. */
  source?: FileSource;
  save?: (v: QuotationValues) => Promise<{ saved: boolean; revision: Revision }>;
  /** Rate Card Creation: the selected company (preview), and its picker in place of the read-only Company Name. */
  clientName?: string;
  company?: (fill: (d: { contactName: string; address: string } | null) => void) => React.ReactNode;
}

/**
 * Rate card for an order: left live PDF preview, right editor, bottom edit history (previous vs updated values).
 * `withEmail` adds the email composer / history tabs (old Sales Handling screen); Order Management only downloads the PDF.
 */
/** The editor for a rate card state loaded elsewhere (Rate Card Creation). */
export function RateCardEditor({ data, step }: { data: QuotationState; step: RateCardStepProps }) {
  return <Editor data={data} orderId={data.orderId} withEmail={false} step={step} />;
}

export function RateCardStage({ orderId, withEmail = false, step }: { orderId: string; withEmail?: boolean; step?: RateCardStepProps }) {
  const q = useQuotation(orderId);
  if (q.isPending)
    return (
      <div className="grid gap-5 xl:grid-cols-[5fr_7fr]">
        <Skeleton className="h-[640px]" />
        <Skeleton className="h-[640px]" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <Editor data={q.data} orderId={orderId} withEmail={withEmail} step={step} />;
}
