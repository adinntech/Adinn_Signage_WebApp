"use client";

import * as React from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  SCENARIOS,
  SCENARIO_LABEL,
  UNITS,
  useCreateSite,
  useUpdateSite,
  type Scenario,
  type Site,
  type SiteFields,
  type SiteWarning,
} from "@/lib/api/sites";
import type { InputFormat } from "@/lib/input-format";

const num = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) > 0), "Enter a number greater than 0");

const schema = z
  .object({
    shopName: z.string().trim().max(250),
    dealerName: z.string().trim().max(250),
    location: z.string().trim().max(250),
    district: z.string().trim().max(250),
    address1: z.string().trim().max(250),
    address2: z.string().trim().max(250),
    address3: z.string().trim().max(250),
    pincode: z.string().trim().max(20),
    mobile: z.string().trim().max(60),
    gstin: z.string().trim().max(30),
    contactPerson: z.string().trim().max(250),
    clientSiteCode: z.string().trim().max(120),
    boardType: z.string().trim().max(120),
    quantity: z.string().trim().refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) > 0), "Whole number, 1 or more"),
    width: num,
    height: num,
    unit: z.enum(UNITS),
    scenario: z.enum(SCENARIOS),
    remarks: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    if (!v.shopName && !v.dealerName) {
      ctx.addIssue({ code: "custom", path: ["shopName"], message: "Shop name or dealer name is required" });
    }
    if (v.scenario === "CLIENT_PROVIDED" && !v.width) ctx.addIssue({ code: "custom", path: ["width"], message: "Width is required for Scenario 2" });
    if (v.scenario === "CLIENT_PROVIDED" && !v.height) ctx.addIssue({ code: "custom", path: ["height"], message: "Height is required for Scenario 2" });
    if (v.width && !v.height) ctx.addIssue({ code: "custom", path: ["height"], message: "Enter height as well" });
    if (v.height && !v.width) ctx.addIssue({ code: "custom", path: ["width"], message: "Enter width as well" });
  });
type FormValues = z.infer<typeof schema>;

const toForm = (s: Site | null, scenario: Scenario): FormValues => ({
  shopName: s?.shopName ?? "",
  dealerName: s?.dealerName ?? "",
  location: s?.location ?? "",
  district: s?.district ?? "",
  address1: s?.address1 ?? "",
  address2: s?.address2 ?? "",
  address3: s?.address3 ?? "",
  pincode: s?.pincode ?? "",
  mobile: s?.mobile ?? "",
  gstin: s?.gstin ?? "",
  contactPerson: s?.contactPerson ?? "",
  clientSiteCode: s?.clientSiteCode ?? "",
  boardType: s?.boardType ?? "",
  quantity: s?.quantity ? String(s.quantity) : "",
  width: s?.width ? String(s.width) : "",
  height: s?.height ? String(s.height) : "",
  unit: s?.unit ?? "ft",
  scenario: s?.scenario ?? scenario,
  remarks: s?.remarks ?? "",
});

function payload(v: FormValues, editing: boolean): SiteFields {
  const text = (x: string) => (editing ? x : x || undefined);
  const hasSize = !!(v.width && v.height);
  return {
    shopName: text(v.shopName),
    dealerName: text(v.dealerName),
    location: text(v.location),
    district: text(v.district),
    address1: text(v.address1),
    address2: text(v.address2),
    address3: text(v.address3),
    pincode: text(v.pincode),
    mobile: text(v.mobile),
    gstin: text(v.gstin),
    contactPerson: text(v.contactPerson),
    clientSiteCode: text(v.clientSiteCode),
    boardType: text(v.boardType),
    remarks: text(v.remarks),
    quantity: text(v.quantity),
    width: text(v.width),
    height: text(v.height),
    unit: hasSize ? v.unit : undefined,
    ...(editing ? {} : { scenario: v.scenario }),
  };
}

/** Add (site = null) or edit/view an existing site. Mount it only while open. */
export function SiteFormDialog({
  projectId,
  site,
  defaultScenario,
  readOnly,
  onClose,
}: {
  projectId: string;
  site: Site | null;
  defaultScenario: Scenario;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateSite(projectId);
  const update = useUpdateSite(projectId);
  const editing = !!site;
  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(site, defaultScenario) });
  const [conflict, setConflict] = React.useState(false);
  const [warnings, setWarnings] = React.useState<SiteWarning[] | null>(null);
  const [created, setCreated] = React.useState<string | null>(null);
  const scenario = useWatch({ control, name: "scenario" });
  const busy = create.isPending || update.isPending;

  const submit = (allowDuplicate: boolean) =>
    handleSubmit(async (v) => {
      setConflict(false);
      try {
        if (site) {
          const res = await update.mutateAsync({ id: site._id, patch: payload(v, true) });
          toast(res.warnings.length ? `Saved. ${res.warnings[0]!.message}` : "Site updated");
          onClose();
        } else {
          const res = await create.mutateAsync({ ...payload(v, false), allowDuplicate });
          setCreated(res.site.siteCode);
          if (res.warnings.length) setWarnings(res.warnings);
          else {
            toast(`Site ${res.site.siteCode} added`);
            onClose();
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) return setConflict(true);
        const fe = fieldErrorsOf(err);
        let mapped = false;
        for (const [path, message] of Object.entries(fe)) {
          const field = (path === "size" ? "width" : path) as FieldPath<FormValues>;
          if (field in schema.shape || path === "size") {
            setError(field, { message });
            mapped = true;
          }
        }
        if (!mapped || !(err instanceof ApiError && err.status === 422)) setError("root", { message: errorMessage(err) });
      }
    });

  if (warnings && created) {
    return (
      <Modal
        open
        onOpenChange={(o) => !o && onClose()}
        title="Site added"
        description={`${created} was created with some warnings.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setWarnings(null);
                setCreated(null);
                reset(toForm(null, defaultScenario));
              }}
            >
              Add another
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        }
      >
        <ul className="space-y-1.5 text-sm">
          {warnings.map((w, i) => (
            <li key={i} className="rounded-lg bg-warning-soft px-3 py-2">
              {w.message}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">You can fix these later by editing the site inline in the table.</p>
      </Modal>
    );
  }

  const extra = Object.entries(site?.extra ?? {});
  const FORMAT_OF: Partial<Record<keyof FormValues, InputFormat>> = { pincode: "pincode", mobile: "phone", gstin: "gst" };
  const f = (k: keyof FormValues, label: string, opts: { required?: boolean; className?: string; hint?: string } = {}) => (
    <Field label={label} htmlFor={`sf-${k}`} error={errors[k]?.message} required={opts.required} className={opts.className} hint={opts.hint}>
      <Input id={`sf-${k}`} format={FORMAT_OF[k]} aria-invalid={!!errors[k]} disabled={readOnly} {...register(k)} />
    </Field>
  );

  return (
    <Modal
      open
      variant={editing ? "drawer" : "dialog"}
      className={editing ? undefined : "max-w-2xl"}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? site.siteCode : "Add site"}
      description={editing ? (readOnly ? "Site details." : "Edit all fields. sq.ft is calculated automatically.") : "Add a single site manually."}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly &&
            (conflict ? (
              <Button type="button" variant="secondary" loading={busy} onClick={submit(true)}>
                Add anyway
              </Button>
            ) : (
              <Button type="submit" form="site-form" loading={busy}>
                {editing ? "Save changes" : "Add site"}
              </Button>
            ))}
        </>
      }
    >
      <form id="site-form" onSubmit={submit(false)} noValidate className="space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        {conflict && (
          <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2 text-sm">
            A site with the same shop, dealer and district already exists. Change the details, or add it anyway.
          </p>
        )}

        <fieldset className="space-y-2" disabled={readOnly || editing}>
          <legend className="text-sm font-medium">Data scenario</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCENARIOS.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${scenario === s ? "border-primary bg-secondary" : "border-border"}`}
              >
                <input type="radio" value={s} className="mt-0.5 accent-primary" {...register("scenario")} />
                <span>
                  <span className="block font-medium">{SCENARIO_LABEL[s]}</span>
                  <span className="text-xs text-muted-foreground">
                    {s === "MEASUREMENT_REQUIRED" ? "Our team measures the board later." : "Client supplies the measured size now."}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {f("shopName", "Shop name", { required: true })}
          {f("dealerName", "Dealer / customer name")}
          {f("location", "Location / area")}
          {f("district", "District")}
          {f("address1", "Address line 1")}
          {f("address2", "Address line 2")}
          {f("address3", "Address line 3")}
          {f("pincode", "Pincode")}
          {f("mobile", "Mobile", { hint: "10-digit Indian number" })}
          {f("gstin", "GST No")}
          {f("contactPerson", "Contact person")}
          {f("clientSiteCode", "Client site code")}
          {f("boardType", "Board type")}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Width" htmlFor="sf-width" error={errors.width?.message} required={scenario === "CLIENT_PROVIDED"}>
            <Input id="sf-width" format="decimal" aria-invalid={!!errors.width} disabled={readOnly} {...register("width")} />
          </Field>
          <Field label="Height" htmlFor="sf-height" error={errors.height?.message} required={scenario === "CLIENT_PROVIDED"}>
            <Input id="sf-height" format="decimal" aria-invalid={!!errors.height} disabled={readOnly} {...register("height")} />
          </Field>
          <Field label="Unit" htmlFor="sf-unit">
            <Select id="sf-unit" disabled={readOnly} {...register("unit")}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Qty" htmlFor="sf-quantity" error={errors.quantity?.message}>
            <Input id="sf-quantity" format="digits" aria-invalid={!!errors.quantity} disabled={readOnly} {...register("quantity")} />
          </Field>
        </div>
        {site && (
          <p className="text-sm text-muted-foreground">
            Sq.ft (calculated): <span className="font-medium text-foreground">{site.sqft ?? "-"}</span>
          </p>
        )}

        <Field label="Remarks" htmlFor="sf-remarks" error={errors.remarks?.message}>
          <Textarea id="sf-remarks" disabled={readOnly} {...register("remarks")} />
        </Field>

        {extra.length > 0 && (
          <section aria-label="Extra columns from import">
            <h3 className="mb-2 text-sm font-medium">Extra columns from import</h3>
            <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-muted p-3 text-sm sm:grid-cols-2">
              {extra.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="truncate text-xs text-muted-foreground">{k}</dt>
                  <dd className="break-words">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </form>
    </Modal>
  );
}
