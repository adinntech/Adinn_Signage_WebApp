"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FileSpreadsheet, MapPinned, Plus, Ruler, Save, Send, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { FileDrop, FileRow, releasePicked, type PickedFile } from "@/components/upload/file-drop";
import { ProjectDocuments } from "@/components/upload/project-documents";
import { Stepper } from "@/components/workflow/stepper";
import { ApiError, errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  uploadProjectFiles,
  useAssignees,
  useAssignProject,
  useCreatePipelineProject,
  useUpdatePipelineProject,
  type PipelineProjectInput,
} from "@/lib/api/pipeline";
import { useClientOptions } from "@/lib/api/clients";
import { useProject, type Project, type RequirementType } from "@/lib/api/projects";
import { formatDate } from "@/lib/format";
import { dateOnly, reqLabel } from "@/lib/pipeline";
import { MOBILE_MESSAGE, PROJECT_CODE_RE, isEmail, isMobile, normalizeMobile } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { ClientPicker } from "./client-picker";

const STEPS = ["Project Details", "Client Contacts", "Requirements", "Documents", "Assignment"];

const REQUIREMENTS: { value: RequirementType; title: string; hint: string; icon: LucideIcon; color: string }[] = [
  { value: "ASO", title: "ASO", hint: "Area sales office survey. Shop count is unknown; the team discovers shops on the ground.", icon: MapPinned, color: "text-recce bg-[#dcf7f3] border-recce" },
  { value: "SHOP_DETAILS", title: "Shop Details Only", hint: "Client shares shop list with addresses. No measurement needed.", icon: FileSpreadsheet, color: "text-royal bg-[#e8f0ff] border-royal" },
  { value: "SHOP_MEASUREMENT", title: "Shop + Measurement", hint: "Shop list with existing board W × H details to verify and approve.", icon: Ruler, color: "text-vendor bg-[#f1e6ff] border-vendor" },
];

const newContact = () => ({ id: Math.random().toString(36).slice(2, 10), name: "", email: "", phone: "" });

const schema = z
  .object({
    code: z.string().trim().refine((v) => !v || PROJECT_CODE_RE.test(v), "Use 4-20 letters, numbers or dashes (or leave blank to auto-generate)"),
    clientId: z.string().min(1, "Select the client"),
    campaign: z.string().trim().min(2, "Enter the campaign name").max(120),
    district: z.string().trim().min(2, "Enter the district / location").max(120),
    startDate: z.string().min(1, "Pick a start date"),
    endDate: z.string().min(1, "Pick the expected end date"),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    contacts: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().trim().min(2, "Enter the contact name"),
          email: z.string().trim().refine(isEmail, "Enter a valid email address"),
          phone: z.string().trim().refine(isMobile, MOBILE_MESSAGE),
        }),
      )
      .min(1, "Add at least one client contact"),
    requirementType: z.enum(["ASO", "SHOP_DETAILS", "SHOP_MEASUREMENT"]),
    expectedShops: z.string(),
    assigneeId: z.string(),
    instructions: z.string().max(1000, "Keep instructions under 1000 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date" });
    if (v.requirementType !== "ASO" && !/^[1-9]\d{0,5}$/.test(v.expectedShops.trim())) ctx.addIssue({ code: "custom", path: ["expectedShops"], message: "Enter the number of shops (whole number, at least 1)" });
    const phones = new Map<string, number>();
    const emails = new Map<string, number>();
    v.contacts.forEach((c, i) => {
      const p = normalizeMobile(c.phone);
      const e = c.email.trim().toLowerCase();
      if (p && phones.has(p)) ctx.addIssue({ code: "custom", path: ["contacts", i, "phone"], message: `Same mobile number as contact ${phones.get(p)! + 1}` });
      else if (p) phones.set(p, i);
      if (e && emails.has(e)) ctx.addIssue({ code: "custom", path: ["contacts", i, "email"], message: `Same email as contact ${emails.get(e)! + 1}` });
      else if (e) emails.set(e, i);
    });
  });
type FormValues = z.infer<typeof schema>;

const STEP_FIELDS: FieldPath<FormValues>[][] = [
  ["code", "clientId", "campaign", "district", "startDate", "endDate", "priority"],
  ["contacts"],
  ["requirementType", "expectedShops"],
  [],
  ["assigneeId", "instructions"],
];

export function ProjectWizard() {
  const editId = useSearchParams().get("edit");
  const project = useProject(editId ?? "");
  if (editId) {
    if (project.isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading project…</p>;
    if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not load the project" />;
    return <WizardForm key={project.data._id} existing={project.data} />;
  }
  return <WizardForm />;
}

function WizardForm({ existing }: { existing?: Project }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const assignees = useAssignees();
  const createProject = useCreatePipelineProject();
  const updateProject = useUpdatePipelineProject();
  const assignProject = useAssignProject();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  /** Set once the project exists on the server, so a retry updates it instead of creating a second one. */
  const savedRef = useRef<string | undefined>(existing?._id);
  const [savedId, setSavedId] = useState<string | undefined>(existing?._id);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      code: existing?.code ?? "",
      clientId: existing?.client._id ?? "",
      campaign: existing?.campaign ?? "",
      district: existing?.district ?? "",
      startDate: dateOnly(existing?.startDate) || new Date().toISOString().slice(0, 10),
      endDate: dateOnly(existing?.targetDate),
      priority: (["HIGH", "MEDIUM", "LOW"].includes(existing?.priority ?? "") ? existing?.priority : "MEDIUM") as FormValues["priority"],
      contacts: existing?.contacts?.length ? existing.contacts.map((c) => ({ id: c._id ?? newContact().id, name: c.name, email: c.email, phone: c.phone })) : [newContact()],
      requirementType: existing?.requirementType ?? "SHOP_MEASUREMENT",
      expectedShops: existing?.expectedShops ? String(existing.expectedShops) : "",
      assigneeId: existing?.assignedTo?._id ?? "",
      instructions: existing?.instructions ?? "",
    },
  });
  const { register, control, trigger, getValues, setValue, setError, formState } = form;
  const { errors } = formState;
  const contacts = useFieldArray({ control, name: "contacts" });
  const reqType = useWatch({ control, name: "requirementType" });
  const v = useWatch({ control }) as FormValues;
  const editing = !!existing;
  const wasAssigned = !!existing?.assignedTo;
  const locked = !!existing && ["IN_PROGRESS", "CLIENT_APPROVAL", "COMPLETED", "CANCELLED"].includes(existing.status);
  const codeLocked = editing && wasAssigned;
  const clientList = useClientOptions();
  const clientName = useMemo(() => existing?.client.name ?? clientList.data?.data.find((c) => c._id === v.clientId)?.name, [existing, clientList.data, v.clientId]);

  const toBody = (x: FormValues, draft = false): PipelineProjectInput => ({
    code: x.code.trim() || undefined,
    campaign: x.campaign.trim(),
    priority: x.priority,
    startDate: x.startDate || undefined,
    targetDate: x.endDate || undefined,
    district: x.district.trim() || undefined,
    instructions: x.instructions.trim() || undefined,
    requirementType: x.requirementType,
    expectedShops: x.requirementType === "ASO" ? null : Number(x.expectedShops) || undefined,
    // A draft may be incomplete: only contacts that are fully valid are saved, the rest stay on screen.
    contacts: x.contacts.filter((c) => (draft ? c.name.trim().length >= 2 && isEmail(c.email) && isMobile(c.phone) : c.name.trim())).map((c) => ({ name: c.name.trim(), email: c.email.trim().toLowerCase(), phone: normalizeMobile(c.phone) })),
  });

  /** Show server-side validation (duplicates, bad numbers) next to the right field, and jump to its step. */
  function applyServerError(e: unknown) {
    const map = fieldErrorsOf(e);
    let first: number | undefined;
    const put = (name: FieldPath<FormValues>, message: string) => {
      setError(name, { type: "server", message });
      const s = STEP_FIELDS.findIndex((f) => f.some((n) => name === n || name.startsWith(`${n}.`)));
      if (s >= 0 && (first === undefined || s < first)) first = s;
    };
    for (const [path, message] of Object.entries(map)) put((path === "targetDate" ? "endDate" : path) as FieldPath<FormValues>, message);
    if (e instanceof ApiError && !Object.keys(map).length) {
      if (/project code/i.test(e.message)) put("code", e.message);
      else if (/campaign/i.test(e.message)) put("campaign", e.message);
    }
    if (first !== undefined) setStep(first);
    toast(errorMessage(e), "error");
  }

  /** Create or update the project record. Returns its id. */
  async function persist(x: FormValues, draft: boolean): Promise<string> {
    const body = toBody(x, draft);
    if (savedRef.current) {
      await updateProject.mutateAsync({ id: savedRef.current, body });
      return savedRef.current;
    }
    const created = await createProject.mutateAsync({ ...body, clientId: x.clientId, status: "DRAFT" });
    savedRef.current = created._id;
    setSavedId(created._id);
    return created._id;
  }

  /** Upload picked files; keeps the ones that failed so the user can retry without losing them. */
  async function flushFiles(projectId: string): Promise<boolean> {
    if (!pending.length) return true;
    const res = await uploadProjectFiles(projectId, "BD_CLIENT_DETAILS", pending.map((p) => p.file));
    // Anything showing this project's files (the sidebar here, the dashboard drawer) must refetch.
    await qc.invalidateQueries({ queryKey: ["files", projectId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    const failed = new Set(res.filter((r) => !r.ok).map((r) => r.file));
    for (const r of res.filter((x) => !x.ok)) toast(`${r.file.name}: ${r.error}`, "error");
    pending.filter((p) => !failed.has(p.file)).forEach(releasePicked);
    setPending((all) => all.filter((p) => failed.has(p.file)));
    return failed.size === 0;
  }

  async function next() {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function saveDraft() {
    if (!(await trigger(["code", "clientId", "campaign"]))) {
      setStep(0);
      toast("Select the client and enter the campaign (and a valid project code, if any) to save a draft", "error");
      return;
    }
    setBusy(true);
    try {
      const x = getValues();
      const id = await persist({ ...x, contacts: x.contacts.filter((c) => c.name.trim() || c.email.trim() || c.phone.trim()) } as FormValues, true);
      const filesOk = await flushFiles(id);
      toast(filesOk ? "Draft saved" : "Draft saved, but some files were not uploaded", filesOk ? "success" : "error");
      if (filesOk) router.push("/bd/dashboard");
    } catch (e) {
      applyServerError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      if (!(await trigger())) {
        const bad = STEP_FIELDS.findIndex((fields) => fields.some((f) => form.getFieldState(f).invalid));
        setStep(Math.max(bad, 0));
        toast("Please fix the highlighted fields", "error");
        return;
      }
      const x = getValues();
      if (!x.assigneeId) {
        setError("assigneeId", { type: "required", message: "Choose who in Operations will receive this project" });
        setStep(4);
        return;
      }
      const id = await persist(x, false);
      if (!(await flushFiles(id))) return; // stay here: the project is saved, failed files remain in the list
      if (editing && wasAssigned && x.assigneeId === existing.assignedTo?._id) {
        toast(`Project ${existing.code} updated`);
        router.push(`/bd/dashboard?view=${id}`);
        return;
      }
      await assignProject.mutateAsync({ id, assigneeId: x.assigneeId });
      router.push(`/bd/projects/${id}/assigned`);
    } catch (e) {
      applyServerError(e);
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <EmptyState
        title={`This project is ${existing!.status.toLowerCase().replace("_", " ")}`}
        description="It can no longer be edited from the assignment form."
        action={<Button asChild><Link href="/bd/dashboard">Back to dashboard</Link></Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader
          code="A2"
          title={editing ? `Edit Project ${existing.code}` : "Create & Assign Project to Operations"}
          subtitle="BD / Client Servicing"
          right={
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white">
              <Link href="/bd/dashboard"><ArrowLeft className="size-4" aria-hidden /> Dashboard</Link>
            </Button>
          }
        />
        <div className="border-b border-border px-4 py-3">
          <Stepper steps={STEPS} current={step} onStep={setStep} />
        </div>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step === STEPS.length - 1) void submit();
            else void next();
          }}
          className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <div className="min-h-[420px] p-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Project Code" htmlFor="code" error={errors.code?.message} hint={codeLocked ? "The code cannot change after assignment." : "Leave blank to auto-generate (SGN-CLIENT-YEAR-NNN)."}>
                      <Input id="code" {...register("code")} disabled={codeLocked} aria-invalid={!!errors.code} className="font-semibold uppercase tabular-nums" placeholder="e.g. 22070277" />
                    </Field>
                    <Field label="Client Name" htmlFor="clientId" required error={errors.clientId?.message}>
                      <Controller control={control} name="clientId" render={({ field }) => <ClientPicker id="clientId" value={field.value} onChange={field.onChange} invalid={!!errors.clientId} disabled={editing} />} />
                    </Field>
                    <Field label="Campaign" htmlFor="campaign" required error={errors.campaign?.message}>
                      <Input id="campaign" {...register("campaign")} aria-invalid={!!errors.campaign} placeholder="e.g. Dindigul Campaign" />
                    </Field>
                    <Field label="District / Location" htmlFor="district" required error={errors.district?.message}>
                      <Input id="district" {...register("district")} aria-invalid={!!errors.district} placeholder="e.g. Dindigul" />
                    </Field>
                    <Field label="Start Date" htmlFor="startDate" required error={errors.startDate?.message}>
                      <Input id="startDate" type="date" {...register("startDate")} aria-invalid={!!errors.startDate} />
                    </Field>
                    <Field label="Expected End Date" htmlFor="endDate" required error={errors.endDate?.message}>
                      <Input id="endDate" type="date" {...register("endDate")} aria-invalid={!!errors.endDate} />
                    </Field>
                    <Field label="Priority" htmlFor="priority" className="sm:col-span-2">
                      <Controller
                        control={control}
                        name="priority"
                        render={({ field }) => (
                          <div role="radiogroup" aria-label="Priority" className="grid max-w-md grid-cols-3 gap-2">
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
                                    ? p === "HIGH" ? "border-loss bg-[#ffe8e8] text-loss" : p === "MEDIUM" ? "border-approval bg-[#fff0e0] text-approval" : "border-finance bg-[#e2f8ea] text-finance"
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
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Client SO / coordinators the team should contact. Mobile numbers must be 10 digits.</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => contacts.append(newContact())}>
                        <Plus className="size-4" aria-hidden /> Add contact
                      </Button>
                    </div>
                    {errors.contacts?.message && <p role="alert" className="text-xs text-danger">{errors.contacts.message}</p>}
                    {contacts.fields.map((f, i) => (
                      <div key={f.id} className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-navy">Contact {i + 1}</p>
                          {contacts.fields.length > 1 && (
                            <button type="button" onClick={() => contacts.remove(i)} aria-label={`Remove contact ${i + 1}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger">
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="SO Contact Name" htmlFor={`c-name-${i}`} required error={errors.contacts?.[i]?.name?.message}>
                            <Input id={`c-name-${i}`} {...register(`contacts.${i}.name`)} aria-invalid={!!errors.contacts?.[i]?.name} />
                          </Field>
                          <Field label="Email" htmlFor={`c-email-${i}`} required error={errors.contacts?.[i]?.email?.message}>
                            <Input id={`c-email-${i}`} type="email" {...register(`contacts.${i}.email`)} aria-invalid={!!errors.contacts?.[i]?.email} />
                          </Field>
                          <Field label="Mobile" htmlFor={`c-mobile-${i}`} required error={errors.contacts?.[i]?.phone?.message}>
                            <Input id={`c-mobile-${i}`} inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile" {...register(`contacts.${i}.phone`)} aria-invalid={!!errors.contacts?.[i]?.phone} />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div role="radiogroup" aria-label="Requirement type" className="grid gap-3 md:grid-cols-3">
                      {REQUIREMENTS.map((r) => {
                        const on = reqType === r.value;
                        const Icon = r.icon;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setValue("requirementType", r.value, { shouldValidate: true, shouldDirty: true })}
                            className={cn("flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all", on ? r.color : "border-border bg-surface hover:border-royal/40 hover:shadow-soft")}
                          >
                            <span className={cn("flex size-10 items-center justify-center rounded-lg", on ? "bg-white/70" : r.color.split(" ").slice(0, 2).join(" "))}>
                              <Icon className="size-5" aria-hidden />
                            </span>
                            <span className="text-sm font-semibold text-navy">{r.title}</span>
                            <span className="text-xs text-muted-foreground">{r.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                    {reqType === "ASO" ? (
                      <p className="rounded-lg bg-[#dcf7f3] p-3 text-sm text-recce">
                        Shop count is <strong>unknown</strong> for ASO projects. Operations will record discovered shops and proof during the survey.
                      </p>
                    ) : (
                      <Field label="Total Shops" htmlFor="expectedShops" required error={errors.expectedShops?.message} hint="The number of shops the client expects; Operations imports the actual list." className="max-w-xs">
                        <Input id="expectedShops" inputMode="numeric" {...register("expectedShops")} aria-invalid={!!errors.expectedShops} placeholder="e.g. 250" />
                      </Field>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Upload the client brief, shop list (Excel/CSV), reference images or any requirement document. Files are stored against the client and project.</p>
                    <FileDrop onError={(m) => toast(m, "error")} onFiles={(f) => setPending((a) => [...a, ...f])} />
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Assign to Operations" htmlFor="assigneeId" required error={errors.assigneeId?.message}>
                        <Select id="assigneeId" {...register("assigneeId")} aria-invalid={!!errors.assigneeId} disabled={assignees.isPending}>
                          <option value="">{assignees.isPending ? "Loading team…" : "Select team member"}</option>
                          {assignees.data?.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.role === "RECCE_COORDINATOR" ? "Recce Coordinator" : "Operations"})
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <div className="rounded-lg bg-[#eef4ff] p-3 text-sm text-navy">
                        <p className="font-medium">Due date</p>
                        <p className="text-muted-foreground">{v.endDate ? formatDate(v.endDate) : "Set on step 1"}</p>
                      </div>
                    </div>
                    {assignees.isError && <p role="alert" className="text-xs text-danger">Could not load the Operations team. <button type="button" className="underline" onClick={() => assignees.refetch()}>Retry</button></p>}
                    {assignees.data?.length === 0 && <p className="rounded-lg bg-[#fff0e0] p-3 text-sm text-approval">No active Operations users exist yet. Ask an admin to create one.</p>}
                    <Field label="Add Instructions" htmlFor="instructions" error={errors.instructions?.message}>
                      <Textarea id="instructions" rows={4} {...register("instructions")} placeholder="Please find the attached excel, brief and requirements." />
                    </Field>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="space-y-4 border-t border-border bg-muted/30 p-5 lg:border-l lg:border-t-0">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-navy">Attachments</h3>
              {savedId && (
                <div className="mb-3">
                  <ProjectDocuments projectId={savedId} category="BD_CLIENT_DETAILS" canEdit uploader={false} emptyText="No files uploaded yet." />
                </div>
              )}
              {pending.length === 0 ? (
                !savedId && <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">No files yet. Add them in the Documents step.</p>
              ) : (
                <ul className="max-h-60 space-y-2 overflow-y-auto">
                  {pending.map((p) => (
                    <FileRow
                      key={p.id}
                      name={p.name}
                      size={p.size}
                      kind={p.kind}
                      previewUrl={p.previewUrl}
                      note="not uploaded yet"
                      onRemove={() => {
                        releasePicked(p);
                        setPending((all) => all.filter((x) => x.id !== p.id));
                      }}
                    />
                  ))}
                </ul>
              )}
              {step !== 3 && (
                <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => setStep(3)}>
                  <Plus className="size-4" aria-hidden /> Add Files
                </Button>
              )}
            </section>
            <section className="rounded-xl border border-border bg-surface p-3 text-sm">
              <h3 className="mb-2 text-sm font-semibold text-navy">Summary</h3>
              <dl className="space-y-1.5">
                {[
                  ["Code", v.code || "Auto"],
                  ["Client", clientName ?? (v.clientId ? "Selected" : "-")],
                  ["Campaign", v.campaign || "-"],
                  ["Requirement", reqLabel(reqType)],
                  ["Shops", reqType === "ASO" ? "Unknown" : v.expectedShops || "-"],
                  ["Dates", v.startDate && v.endDate ? `${formatDate(v.startDate)} → ${formatDate(v.endDate)}` : "-"],
                ].map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="truncate text-right font-medium text-foreground">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur lg:col-span-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => (step === 0 ? router.push("/bd/dashboard") : setStep(step - 1))}>
                <ArrowLeft className="size-4" aria-hidden /> {step === 0 ? "Cancel" : "Back"}
              </Button>
              {!(editing && wasAssigned) && (
                <Button type="button" variant="ghost" onClick={() => void saveDraft()} disabled={busy}>
                  <Save className="size-4" aria-hidden /> Save as Draft
                </Button>
              )}
            </div>
            {step < STEPS.length - 1 ? (
              <Button type="submit" className="bg-royal hover:bg-royal/90">Next <ArrowRight className="size-4" aria-hidden /></Button>
            ) : (
              <Button type="submit" loading={busy} className="bg-royal hover:bg-royal/90">
                <Send className="size-4" aria-hidden /> {wasAssigned ? "Save changes" : "Assign to Operations"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
