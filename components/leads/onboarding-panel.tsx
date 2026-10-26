"use client";

import Link from "next/link";
import { useFieldArray, useForm, useWatch, type FieldPath, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Building2, Check, Download, Eye, FileText, History, Mail, MapPin, Pencil, Plus, Save, Trash2, Users, Wallet } from "lucide-react";
import { z } from "zod";
import { EmailComposer } from "@/components/sales/email-composer";
import { EmailHistory } from "@/components/sales/email-history";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { downloadFile, openFile } from "@/lib/api/files";
import {
  ORGANISATION_TYPES,
  useOnboarding,
  useSaveOnboarding,
  useSendOnboarding,
  type OnboardingForm,
  type OnboardingPerson,
  type OnboardingState,
  type OrganisationType,
} from "@/lib/api/leads";
import { useOrderEmails } from "@/lib/api/sales";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLOR = "#059669";
const isEmail = (v: string) => z.email().safeParse(v).success;
const personSchema = z.object({
  name: z.string().trim().max(120),
  designation: z.string().trim().max(120),
  mobile: z.string().trim().refine((v) => !v || /^\d{10}$/.test(v), "Mobile number must be exactly 10 digits"),
  email: z.string().trim().refine((v) => !v || isEmail(v), "Enter a valid email address"),
});
const ADDRESS_KEYS = ["floorNo", "buildingNo", "premises", "road", "locality", "city", "district", "state", "pincode"] as const;
const schema = z
  .object({
    organisationType: z.string(),
    organisationOther: z.string().trim().max(120),
    pan: z.string().trim().toUpperCase().refine((v) => !v || /^[A-Z]{5}\d{4}[A-Z]$/.test(v), "Invalid PAN (e.g. ABCDE1234F)"),
    msme: z.enum(["", "yes", "no"]),
    msmeNumber: z.string().trim().max(40),
    primaryPhone: z.string().trim().refine((v) => !v || /^[\d+\-\s()]{6,20}$/.test(v), "Enter a valid phone number"),
    registered: z.object({
      floorNo: z.string().trim().max(60),
      buildingNo: z.string().trim().max(120),
      premises: z.string().trim().max(200),
      road: z.string().trim().max(300),
      locality: z.string().trim().max(200),
      city: z.string().trim().max(80),
      district: z.string().trim().max(80),
      state: z.string().trim().max(80),
      pincode: z.string().trim().refine((v) => !v || /^\d{6}$/.test(v), "Pincode must be exactly 6 digits"),
    }),
    branchAddress: z.string().trim().max(500),
    keyManagement: z.array(personSchema).max(10),
    accounts: z.object({ primary: personSchema, escalation: personSchema }),
    finance: z.object({ primary: personSchema, escalation: personSchema }),
  })
  .superRefine((v, ctx) => {
    if (v.msme === "yes" && !v.msmeNumber) ctx.addIssue({ code: "custom", path: ["msmeNumber"], message: "Enter the MSME number" });
    if (v.organisationType === "OTHERS" && !v.organisationOther) ctx.addIssue({ code: "custom", path: ["organisationOther"], message: "Enter the type of organisation" });
  });
type Values = z.infer<typeof schema>;
type PersonValues = z.infer<typeof personSchema>;

const blankPerson = (): PersonValues => ({ name: "", designation: "", mobile: "", email: "" });
const toPerson = (p?: OnboardingPerson | null): PersonValues => ({ name: p?.name ?? "", designation: p?.designation ?? "", mobile: p?.mobile ?? "", email: p?.email ?? "" });
const toValues = (f: OnboardingForm): Values => ({
  organisationType: f.organisationType ?? "",
  organisationOther: f.organisationOther ?? "",
  pan: f.pan ?? "",
  msme: f.msmeApplicable === undefined || f.msmeApplicable === null ? "" : f.msmeApplicable ? "yes" : "no",
  msmeNumber: f.msmeNumber ?? "",
  primaryPhone: f.primaryPhone ?? "",
  registered: Object.fromEntries(ADDRESS_KEYS.map((k) => [k, f.registered?.[k] ?? ""])) as Values["registered"],
  branchAddress: f.branchAddress ?? "",
  keyManagement: f.keyManagement.length ? f.keyManagement.map(toPerson) : [blankPerson()],
  accounts: { primary: toPerson(f.accounts?.primary), escalation: toPerson(f.accounts?.escalation) },
  finance: { primary: toPerson(f.finance?.primary), escalation: toPerson(f.finance?.escalation) },
});
const filled = (p: PersonValues) => Object.values(p).some((x) => x.trim());
const apiPerson = (p: PersonValues): OnboardingPerson | null => (filled(p) ? { name: p.name, designation: p.designation, mobile: p.mobile, email: p.email.toLowerCase() } : null);
const toApi = (v: Values): OnboardingForm => ({
  organisationType: (v.organisationType || undefined) as OrganisationType | undefined,
  organisationOther: v.organisationType === "OTHERS" ? v.organisationOther : "",
  pan: v.pan,
  msmeApplicable: v.msme === "" ? undefined : v.msme === "yes",
  msmeNumber: v.msme === "yes" ? v.msmeNumber : "",
  primaryPhone: v.primaryPhone,
  registered: v.registered,
  branchAddress: v.branchAddress,
  keyManagement: v.keyManagement.filter(filled).map((p) => apiPerson(p)!),
  accounts: { primary: apiPerson(v.accounts.primary), escalation: apiPerson(v.accounts.escalation) },
  finance: { primary: apiPerson(v.finance.primary), escalation: apiPerson(v.finance.escalation) },
});

const digits = (max: number) => (v: string) => v.replace(/\D/g, "").slice(0, max);
function filtered(r: UseFormRegisterReturn, clean: (v: string) => string): UseFormRegisterReturn {
  return {
    ...r,
    onChange: (ev) => {
      const t = ev.target as HTMLInputElement;
      const c = clean(t.value);
      if (c !== t.value) t.value = c;
      return r.onChange(ev);
    },
  };
}

/** Numbered step of the Client Registered chain (Form Fill -> Generate PDF -> Send Email -> Email History). */
function Step({ n, title, icon: Icon, done, children, action }: { n: number; title: string; icon: typeof Mail; done: boolean; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.05 }} className="relative pl-12" id={`onb-step-${n}`}>
      <span className={cn("absolute left-0 top-0 z-10 flex size-9 items-center justify-center rounded-full text-sm font-bold text-white", !done && "ring-4 ring-[#05966922]")} style={{ background: COLOR }}>
        {done ? <Check className="size-4.5" strokeWidth={3} aria-hidden /> : n}
      </span>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Icon className="size-4" style={{ color: COLOR }} aria-hidden /> {title}
          </h3>
          {action}
        </div>
        {children}
      </Card>
    </motion.section>
  );
}

function PersonFields({ prefix, base, form, errAt }: { prefix: string; base: string; form: ReturnType<typeof useForm<Values>>; errAt: (p: string) => string | undefined }) {
  const r = (k: keyof PersonValues) => form.register(`${base}.${k}` as FieldPath<Values>);
  const id = (k: string) => `${prefix}-${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Name" htmlFor={id("name")} error={errAt(`${base}.name`)}>
        <Input id={id("name")} maxLength={120} placeholder="Full name" {...r("name")} />
      </Field>
      <Field label="Designation" htmlFor={id("des")} error={errAt(`${base}.designation`)}>
        <Input id={id("des")} maxLength={120} placeholder="e.g. Accounts Manager" {...r("designation")} />
      </Field>
      <Field label="Mobile No" htmlFor={id("mob")} error={errAt(`${base}.mobile`)}>
        <Input id={id("mob")} inputMode="numeric" maxLength={10} placeholder="10-digit mobile" aria-invalid={!!errAt(`${base}.mobile`)} {...filtered(r("mobile"), digits(10))} />
      </Field>
      <Field label="Email ID" htmlFor={id("mail")} error={errAt(`${base}.email`)}>
        <Input id={id("mail")} type="email" placeholder="name@company.com" aria-invalid={!!errAt(`${base}.email`)} {...r("email")} />
      </Field>
    </div>
  );
}

function FormStep({ id, data, canWrite, done }: { id: string; data: OnboardingState; canWrite: boolean; done: boolean }) {
  const toast = useToast();
  const save = useSaveOnboarding(id);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(data.form), mode: "onTouched" });
  const { register, control, handleSubmit, formState } = form;
  const km = useFieldArray({ control, name: "keyManagement" });
  useUnsavedWarning(formState.isDirty && !formState.isSubmitSuccessful);
  const errAt = (p: string) => (p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], formState.errors) as { message?: string } | undefined)?.message;
  const orgType = useWatch({ control, name: "organisationType" });
  const msme = useWatch({ control, name: "msme" });

  const submit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync(toApi(v));
      form.reset(v);
      toast("Onboarding form saved and PDF generated");
      document.getElementById("onb-step-2")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      const fe = Object.entries(fieldErrorsOf(e));
      for (const [path, message] of fe) form.setError(path as FieldPath<Values>, { message });
      toast(fe.length ? "Check the highlighted fields" : errorMessage(e), "error");
    }
  });
  const ro = !canWrite;

  return (
    <Step
      n={1}
      title="Form Fill (Auto Fetch)"
      icon={Pencil}
      done={done}
      action={<span className="text-xs text-muted-foreground">{data.saved ? "Saved on the client: reused for its next orders" : "Prefilled from Client Management"}</span>}
    >
      <form noValidate onSubmit={submit} className="space-y-6">
        <fieldset disabled={ro} className="space-y-6">
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="size-3.5" aria-hidden /> 1. Company Details
            </p>
            <div className="mb-3 grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-3">
              {[
                ["Company Name", data.client.name],
                ["Company Mail ID", data.client.email ?? "-"],
                ["GST No.", data.client.gstin ?? "-"],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="truncate font-medium">{v}</p>
                </div>
              ))}
              {canWrite && (
                <Link href={`/clients/${data.client._id}/edit`} className="text-xs font-medium text-brand hover:underline sm:col-span-3">
                  Change these in Client Management
                </Link>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Type of Organisation" htmlFor="onb-org">
                <Select id="onb-org" {...register("organisationType")}>
                  <option value="">Select</option>
                  {Object.entries(ORGANISATION_TYPES).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              {orgType === "OTHERS" && (
                <Field label="Specify Organisation Type" htmlFor="onb-org-other" required error={errAt("organisationOther")}>
                  <Input id="onb-org-other" maxLength={120} aria-invalid={!!errAt("organisationOther")} {...register("organisationOther")} />
                </Field>
              )}
              <Field label="PAN" htmlFor="onb-pan" error={errAt("pan")}>
                <Input id="onb-pan" className="uppercase" maxLength={10} placeholder="ABCDE1234F" aria-invalid={!!errAt("pan")} {...register("pan")} />
              </Field>
              <Field label="Primary Telephone No" htmlFor="onb-phone" error={errAt("primaryPhone")}>
                <Input id="onb-phone" inputMode="tel" maxLength={20} placeholder="e.g. 044 2345 6789" aria-invalid={!!errAt("primaryPhone")} {...register("primaryPhone")} />
              </Field>
              <Field label="MSME Applicable" htmlFor="onb-msme">
                <Select id="onb-msme" {...register("msme")}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </Field>
              {msme === "yes" && (
                <Field label="MSME Number" htmlFor="onb-msme-no" required error={errAt("msmeNumber")}>
                  <Input id="onb-msme-no" maxLength={40} placeholder="UDYAM-TN-00-0000000" aria-invalid={!!errAt("msmeNumber")} {...register("msmeNumber")} />
                </Field>
              )}
            </div>
          </div>

          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden /> 2. Registered & Branch Addresses
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["floorNo", "Floor No.", 60],
                  ["buildingNo", "Building No. / Flat No.", 120],
                  ["premises", "Name of Premises / Building", 200],
                  ["road", "Road / Street", 300],
                  ["locality", "Locality / Sub Locality", 200],
                  ["city", "City / Town / Village", 80],
                  ["district", "District", 80],
                  ["state", "State", 80],
                ] as const
              ).map(([k, label, max]) => (
                <Field key={k} label={label} htmlFor={`onb-reg-${k}`} error={errAt(`registered.${k}`)}>
                  <Input id={`onb-reg-${k}`} maxLength={max} {...register(`registered.${k}`)} />
                </Field>
              ))}
              <Field label="PIN Code" htmlFor="onb-reg-pin" error={errAt("registered.pincode")}>
                <Input id="onb-reg-pin" inputMode="numeric" maxLength={6} placeholder="6-digit PIN" aria-invalid={!!errAt("registered.pincode")} {...filtered(register("registered.pincode"), digits(6))} />
              </Field>
              <Field label="Branch Office Address (if any)" htmlFor="onb-branch" className="sm:col-span-2 xl:col-span-3">
                <Textarea id="onb-branch" className="min-h-16" maxLength={500} {...register("branchAddress")} />
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="size-3.5" aria-hidden /> 3. Key Management Details
              </p>
              {canWrite && (
                <Button type="button" variant="ghost" size="sm" disabled={km.fields.length >= 10} onClick={() => km.append(blankPerson())}>
                  <Plus className="size-4" aria-hidden /> Add Person
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {km.fields.map((f, i) => (
                <div key={f.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">Person {i + 1}</span>
                    {canWrite && km.fields.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-danger" aria-label={`Remove person ${i + 1}`} onClick={() => km.remove(i)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                  <PersonFields prefix={`onb-km${i}`} base={`keyManagement.${i}`} form={form} errAt={errAt} />
                </div>
              ))}
            </div>
          </div>

          {(["accounts", "finance"] as const).map((team, t) => (
            <div key={team}>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Wallet className="size-3.5" aria-hidden /> {t + 4}. {team === "accounts" ? "Accounts" : "Finance"} Team Contact Details
              </p>
              <div className="space-y-3">
                {(["primary", "escalation"] as const).map((role) => (
                  <div key={role} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs font-semibold text-primary">{role === "primary" ? "Primary Contact" : "Escalation Contact"}</p>
                    <PersonFields prefix={`onb-${team}-${role}`} base={`${team}.${role}`} form={form} errAt={errAt} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        {canWrite && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
            {formState.isDirty && <span className="text-xs text-warning">Unsaved changes</span>}
            <Button type="submit" variant="brand" loading={save.isPending} style={{ background: COLOR }}>
              <Save className="size-4" aria-hidden /> Save & Generate PDF
            </Button>
          </div>
        )}
      </form>
    </Step>
  );
}

/** Client Registered: onboarding form -> PDF -> email through the PHP mail service -> email history. */
export function OnboardingPanel({ orderId, canWrite, open }: { orderId: string; canWrite: boolean; open: boolean }) {
  const toast = useToast();
  const q = useOnboarding(orderId);
  const send = useSendOnboarding(orderId);
  const sent = useOrderEmails(orderId, "ONBOARDING");
  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-96" />
        <Skeleton className="h-32" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const write = canWrite && open;
  const sentOk = (sent.data ?? []).some((e) => e.status === "SENT");

  return (
    // The vertical line joins the four steps into one chain.
    <div className="relative space-y-5 before:absolute before:bottom-6 before:left-[17px] before:top-4 before:w-0.5 before:bg-[#05966940]">
      {/* key: a saved form reloads its defaults */}
      <FormStep key={d.pdfAt ?? "new"} id={orderId} data={d} canWrite={write} done={d.saved} />

      <Step n={2} title="Generate PDF: Customer Onboarding Form" icon={FileText} done={!!d.pdf}>
        {d.pdf ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-danger-soft text-danger">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.pdf.name}</p>
              <p className="text-xs text-muted-foreground">
                Generated {formatDateTime(d.pdfAt)}
                {d.pdfBy ? ` by ${d.pdfBy}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => openFile(d.pdf!.fileId, { orderId }).catch((e) => toast(errorMessage(e), "error"))}>
              <Eye className="size-4" aria-hidden /> Preview
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadFile(d.pdf!.fileId, { orderId }, d.pdf!.name).catch((e) => toast(errorMessage(e), "error"))}>
              <Download className="size-4" aria-hidden /> Download
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Save the form above: the PDF is generated in the company format and kept here.</p>
        )}
      </Step>

      <Step n={3} title="Send Email" icon={Mail} done={sentOk}>
        {write ? (
          <EmailComposer
            key={`${d.pdf?.fileId ?? "none"}`}
            idPrefix="onb-mail"
            orderId={orderId}
            from={d.from}
            mailEnabled={d.mailEnabled}
            notConfigured='The PHP mail service is not connected yet. Sending is recorded as "Not sent" until its URL is set up on the server.'
            draft={d.draft}
            attachments={d.pdf ? [d.pdf] : []}
            attachmentLabel="Customer Onboarding Form PDF (sent as a link)"
            blockedReason={d.pdf ? null : "Save the form to generate the PDF first."}
            sending={send.isPending}
            onSend={(v) => send.mutateAsync(v)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Sending is available while the lead is open.</p>
        )}
      </Step>

      <Step n={4} title="Email History" icon={History} done={sentOk}>
        <EmailHistory orderId={orderId} kind="ONBOARDING" allowResend={write} />
      </Step>
    </div>
  );
}
