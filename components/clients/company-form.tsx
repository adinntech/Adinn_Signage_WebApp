"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldPath, type UseFormRegisterReturn, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, FileBadge, ListPlus, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { AttachmentChip } from "@/components/sales/order-comments";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  useFinalizeClientDraft,
  useGstCertificates,
  useRegisterCompany,
  type Client,
  type ClientContact,
  type ClientDraftInput,
  type ClientFile,
  type CompanyInput,
} from "@/lib/api/clients";
import { formData } from "@/lib/api/files";

/** Same normalisation as the backend (common/validators/contact.ts): +91 / leading 0 / spaces are accepted. */
export const normalizeMobile = (raw: string) => {
  let d = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
};
const isEmail = (v: string) => z.email().safeParse(v).success;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export const GST_MAX_FILES = 5;
const GST_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120),
  clientName: z.string().trim().max(120),
  email: z.string().trim().min(1, "Enter the company email").refine(isEmail, "Enter a valid email address"),
  phone: z.string().trim().min(1, "Enter the phone number").regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  gstin: z.string().trim().toUpperCase().min(1, "Enter the GST number").refine((v) => GSTIN.test(v), "Invalid GST number: 15 characters, e.g. 27ABCDE1234F1Z5"),
  customFields: z
    .array(z.object({ label: z.string().trim().min(1, "Enter the field label").max(60), value: z.string().trim().min(1, "Enter the value").max(500) }))
    .max(30)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((f, i) => {
        const k = f.label.trim().toLowerCase();
        if (k && seen.has(k)) ctx.addIssue({ code: "custom", path: [i, "label"], message: `"${f.label.trim()}" is already added` });
        seen.add(k);
      });
    }),
});
export type CompanyValues = z.infer<typeof companySchema>;

export const EMPTY_COMPANY: CompanyValues = { name: "", clientName: "", email: "", phone: "", gstin: "", customFields: [] };

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
  // A draft may not have a company name yet.
  name: c.name ?? "",
  clientName: c.clientName ?? "",
  email: c.email ?? "",
  phone: c.phone ?? "",
  gstin: c.gstin ?? "",
  customFields: (c.customFields ?? []).map((f) => ({ label: f.label ?? "", value: f.value ?? "" })),
});

const opt = (v: string) => v || undefined;
export const contactToApi = (k: ReturnType<typeof contactToForm>): ClientContact => ({
  name: k.name,
  designation: opt(k.designation),
  phone: normalizeMobile(k.phone),
  alternatePhone: k.alternatePhone ? normalizeMobile(k.alternatePhone) : undefined,
  email: opt(k.email.toLowerCase()),
  alternateEmail: opt(k.alternateEmail.toLowerCase()),
  isPrimary: k.isPrimary,
});
/**
 * Form values -> API body (blank optional fields omitted). Fields the form no longer asks for (address, industry,
 * contacts ...) are not sent, so an edit keeps what is saved.
 */
export const companyToApi = (v: CompanyValues): CompanyInput => ({
  name: v.name,
  clientName: opt(v.clientName),
  email: v.email.toLowerCase(),
  phone: v.phone,
  gstin: opt(v.gstin),
  customFields: v.customFields.map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
});

/**
 * Add Client save: registers the client, then uploads the GST files picked on the form. The client is kept when the
 * upload fails; `uploadError` then says why, so the page can send BD to Edit to attach it again.
 */
export function useCreateClient() {
  const register = useRegisterCompany();
  const finalize = useFinalizeClientDraft();
  const { upload } = useGstCertificates();
  /** `draftId`: a resumed draft is turned into the client (same record) instead of registering a new one. */
  const create = async (v: CompanyValues, pending: File[], draftId?: string) => {
    const client = draftId ? await finalize.mutateAsync({ id: draftId, body: companyToApi(v) }) : await register.mutateAsync(companyToApi(v));
    if (!pending.length) return { client, uploadError: null };
    try {
      await upload.mutateAsync({ id: client._id, body: formData(pending) });
      return { client, uploadError: null };
    } catch (e) {
      return { client, uploadError: errorMessage(e) };
    }
  };
  return { create, busy: register.isPending || finalize.isPending || upload.isPending };
}

/** Form values as typed (no checks) -> "Save Draft" body. */
export const companyToDraft = (v: CompanyValues): ClientDraftInput => ({
  name: v.name.trim(),
  clientName: v.clientName.trim(),
  email: v.email.trim(),
  phone: v.phone.trim(),
  gstin: v.gstin.trim().toUpperCase(),
  customFields: v.customFields.map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
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

/** Drops what a field does not accept as it is typed or pasted (e.g. letters in a phone number). */
export const digitsOnly = (max: number) => (v: string) => v.replace(/\D/g, "").slice(0, max);
/**
 * Keeps the browser's saved emails / contacts from popping up over CRM fields (autocomplete off, and the password
 * manager hints most extensions honour).
 */
export const NO_AUTOFILL = { autoComplete: "off", "data-lpignore": "true", "data-1p-ignore": "true", "data-form-type": "other" } as const;
export function filtered(r: UseFormRegisterReturn, clean: (v: string) => string): UseFormRegisterReturn {
  return {
    ...r,
    onChange: (ev) => {
      const t = ev.target as HTMLInputElement;
      const v = clean(t.value);
      if (v !== t.value) t.value = v;
      return r.onChange(ev);
    },
  };
}

function errAt(form: UseFormReturn<CompanyValues>, path: string) {
  return path.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], form.formState.errors) as { message?: string } | undefined;
}

/**
 * GST certificate files. New files are only picked here (`pending`); the page uploads them after the client is
 * saved. Files already saved (edit) open on click and are removed right away after a confirm.
 */
export interface GstFilesState {
  clientId?: string;
  saved: ClientFile[];
  pending: File[];
  onPendingChange: (files: File[]) => void;
}

/** A. Company Information, B. GST Certificate, C. Custom Fields. The page renders its own action bar. */
export function CompanyFormFields({ form, idPrefix = "co", gst }: { form: UseFormReturn<CompanyValues>; idPrefix?: string; gst: GstFilesState }) {
  const { register, formState } = form;
  useUnsavedWarning((formState.isDirty || gst.pending.length > 0) && !formState.isSubmitSuccessful);
  const e = (p: string) => errAt(form, p)?.message;
  const id = (k: string) => `${idPrefix}-${k}`;

  return (
    <div className="space-y-5">
      {formState.errors.root && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {formState.errors.root.message}
        </p>
      )}
      <Card className="p-5 sm:p-6">
        <SectionTitle divider icon={Building2} title="Company Information" description="Registered company details. One company keeps one Client ID for all its orders." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Client Name" htmlFor={id("client-name")} error={e("clientName")}>
            <Input id={id("client-name")} maxLength={120} placeholder="Enter client name (optional)" {...NO_AUTOFILL} aria-invalid={!!e("clientName")} {...register("clientName")} />
          </Field>
          <Field label="Company Name" htmlFor={id("name")} required error={e("name")} className="xl:col-span-2">
            <Input id={id("name")} placeholder="e.g. Acme Retail Pvt. Ltd." {...NO_AUTOFILL} aria-invalid={!!e("name")} {...register("name")} />
          </Field>
          <Field label="Company Email Address" htmlFor={id("email")} required error={e("email")}>
            <Input id={id("email")} type="email" placeholder="e.g. info@company.com" {...NO_AUTOFILL} aria-invalid={!!e("email")} {...register("email")} />
          </Field>
          <Field label="Phone Number" htmlFor={id("phone")} required error={e("phone")}>
            <Input id={id("phone")} type="tel" inputMode="numeric" maxLength={10} placeholder="Enter 10-digit phone number" {...NO_AUTOFILL} aria-invalid={!!e("phone")} {...filtered(register("phone"), digitsOnly(10))} />
          </Field>
          <Field label="GST Number" htmlFor={id("gstin")} required error={e("gstin")}>
            <Input id={id("gstin")} className="uppercase" maxLength={15} placeholder="27ABCDE1234F1Z5" {...NO_AUTOFILL} aria-invalid={!!e("gstin")} {...register("gstin")} />
          </Field>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <GstCertificateCard idPrefix={idPrefix} gst={gst} />
        <CustomFieldsCard form={form} idPrefix={idPrefix} />
      </div>
    </div>
  );
}

function GstCertificateCard({ idPrefix, gst }: { idPrefix: string; gst: GstFilesState }) {
  const toast = useToast();
  const { remove } = useGstCertificates();
  const [removing, setRemoving] = useState<ClientFile | null>(null);
  const room = Math.max(0, GST_MAX_FILES - gst.saved.length);

  const confirmRemove = async () => {
    if (!removing || !gst.clientId) return;
    try {
      await remove.mutateAsync({ id: gst.clientId, fileId: removing.fileId });
      toast("GST certificate removed");
      setRemoving(null);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        divider
        icon={FileBadge}
        title="GST Certificate"
        description="Attach the GST certificate as a PDF or image."
        action={<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{gst.saved.length + gst.pending.length} of {GST_MAX_FILES}</span>}
      />
      {gst.saved.length > 0 && gst.clientId && (
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Saved GST certificate files">
          {gst.saved.map((f) => (
            <AttachmentChip key={f.fileId} file={f} source={{ clientId: gst.clientId! }} onRemove={() => setRemoving(f)} />
          ))}
        </div>
      )}
      <FileUploader
        id={`${idPrefix}-gst-files`}
        files={gst.pending}
        onChange={(files) => gst.onPendingChange(files.slice(0, room))}
        accept={GST_ACCEPT}
        multiple
        disabled={gst.pending.length >= room}
        hint={gst.pending.length < room ? `PDF, JPG, PNG or WEBP · up to ${room - gst.pending.length} more file${room - gst.pending.length === 1 ? "" : "s"}` : `${GST_MAX_FILES} files attached (the maximum)`}
      />
      {gst.pending.length > 0 && <p className="mt-2 text-xs text-muted-foreground">New files are uploaded when you save the client.</p>}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove GST certificate?"
        description={`${removing?.name ?? "This file"} will be deleted from this client.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={confirmRemove}
      />
    </Card>
  );
}

function CustomFieldsCard({ form, idPrefix }: { form: UseFormReturn<CompanyValues>; idPrefix: string }) {
  const { register, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "customFields" });
  const values = useWatch({ control, name: "customFields" });
  const e = (p: string) => errAt(form, p)?.message;

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        divider
        icon={ListPlus}
        title="Custom Fields"
        description="Add any extra client detail as a label and its value."
        action={<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{fields.length} of 30</span>}
      />
      {fields.length === 0 && <p className="mb-3 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">No custom fields yet. Use Add Custom Field for details like PAN number, branch or billing code.</p>}
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {fields.map((f, i) => (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]"
            >
              <Field label="Label" htmlFor={`${idPrefix}-cf${i}-label`} required error={e(`customFields.${i}.label`)}>
                <Input id={`${idPrefix}-cf${i}-label`} maxLength={60} placeholder="e.g. PAN Number" {...NO_AUTOFILL} aria-invalid={!!e(`customFields.${i}.label`)} {...register(`customFields.${i}.label`)} />
              </Field>
              <Field label="Value" htmlFor={`${idPrefix}-cf${i}-value`} required error={e(`customFields.${i}.value`)} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                <Input id={`${idPrefix}-cf${i}-value`} maxLength={500} placeholder="Enter the value" {...NO_AUTOFILL} aria-invalid={!!e(`customFields.${i}.value`)} {...register(`customFields.${i}.value`)} />
              </Field>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${values?.[i]?.label || `custom field ${i + 1}`}`}
                title="Remove field"
                className="mt-6 flex size-10 items-center justify-center self-start rounded-lg border border-danger/30 text-danger transition-colors hover:border-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button
        type="button"
        onClick={() => append({ label: "", value: "" }, { shouldFocus: true })}
        disabled={fields.length >= 30}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand-soft/60 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-brand text-white">
          <Plus className="size-4" aria-hidden />
        </span>
        Add Custom Field
      </button>
    </Card>
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
