"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  FileSpreadsheet,
  FolderPlus,
  MapPinned,
  Paperclip,
  Plus,
  Ruler,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  useCodeOrders,
  useCreateProjectFromOrder,
  useProjectDraft,
  type ProjectDraft,
} from "@/lib/api/codeRequests";
import { formatDate } from "@/lib/format";
import {
  MOBILE_MESSAGE,
  isEmail,
  isMobile,
  normalizeMobile,
} from "@/lib/validation";
import { cn } from "@/lib/utils";

const REQUIREMENTS: {
  value: "ASO" | "SHOP_DETAILS" | "SHOP_MEASUREMENT";
  title: string;
  hint: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    value: "ASO",
    title: "ASO",
    hint: "Area sales office survey. The team discovers shops on the ground.",
    icon: MapPinned,
    color: "text-recce bg-[#dcf7f3] border-recce",
  },
  {
    value: "SHOP_DETAILS",
    title: "Shop Details Only",
    hint: "Client shares the shop list. No measurement needed.",
    icon: FileSpreadsheet,
    color: "text-royal bg-[#e8f0ff] border-royal",
  },
  {
    value: "SHOP_MEASUREMENT",
    title: "Shop + Measurement",
    hint: "Shop list with board sizes to verify and approve.",
    icon: Ruler,
    color: "text-vendor bg-[#f1e6ff] border-vendor",
  },
];

const schema = z
  .object({
    campaign: z.string().trim().min(2, "Enter the campaign name").max(120),
    district: z
      .string()
      .trim()
      .min(2, "Enter the district / location")
      .max(120),
    startDate: z.string().min(1, "Pick a start date"),
    endDate: z.string().min(1, "Pick the expected end date"),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    contacts: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Enter the contact name").max(120),
          email: z
            .string()
            .trim()
            .refine(isEmail, "Enter a valid email address"),
          phone: z.string().trim().refine(isMobile, MOBILE_MESSAGE),
        }),
      )
      .min(1, "Add at least one client contact"),
    requirementType: z.enum(["ASO", "SHOP_DETAILS", "SHOP_MEASUREMENT"]),
    expectedShops: z.string(),
    instructions: z
      .string()
      .max(1000, "Keep instructions under 1000 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate < v.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    if (
      v.requirementType !== "ASO" &&
      !/^[1-9]\d{0,5}$/.test(v.expectedShops.trim())
    )
      ctx.addIssue({
        code: "custom",
        path: ["expectedShops"],
        message: "Enter the number of shops (whole number, at least 1)",
      });
    const seen = new Map<string, number>();
    v.contacts.forEach((c, i) => {
      const p = normalizeMobile(c.phone);
      if (p && seen.has(p))
        ctx.addIssue({
          code: "custom",
          path: ["contacts", i, "phone"],
          message: `Same mobile number as contact ${seen.get(p)! + 1}`,
        });
      else if (p) seen.set(p, i);
    });
  });
type FormValues = z.infer<typeof schema>;

/** Create Project for Client Servicing: pick a handed-over order whose codes are confirmed, complete the details, assign it to Operations. */
export function CreateProject() {
  const orderId = useSearchParams().get("order") ?? "";
  return orderId ? <OrderProject orderId={orderId} /> : <OrderPicker />;
}

function OrderPicker() {
  const q = useCodeOrders({ bucket: "DONE", limit: 50 });
  const rows = (q.data?.data ?? []).filter((o) => !o.hasProject);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        icon={FolderPlus}
        title="Create Project"
        subtitle="Choose an order whose client code and project code are both confirmed. The project is created from the BD handover."
      />
      <Card className="overflow-hidden">
        <GradientHeader
          title="Orders ready for a project"
          right={
            <span className="text-xs text-white/80">{rows.length} ready</span>
          }
        />
        {q.isPending ? (
          <RowsSkeleton />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title="No order is ready yet"
            description="An order appears here when both codes are confirmed and it has no project. Confirm the pending codes first."
            action={
              <Button asChild variant="brand">
                <Link href="/client-servicing/codes">Open Code Requests</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((o) => (
              <li
                key={o.orderId}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{o.client.name}</span>
                  <span className="font-mono text-xs text-brand">
                    {o.orderNo}
                  </span>
                  <span className="ml-3 font-mono text-xs text-finance">
                    {o.codes.CLIENT_CODE.code} · {o.codes.PROJECT_CODE.code}
                  </span>
                </span>
                <Button size="sm" variant="brand" asChild>
                  <Link
                    href={`/client-servicing/projects/new?order=${o.orderId}`}
                  >
                    Create Project <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function OrderProject({ orderId }: { orderId: string }) {
  const q = useProjectDraft(orderId);
  if (q.isPending)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading the order…
      </p>
    );
  if (q.isError)
    return (
      <ErrorState
        error={q.error}
        onRetry={() => q.refetch()}
        title="Could not load the order"
      />
    );
  const d = q.data;
  if (d.project)
    return (
      <EmptyState
        icon={BadgeCheck}
        title={`Project ${d.project.code} already exists`}
        description={`A project was already created for order ${d.order.orderNo}.`}
        action={
          <Button asChild variant="brand">
            <Link href="/client-servicing/projects/new">
              Create another project
            </Link>
          </Button>
        }
      />
    );
  if (!d.ready)
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <TriangleAlert className="size-5 text-approval" aria-hidden /> Not
            ready yet
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {d.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Button asChild variant="brand">
            <Link href={`/client-servicing/codes/${orderId}/confirm`}>
              Open code confirmation
            </Link>
          </Button>
        </Card>
      </div>
    );
  return <ProjectForm orderId={orderId} d={d} />;
}

const section = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function ProjectForm({ orderId, d }: { orderId: string; d: ProjectDraft }) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const create = useCreateProjectFromOrder(orderId);
  const router = useRouter();
  const validContacts = d.contacts
    .filter(
      (c) => c.name.trim().length >= 2 && isEmail(c.email) && isMobile(c.phone),
    )
    .map((c) => ({
      name: c.name,
      email: c.email,
      phone: normalizeMobile(c.phone),
    }));
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      campaign: "",
      district: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      priority: "MEDIUM",
      contacts: validContacts.length
        ? validContacts
        : [{ name: "", email: "", phone: "" }],
      requirementType: d.handover.type ?? "SHOP_MEASUREMENT",
      expectedShops: d.handover.shops ? String(d.handover.shops) : "",
      instructions: d.handover.notes.slice(0, 1000),
    },
  });
  const { register, control, handleSubmit, setValue, setError, formState } =
    form;
  const { errors } = formState;
  const contacts = useFieldArray({ control, name: "contacts" });
  const reqType = useWatch({ control, name: "requirementType" });
  const endDate = useWatch({ control, name: "endDate" });

  const submit = handleSubmit(async (x) => {
    try {
      const res = await create.mutateAsync({
        campaign: x.campaign.trim(),
        district: x.district.trim(),
        startDate: x.startDate,
        targetDate: x.endDate,
        priority: x.priority,
        requirementType: x.requirementType,
        expectedShops:
          x.requirementType === "ASO" ? null : Number(x.expectedShops),
        contacts: x.contacts.map((c) => ({
          name: c.name.trim(),
          email: c.email.trim().toLowerCase(),
          phone: normalizeMobile(c.phone),
        })),
        instructions: x.instructions.trim() || undefined,
      });
      toast(`Project ${res.code} created. Now choose who gets it.`);
      router.push(`/client-servicing/recce-assignment/${orderId}`);
    } catch (e) {
      for (const [path, message] of Object.entries(fieldErrorsOf(e)))
        setError(
          (path === "targetDate" ? "endDate" : path) as keyof FormValues,
          { type: "server", message },
        );
      if (e instanceof ApiError && /campaign/i.test(e.message))
        setError("campaign", { type: "server", message: e.message });
      toast(errorMessage(e), "error");
    }
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mx-auto flex max-w-6xl flex-col gap-5"
    >
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/client-servicing/projects/new">
          <ArrowLeft className="size-4" aria-hidden /> Other orders
        </Link>
      </Button>
      <PageHeader
        icon={FolderPlus}
        title="Create Project"
        subtitle={`${d.client.name} · order ${d.order.orderNo} · next step: choose who receives it`}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <motion.div
          className="space-y-5"
          initial={reduce ? false : "hidden"}
          animate="show"
          transition={{ staggerChildren: 0.08 }}
        >
          <motion.div variants={section}>
            <Card className="overflow-hidden">
              <GradientHeader title="1. Project details" />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field
                  label="Project Code"
                  htmlFor="code"
                  hint="The confirmed code. It cannot be changed here."
                >
                  <Input
                    id="code"
                    value={d.codes.project ?? ""}
                    readOnly
                    disabled
                    className="font-mono font-semibold"
                  />
                </Field>
                <Field
                  label="Campaign"
                  htmlFor="campaign"
                  required
                  error={errors.campaign?.message}
                >
                  <Input
                    id="campaign"
                    maxLength={120}
                    {...register("campaign")}
                    aria-invalid={!!errors.campaign}
                    placeholder="e.g. Dindigul Campaign"
                  />
                </Field>
                <Field
                  label="District / Location"
                  htmlFor="district"
                  required
                  error={errors.district?.message}
                >
                  <Input
                    id="district"
                    maxLength={120}
                    {...register("district")}
                    aria-invalid={!!errors.district}
                    placeholder="e.g. Dindigul"
                  />
                </Field>
                <Field label="Priority" htmlFor="priority">
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <div
                        role="radiogroup"
                        aria-label="Priority"
                        className="grid grid-cols-3 gap-2"
                      >
                        {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            role="radio"
                            aria-checked={field.value === p}
                            onClick={() => field.onChange(p)}
                            className={cn(
                              "h-10 rounded-lg border text-sm font-semibold transition-colors",
                              field.value === p
                                ? p === "HIGH"
                                  ? "border-loss bg-[#ffe8e8] text-loss"
                                  : p === "MEDIUM"
                                    ? "border-approval bg-[#fff0e0] text-approval"
                                    : "border-finance bg-[#e2f8ea] text-finance"
                                : "border-border text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {p[0] + p.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </Field>
                <Field
                  label="Start Date"
                  htmlFor="startDate"
                  required
                  error={errors.startDate?.message}
                >
                  <Input
                    id="startDate"
                    type="date"
                    {...register("startDate")}
                    aria-invalid={!!errors.startDate}
                  />
                </Field>
                <Field
                  label="Expected End Date"
                  htmlFor="endDate"
                  required
                  error={errors.endDate?.message}
                >
                  <Input
                    id="endDate"
                    type="date"
                    {...register("endDate")}
                    aria-invalid={!!errors.endDate}
                  />
                </Field>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={section}>
            <Card className="overflow-hidden">
              <GradientHeader
                title="2. Client contacts"
                right={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    disabled={contacts.fields.length >= 10}
                    onClick={() =>
                      contacts.append({ name: "", email: "", phone: "" })
                    }
                  >
                    <Plus className="size-4" aria-hidden /> Add contact
                  </Button>
                }
              />
              <div className="space-y-3 p-5">
                {errors.contacts?.message && (
                  <p role="alert" className="text-xs text-danger">
                    {errors.contacts.message}
                  </p>
                )}
                <AnimatePresence initial={false}>
                  {contacts.fields.map((f, i) => (
                    <motion.div
                      key={f.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reduce ? undefined : { opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-navy">
                            Contact {i + 1}
                          </p>
                          {contacts.fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => contacts.remove(i)}
                              aria-label={`Remove contact ${i + 1}`}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field
                            label="Name"
                            htmlFor={`c-name-${i}`}
                            required
                            error={errors.contacts?.[i]?.name?.message}
                          >
                            <Input
                              id={`c-name-${i}`}
                              maxLength={120}
                              {...register(`contacts.${i}.name`)}
                              aria-invalid={!!errors.contacts?.[i]?.name}
                            />
                          </Field>
                          <Field
                            label="Email"
                            htmlFor={`c-email-${i}`}
                            required
                            error={errors.contacts?.[i]?.email?.message}
                          >
                            <Input
                              id={`c-email-${i}`}
                              type="email"
                              maxLength={120}
                              {...register(`contacts.${i}.email`)}
                              aria-invalid={!!errors.contacts?.[i]?.email}
                            />
                          </Field>
                          <Field
                            label="Mobile"
                            htmlFor={`c-mobile-${i}`}
                            required
                            error={errors.contacts?.[i]?.phone?.message}
                          >
                            <Input
                              id={`c-mobile-${i}`}
                              format="phone"
                              autoComplete="tel"
                              placeholder="10-digit mobile"
                              {...register(`contacts.${i}.phone`)}
                              aria-invalid={!!errors.contacts?.[i]?.phone}
                            />
                          </Field>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={section}>
            <Card className="overflow-hidden">
              <GradientHeader title="3. Requirement" />
              <div className="space-y-4 p-5">
                <div
                  role="radiogroup"
                  aria-label="Requirement type"
                  className="grid gap-3 md:grid-cols-3"
                >
                  {REQUIREMENTS.map((r) => {
                    const on = reqType === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() =>
                          setValue("requirementType", r.value, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        className={cn(
                          "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                          on
                            ? r.color
                            : "border-border bg-surface hover:border-royal/40 hover:shadow-soft",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-10 items-center justify-center rounded-lg",
                            on
                              ? "bg-white/70"
                              : r.color.split(" ").slice(0, 2).join(" "),
                          )}
                        >
                          <r.icon className="size-5" aria-hidden />
                        </span>
                        <span className="text-sm font-semibold text-navy">
                          {r.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {d.handover.type && d.handover.type !== reqType && (
                  <p className="rounded-lg bg-[#fff0e0] px-3 py-2 text-xs text-approval">
                    The BD handover says {d.handover.typeLabel}. You changed it.
                  </p>
                )}
                {reqType === "ASO" ? (
                  <p className="rounded-lg bg-[#dcf7f3] p-3 text-sm text-recce">
                    Shop count is unknown for ASO projects. Operations records
                    the shops found during the survey.
                  </p>
                ) : (
                  <Field
                    label="Total Shops"
                    htmlFor="expectedShops"
                    required
                    error={errors.expectedShops?.message}
                    hint={
                      d.handover.shops
                        ? "Taken from the BD handover."
                        : undefined
                    }
                    className="max-w-xs"
                  >
                    <Input
                      id="expectedShops"
                      format="digits"
                      maxLength={6}
                      {...register("expectedShops")}
                      aria-invalid={!!errors.expectedShops}
                      placeholder="e.g. 250"
                    />
                  </Field>
                )}
                <Field
                  label="Instructions for the team (optional)"
                  htmlFor="instructions"
                  error={errors.instructions?.message}
                  hint="Filled from the BD handover notes."
                >
                  <Textarea
                    id="instructions"
                    maxLength={1000}
                    className="min-h-20"
                    {...register("instructions")}
                  />
                </Field>
              </div>
            </Card>
          </motion.div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/client-servicing/projects/new">Cancel</Link>
            </Button>
            <Button type="submit" variant="brand" loading={create.isPending}>
              <ArrowRight className="size-4" aria-hidden /> Create Project &amp;
              Continue
            </Button>
          </div>
        </motion.div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-primary">
              From the handover
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Client</dt>
                <dd className="font-medium">{d.client.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Order</dt>
                <dd className="font-mono font-medium">{d.order.orderNo}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Client code</dt>
                <dd className="flex items-center gap-1 font-mono font-semibold text-finance">
                  <BadgeCheck className="size-4" aria-hidden /> {d.codes.client}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Project code</dt>
                <dd className="flex items-center gap-1 font-mono font-semibold text-finance">
                  <BadgeCheck className="size-4" aria-hidden />{" "}
                  {d.codes.project}
                </dd>
              </div>
              {d.handover.typeLabel && (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Handover type
                  </dt>
                  <dd className="font-medium">{d.handover.typeLabel}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Due</dt>
                <dd className="font-medium">
                  {formVal(endDate) ?? "Set the end date"}
                </dd>
              </div>
            </dl>
            {d.handover.documents > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Paperclip className="size-3.5" aria-hidden />{" "}
                {d.handover.documents} BD handover document
                {d.handover.documents === 1 ? "" : "s"} go with the project
                automatically.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </form>
  );
}

const formVal = (v: string) => (v ? formatDate(v) : null);
