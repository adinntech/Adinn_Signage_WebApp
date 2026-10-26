"use client";

import { useFieldArray, useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Plus, Star, Trash2, Users } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { fieldErrorsOf } from "@/lib/api";
import type { Client, ClientContact } from "@/lib/api/clients";
import { cn } from "@/lib/utils";

/** Same normalisation as the backend (common/validators/contact.ts): +91 / leading 0 / spaces are accepted. */
export const normalizeMobile = (raw: string) => {
  let d = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
};
const MOBILE_MSG = "Enter a 10-digit mobile number (starting 6-9)";
const isMobile = (v: string) => /^[6-9]\d{9}$/.test(normalizeMobile(v));
const isEmail = (v: string) => z.email().safeParse(v).success;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export const INDUSTRIES = ["Retail & FMCG", "Automobile", "Banking & Finance", "Telecom", "Real Estate", "Healthcare", "Education", "Hospitality", "Petroleum & Energy", "Consumer Electronics", "Government", "Other"];
const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal"];

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter the contact person name").max(120),
  designation: z.string().trim().max(120),
  phone: z.string().trim().min(1, "Enter the mobile number").refine(isMobile, MOBILE_MSG),
  alternatePhone: z.string().trim().refine((v) => !v || isMobile(v), MOBILE_MSG),
  email: z.string().trim().refine((v) => !v || isEmail(v), "Enter a valid email address"),
  alternateEmail: z.string().trim().refine((v) => !v || isEmail(v), "Enter a valid email address"),
  isPrimary: z.boolean(),
});

export const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120),
  email: z.string().trim().min(1, "Enter the company email").refine(isEmail, "Enter a valid email address"),
  industry: z.string().trim().max(120),
  address: z.string().trim().max(500),
  city: z.string().trim().max(80),
  district: z.string().trim().max(80),
  state: z.string().trim().max(80),
  pincode: z.string().trim().refine((v) => !v || /^\d{6}$/.test(v), "Pincode must be 6 digits"),
  gstin: z.string().trim().toUpperCase().refine((v) => !v || GSTIN.test(v), "Invalid GST number (e.g. 27ABCDE1234F1Z5)"),
  contacts: z
    .array(contactSchema)
    .min(1, "Add at least one contact person")
    .max(20)
    .superRefine((list, ctx) => {
      const seen = new Map<string, number>();
      list.forEach((c, i) => {
        const p = normalizeMobile(c.phone);
        if (p && seen.has(p)) ctx.addIssue({ code: "custom", path: [i, "phone"], message: `Same mobile number as contact ${seen.get(p)! + 1}` });
        else seen.set(p, i);
      });
    }),
});
export type CompanyValues = z.infer<typeof companySchema>;

const EMPTY_CONTACT = (primary: boolean): CompanyValues["contacts"][number] => ({ name: "", designation: "", phone: "", alternatePhone: "", email: "", alternateEmail: "", isPrimary: primary });
export const EMPTY_COMPANY: CompanyValues = { name: "", email: "", industry: "", address: "", city: "", district: "", state: "", pincode: "", gstin: "", contacts: [EMPTY_CONTACT(true)] };

export const contactToForm = (k: ClientContact) => ({
  name: k.name,
  designation: k.designation ?? "",
  phone: k.phone ?? "",
  alternatePhone: k.alternatePhone ?? "",
  email: k.email ?? "",
  alternateEmail: k.alternateEmail ?? "",
  isPrimary: !!k.isPrimary,
});
export const companyToForm = (c: Client): CompanyValues => ({
  name: c.name,
  email: c.email ?? "",
  industry: c.industry ?? "",
  address: c.address ?? "",
  city: c.city ?? "",
  district: c.district ?? "",
  state: c.state ?? "",
  pincode: c.pincode ?? "",
  gstin: c.gstin ?? "",
  contacts: c.contacts?.length ? c.contacts.map(contactToForm) : [EMPTY_CONTACT(true)],
});

const opt = (v: string) => v || undefined;
export const contactToApi = (k: CompanyValues["contacts"][number]): ClientContact => ({
  name: k.name,
  designation: opt(k.designation),
  phone: normalizeMobile(k.phone),
  alternatePhone: k.alternatePhone ? normalizeMobile(k.alternatePhone) : undefined,
  email: opt(k.email.toLowerCase()),
  alternateEmail: opt(k.alternateEmail.toLowerCase()),
  isPrimary: k.isPrimary,
});
/** Form values -> API body (blank optional fields omitted). */
export const companyToApi = (v: CompanyValues) => ({
  name: v.name,
  email: v.email.toLowerCase(),
  industry: opt(v.industry),
  address: opt(v.address),
  city: opt(v.city),
  district: opt(v.district),
  state: opt(v.state),
  pincode: opt(v.pincode),
  gstin: opt(v.gstin),
  contacts: v.contacts.map(contactToApi),
});

export function useCompanyForm(defaults: CompanyValues) {
  return useForm<CompanyValues>({ resolver: zodResolver(companySchema), defaultValues: defaults, mode: "onTouched" });
}

/** Puts backend validation / conflict errors on the right fields; returns false if nothing could be mapped. */
export function applyServerErrors(form: UseFormReturn<CompanyValues>, err: unknown) {
  const fe = fieldErrorsOf(err);
  let mapped = false;
  for (const [path, message] of Object.entries(fe)) {
    form.setError(path as FieldPath<CompanyValues>, { message });
    mapped = true;
  }
  return mapped;
}

function errAt(form: UseFormReturn<CompanyValues>, path: string) {
  return path.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], form.formState.errors) as { message?: string } | undefined;
}

/** A. Company Information + B. Contact Person Information. The page renders its own action bar. */
export function CompanyFormFields({ form, idPrefix = "co" }: { form: UseFormReturn<CompanyValues>; idPrefix?: string }) {
  const { register, control, setValue, watch, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "contacts" });
  const contacts = watch("contacts");
  useUnsavedWarning(formState.isDirty && !formState.isSubmitSuccessful);
  const e = (p: string) => errAt(form, p)?.message;
  const id = (k: string) => `${idPrefix}-${k}`;

  const makePrimary = (i: number) => contacts.forEach((_, j) => setValue(`contacts.${j}.isPrimary`, i === j, { shouldDirty: true }));
  const removeAt = (i: number) => {
    const wasPrimary = contacts[i]?.isPrimary;
    remove(i);
    if (wasPrimary) setTimeout(() => setValue("contacts.0.isPrimary", true, { shouldDirty: true }));
  };

  return (
    <div className="space-y-5">
      {formState.errors.root && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {formState.errors.root.message}
        </p>
      )}
      <Card className="p-5 sm:p-6">
        <SectionTitle divider icon={Building2} title="Company Information" description="Registered company details. One company keeps one Client ID for all its orders." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Company Name" htmlFor={id("name")} required error={e("name")} className="sm:col-span-2">
            <Input id={id("name")} placeholder="e.g. Acme Retail Pvt. Ltd." aria-invalid={!!e("name")} {...register("name")} />
          </Field>
          <Field label="Company Email Address" htmlFor={id("email")} required error={e("email")}>
            <Input id={id("email")} type="email" placeholder="info@company.com" aria-invalid={!!e("email")} {...register("email")} />
          </Field>
          <Field label="Industry / Business Category" htmlFor={id("industry")} error={e("industry")}>
            <Input id={id("industry")} list={id("industries")} placeholder="Select or type" {...register("industry")} />
            <datalist id={id("industries")}>
              {INDUSTRIES.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Company Address" htmlFor={id("address")} error={e("address")} className="sm:col-span-2 xl:col-span-4">
            <Textarea id={id("address")} className="min-h-16" placeholder="Building, street, area" {...register("address")} />
          </Field>
          <Field label="City" htmlFor={id("city")} error={e("city")}>
            <Input id={id("city")} {...register("city")} />
          </Field>
          <Field label="District" htmlFor={id("district")} error={e("district")}>
            <Input id={id("district")} {...register("district")} />
          </Field>
          <Field label="State" htmlFor={id("state")} error={e("state")}>
            <Input id={id("state")} list={id("states")} {...register("state")} />
            <datalist id={id("states")}>
              {STATES.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Pincode" htmlFor={id("pincode")} error={e("pincode")}>
            <Input id={id("pincode")} format="pincode" aria-invalid={!!e("pincode")} {...register("pincode")} />
          </Field>
          <Field label="GST Number" htmlFor={id("gstin")} error={e("gstin")} className="sm:col-span-2">
            <Input id={id("gstin")} format="gst" className="uppercase" placeholder="27ABCDE1234F1Z5" aria-invalid={!!e("gstin")} {...register("gstin")} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle
          divider
          icon={Users}
          title="Contact Person Information"
          description="Add one or more contact persons and mark the primary contact."
          action={<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{fields.length} of 20</span>}
        />
        {typeof formState.errors.contacts?.message === "string" && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {formState.errors.contacts.message}
          </p>
        )}
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {fields.map((f, i) => {
              const primary = !!contacts[i]?.isPrimary;
              return (
                <motion.fieldset
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn("rounded-xl border p-4 transition-colors sm:p-5", primary ? "border-brand/40 bg-brand-soft/30" : "border-border bg-background")}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <legend className="flex items-center gap-2.5 text-sm font-semibold text-primary">
                      <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-bold", primary ? "bg-brand text-white" : "bg-brand-soft text-brand")}>{i + 1}</span>
                      Contact Person {i + 1}
                      {primary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
                          <Star className="size-3 fill-current" aria-hidden /> Primary Contact
                        </span>
                      )}
                    </legend>
                    <div className="flex items-center gap-2">
                      <label className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors", primary ? "border-brand/40 bg-surface text-brand" : "border-border bg-surface hover:bg-muted")}>
                        <input type="radio" name={id("primary")} className="size-4 accent-[var(--color-brand)]" checked={primary} onChange={() => makePrimary(i)} />
                        {primary ? "Primary" : "Set as primary"}
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-danger/30 text-danger hover:border-danger hover:bg-danger-soft"
                        onClick={() => removeAt(i)}
                        disabled={fields.length <= 1}
                        title={fields.length <= 1 ? "At least one contact person is required" : undefined}
                        aria-label={`Remove contact ${i + 1}`}
                      >
                        <Trash2 className="size-4" aria-hidden /> Remove
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Contact Person Name" htmlFor={id(`k${i}-name`)} required error={e(`contacts.${i}.name`)}>
                      <Input id={id(`k${i}-name`)} aria-invalid={!!e(`contacts.${i}.name`)} {...register(`contacts.${i}.name`)} />
                    </Field>
                    <Field label="Designation" htmlFor={id(`k${i}-des`)} error={e(`contacts.${i}.designation`)}>
                      <Input id={id(`k${i}-des`)} placeholder="e.g. Purchase Head" {...register(`contacts.${i}.designation`)} />
                    </Field>
                    <Field label="Mobile Number" htmlFor={id(`k${i}-phone`)} required error={e(`contacts.${i}.phone`)}>
                      <Input id={id(`k${i}-phone`)} format="phone" placeholder="98765 43210" aria-invalid={!!e(`contacts.${i}.phone`)} {...register(`contacts.${i}.phone`)} />
                    </Field>
                    <Field label="Alternate Mobile Number" htmlFor={id(`k${i}-aphone`)} error={e(`contacts.${i}.alternatePhone`)}>
                      <Input id={id(`k${i}-aphone`)} format="phone" aria-invalid={!!e(`contacts.${i}.alternatePhone`)} {...register(`contacts.${i}.alternatePhone`)} />
                    </Field>
                    <Field label="Email Address" htmlFor={id(`k${i}-email`)} error={e(`contacts.${i}.email`)}>
                      <Input id={id(`k${i}-email`)} type="email" aria-invalid={!!e(`contacts.${i}.email`)} {...register(`contacts.${i}.email`)} />
                    </Field>
                    <Field label="Alternate Email Address" htmlFor={id(`k${i}-aemail`)} error={e(`contacts.${i}.alternateEmail`)}>
                      <Input id={id(`k${i}-aemail`)} type="email" aria-invalid={!!e(`contacts.${i}.alternateEmail`)} {...register(`contacts.${i}.alternateEmail`)} />
                    </Field>
                  </div>
                </motion.fieldset>
              );
            })}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => append(EMPTY_CONTACT(fields.length === 0))}
          disabled={fields.length >= 20}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand-soft/60 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-brand text-white">
            <Plus className="size-4" aria-hidden />
          </span>
          Add Another Contact Person
        </button>
      </Card>
    </div>
  );
}

/** Sticky bottom bar for form pages. */
export function FormActionBar({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    // Negative margins cancel <main>'s padding so the bar spans the full width and sits flush at the bottom;
    // it stays in normal flow, so it never covers the last fields.
    <div className="sticky bottom-0 z-20 -mx-4 -mb-4 mt-6 flex flex-col gap-3 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-6px_16px_-8px_rgb(11_42_91/0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:-mx-6 lg:-mb-6 lg:px-6">
      <div className="text-xs text-muted-foreground">{note}</div>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">{children}</div>
    </div>
  );
}
