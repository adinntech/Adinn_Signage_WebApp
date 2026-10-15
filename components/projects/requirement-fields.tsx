"use client";

import { Controller, useWatch, type FieldPath, type UseFormReturn } from "react-hook-form";
import { Paperclip, Ruler, ClipboardCheck, X } from "lucide-react";
import { z } from "zod";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { SOURCES, type Requirement } from "@/lib/api/projects";
import { formatBytes, label } from "@/lib/format";
import { cn } from "@/lib/utils";

const PHONE = /^[+\d][\d\s-]{6,15}$/;

export const requirementSchema = z.object({
  source: z.enum(SOURCES),
  sourceNote: z.string().trim().max(500),
  contactName: z.string().trim().max(120),
  contactPhone: z.string().trim().refine((v) => v === "" || PHONE.test(v), "Invalid phone number"),
  contactEmail: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Invalid email"),
  expectedSites: z.string().trim().regex(/^\d{0,6}$/, "Whole number only"),
  locations: z.array(z.string()),
  description: z.string().trim().max(5000),
  commercialNotes: z.string().trim().max(5000),
  recceRequired: z.boolean(),
  siteDataScenario: z.enum(["MEASUREMENT_REQUIRED", "CLIENT_PROVIDED"]),
  attachments: z.array(z.object({ name: z.string(), size: z.number().optional(), mimeType: z.string().optional() })),
});
export type RequirementForm = z.infer<typeof requirementSchema>;

export const EMPTY_REQUIREMENT: RequirementForm = {
  source: "EMAIL",
  sourceNote: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  expectedSites: "",
  locations: [],
  description: "",
  commercialNotes: "",
  recceRequired: true,
  siteDataScenario: "MEASUREMENT_REQUIRED",
  attachments: [],
};

export const requirementToForm = (r?: Requirement | null): RequirementForm =>
  r
    ? {
        source: r.source,
        sourceNote: r.sourceNote ?? "",
        contactName: r.contact?.name ?? "",
        contactPhone: r.contact?.phone ?? "",
        contactEmail: r.contact?.email ?? "",
        expectedSites: r.expectedSites === undefined || r.expectedSites === null ? "" : String(r.expectedSites),
        locations: r.locations ?? [],
        description: r.description ?? "",
        commercialNotes: r.commercialNotes ?? "",
        recceRequired: r.recceRequired,
        siteDataScenario: r.siteDataScenario,
        attachments: (r.attachments ?? []).map((a) => ({ name: a.name, size: a.size, mimeType: a.mimeType })),
      }
    : EMPTY_REQUIREMENT;

export const requirementToPayload = (v: RequirementForm): Requirement => ({
  source: v.source,
  sourceNote: v.sourceNote || undefined,
  contact: { name: v.contactName || undefined, phone: v.contactPhone || undefined, email: v.contactEmail || undefined },
  expectedSites: v.expectedSites === "" ? undefined : Number(v.expectedSites),
  locations: v.locations,
  description: v.description || undefined,
  commercialNotes: v.commercialNotes || undefined,
  recceRequired: v.recceRequired,
  siteDataScenario: v.siteDataScenario,
  attachments: v.attachments,
});

/** Server-side field paths for the requirement, mapped onto the flat form. */
export const REQUIREMENT_PATH_MAP: Record<string, string> = {
  "requirement.source": "source",
  "requirement.sourceNote": "sourceNote",
  "requirement.contact.name": "contactName",
  "requirement.contact.phone": "contactPhone",
  "requirement.contact.email": "contactEmail",
  "requirement.expectedSites": "expectedSites",
  "requirement.locations": "locations",
  "requirement.description": "description",
  "requirement.commercialNotes": "commercialNotes",
  contact_name: "contactName",
  "contact.name": "contactName",
  "contact.phone": "contactPhone",
  "contact.email": "contactEmail",
};

const SCENARIOS = [
  {
    value: "MEASUREMENT_REQUIRED" as const,
    title: "Scenario 1 - Measurement required",
    text: "Our team or vendor visits each site and measures it. Site details are captured during recce.",
    icon: Ruler,
  },
  {
    value: "CLIENT_PROVIDED" as const,
    title: "Scenario 2 - Client provides data",
    text: "The client already has measured site data. We import it and verify instead of re-measuring.",
    icon: ClipboardCheck,
  },
];

export function RequirementFields({ form, idPrefix = "r" }: { form: UseFormReturn<RequirementForm>; idPrefix?: string }) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const scenario = useWatch({ control, name: "siteDataScenario" });
  const attachments = useWatch({ control, name: "attachments" });
  const id = (n: string) => `${idPrefix}-${n}`;
  const set = (k: FieldPath<RequirementForm>, v: unknown) =>
    setValue(k, v as never, { shouldDirty: true, shouldValidate: true });

  return (
    <div className="space-y-8">
      <section aria-labelledby={id("src")} className="space-y-4">
        <h3 id={id("src")} className="text-sm font-semibold text-primary">
          Requirement source
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How did the requirement arrive?" htmlFor={id("source")} required error={errors.source?.message}>
            <Select id={id("source")} {...register("source")}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Source note"
            htmlFor={id("srcnote")}
            error={errors.sourceNote?.message}
            hint="Who referred it, meeting date, call reference..."
          >
            <Input id={id("srcnote")} {...register("sourceNote")} />
          </Field>
        </div>
      </section>

      <section aria-labelledby={id("contact")} className="space-y-4">
        <h3 id={id("contact")} className="text-sm font-semibold text-primary">
          Client contact for this requirement
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" htmlFor={id("cname")} error={errors.contactName?.message}>
            <Input id={id("cname")} {...register("contactName")} />
          </Field>
          <Field label="Phone" htmlFor={id("cphone")} error={errors.contactPhone?.message}>
            <Input id={id("cphone")} inputMode="tel" aria-invalid={!!errors.contactPhone} {...register("contactPhone")} />
          </Field>
          <Field label="Email" htmlFor={id("cemail")} error={errors.contactEmail?.message}>
            <Input id={id("cemail")} type="email" aria-invalid={!!errors.contactEmail} {...register("contactEmail")} />
          </Field>
        </div>
      </section>

      <section aria-labelledby={id("sites")} className="space-y-4">
        <h3 id={id("sites")} className="text-sm font-semibold text-primary">
          Scope
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Expected sites" htmlFor={id("exp")} error={errors.expectedSites?.message}>
            <Input id={id("exp")} inputMode="numeric" aria-invalid={!!errors.expectedSites} {...register("expectedSites")} />
          </Field>
          <Field
            label="Locations"
            htmlFor={id("loc")}
            className="sm:col-span-2"
            hint="Press Enter or comma to add a city / area."
            error={errors.locations?.message as string | undefined}
          >
            <Controller
              control={control}
              name="locations"
              render={({ field }) => (
                <TagInput id={id("loc")} value={field.value} onChange={field.onChange} placeholder="e.g. Mumbai, Pune" />
              )}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" {...register("recceRequired")} />
          Recce required for this project
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Site data scenario</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SCENARIOS.map((s) => {
              const Icon = s.icon;
              const active = scenario === s.value;
              return (
                <label
                  key={s.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    active ? "border-primary bg-secondary" : "border-border bg-surface hover:bg-muted",
                  )}
                >
                  <input type="radio" value={s.value} className="sr-only" {...register("siteDataScenario")} />
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{s.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{s.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby={id("desc")} className="space-y-4">
        <h3 id={id("desc")} className="text-sm font-semibold text-primary">
          Details
        </h3>
        <Field label="Requirement description" htmlFor={id("description")} error={errors.description?.message}>
          <Textarea id={id("description")} {...register("description")} />
        </Field>
        <Field label="Commercial notes" htmlFor={id("comm")} error={errors.commercialNotes?.message}>
          <Textarea id={id("comm")} className="min-h-20" {...register("commercialNotes")} />
        </Field>
      </section>

      <section aria-labelledby={id("att")} className="space-y-3">
        <h3 id={id("att")} className="text-sm font-semibold text-primary">
          Attachments
        </h3>
        <p className="text-xs text-muted-foreground">
          Only the file name, size and type are recorded for now. File upload storage arrives in a later phase.
        </p>
        <input
          id={id("files")}
          type="file"
          multiple
          aria-label="Add attachments"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary-hover"
          onChange={(e) => {
            const added = Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size, mimeType: f.type || undefined }));
            set("attachments", [...attachments, ...added].slice(0, 50));
            e.target.value = "";
          }}
        />
        {attachments.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {attachments.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() =>
                    set(
                      "attachments",
                      attachments.filter((_, j) => j !== i),
                    )
                  }
                  className="rounded p-1 text-muted-foreground hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
