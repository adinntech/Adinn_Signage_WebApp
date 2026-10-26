"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart3, Building2, CalendarDays, ClipboardList, Copy, Eye, History, ListChecks, Lock, Mail, MailCheck, MapPin, Plus, Save, ScrollText, Send, Trash2, UserRound } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { openFile } from "@/lib/api/files";
import { RATE_UNITS, useQuotation, useSaveQuotation, type QuotationState, type QuotationValues, type RateItem, type RateUnit } from "@/lib/api/ratecards";
import { useSendEmail } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatCurrency, toDateInput } from "@/lib/format";
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
  subject: z.string().trim().min(1, "Enter the subject").max(250),
  items: z.array(line).min(1, "Add at least one signage item").max(100),
  terms: z.string(),
  regards: z.object({
    name: z.string().trim().min(1, "Enter the name"),
    designation: z.string().trim().min(1, "Enter the designation"),
    mobile: z.string().trim().refine((v) => /^[6-9]\d{9}$/.test(normalizeMobile(v)), "Enter a 10-digit mobile number"),
    email: z.string().trim().refine(email, "Enter a valid email address"),
  }),
});
type FormValues = z.infer<typeof schema>;

function toForm(d: QuotationState): FormValues {
  const src = d.latest ?? d.draft!;
  return {
    clientAddress: src.clientAddress ?? "",
    contact: { name: src.contact?.name ?? "", designation: src.contact?.designation ?? "", phone: src.contact?.phone ?? "", email: src.contact?.email ?? "" },
    quotationDate: toDateInput(src.quotationDate) || toDateInput(new Date().toISOString()),
    subject: src.subject ?? "",
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
  subject: v.subject,
  items: v.items.map((i) => ({ ...i, specifications: i.specifications || undefined, overrideReason: i.overrideReason || undefined, masterItemId: i.masterItemId || undefined })),
  terms: v.terms,
  regards: { ...v.regards, mobile: normalizeMobile(v.regards.mobile) },
});

type BottomTab = "history" | "send" | "emails";

function Editor({ data, orderId }: { data: QuotationState; orderId: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const editable = data.editable && can("sales:write");
  const save = useSaveQuotation(orderId);
  const send = useSendEmail(orderId, "RATE_CARD");
  const [copyOpen, setCopyOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [tab, setTab] = useState<BottomTab>("history");
  const bottomRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(data), mode: "onTouched" });
  const { register, control, handleSubmit, reset, setValue, setError, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control }) as FormValues;
  const dirty = formState.isDirty;
  useUnsavedWarning(dirty);

  const latestId = data.latest?._id;
  useEffect(() => {
    reset(toForm(data));
    // Reset only when a new revision arrives, not on every refetch of the same data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId, reset]);

  const previewValues = useMemo(() => toApi({ ...watched, items: (watched.items ?? []).map((i) => ({ ...i, quotedRate: Number(i?.quotedRate) || 0 })) } as FormValues), [watched]);
  const e = (p: string) =>
    (p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], formState.errors) as { message?: string } | undefined)?.message;

  const goBottom = (t: BottomTab) => {
    setTab(t);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const onSave = handleSubmit(
    async (v) => {
      try {
        const r = await save.mutateAsync(toApi(v));
        if (r.saved) toast(`Rate card saved as ${r.revision.label}. PDF generated.`);
        else toast("No changes since the last saved revision.", "info");
      } catch (err) {
        const fe = fieldErrorsOf(err);
        for (const [path, message] of Object.entries(fe)) setError(path as FieldPath<FormValues>, { message });
        toast(errorMessage(err), "error");
      }
    },
    () => toast("Fix the highlighted fields before saving.", "error"),
  );

  const addFromMaster = (items: RateItem[]) => {
    for (const r of items) append({ masterItemId: r._id, particulars: r.particulars, specifications: r.specifications ?? "", unit: r.unit, masterRate: r.rate, quotedRate: r.rate, overrideReason: "" });
    toast(`${items.length} item${items.length === 1 ? "" : "s"} copied from the master rate card`);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="xl:sticky xl:top-0 xl:h-[max(600px,calc(100dvh-17rem))]">
          <QuotationPreview orderId={orderId} values={previewValues} quotationRef={data.quotationRef} clientName={data.clientName} latest={data.latest} dirty={dirty} />
        </div>

        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-primary">Rate Card Editor</h2>
              <p className="text-xs text-muted-foreground">Update client details, signage items, pricing and terms. Changes reflect in the PDF preview.</p>
            </div>
            {!data.editable ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Lock className="size-3.5" aria-hidden /> Locked
              </span>
            ) : data.latest ? (
              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">Negotiation in progress · {data.latest.label}</span>
            ) : (
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Not saved yet</span>
            )}
          </div>

          {/* min-w-0: a fieldset is min-content wide by default, which pushed the fields past the card edge. */}
          <fieldset disabled={!editable} className="min-w-0 space-y-6">
            <section>
              <SectionTitle icon={ClipboardList} title="Client & Quotation Details" />
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                <Field label="Client Name" htmlFor="rc-client" hint="Auto-filled">
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input id="rc-client" value={data.clientName} readOnly className="pl-9" />
                  </div>
                </Field>
                <Field label="Contact Person" htmlFor="rc-contact" required error={e("contact.name")}>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
                  </div>
                </Field>
                <Field label="Quotation Date" htmlFor="rc-date" required error={e("quotationDate")}>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input id="rc-date" type="date" className="pl-9" aria-invalid={!!e("quotationDate")} {...register("quotationDate")} />
                  </div>
                </Field>
                <Field label="Client Address" htmlFor="rc-address" error={e("clientAddress")}>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input id="rc-address" className="pl-9" {...register("clientAddress")} />
                  </div>
                </Field>
                <Field label="Subject" htmlFor="rc-subject" required error={e("subject")} className="md:col-span-2 2xl:col-span-4">
                  <Input id="rc-subject" aria-invalid={!!e("subject")} {...register("subject")} />
                </Field>
              </div>
            </section>

            <section>
              <SectionTitle
                icon={ListChecks}
                title="Signage Items & Pricing"
                description="Copy from the master rate card and adjust quoted rates. A reason is required when the quoted rate differs from the master rate."
                action={
                  <Button type="button" variant="brand-outline" size="sm" onClick={() => setCopyOpen(true)}>
                    <Copy className="size-4" aria-hidden /> Copy From Master Rate Card
                  </Button>
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
                      <th className="w-32 px-2 py-2.5">Quoted Rate (₹) *</th>
                      <th className="px-2 py-2.5">Override Reason</th>
                      <th className="w-12 px-2 py-2.5">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No items yet. Copy from the master rate card or add a custom item.
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
                <SectionTitle icon={UserRound} title="Best Regards Details" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" htmlFor="rc-rname" required error={e("regards.name")}>
                    <Input id="rc-rname" aria-invalid={!!e("regards.name")} {...register("regards.name")} />
                  </Field>
                  <Field label="Designation" htmlFor="rc-rdes" required error={e("regards.designation")}>
                    <Input id="rc-rdes" aria-invalid={!!e("regards.designation")} {...register("regards.designation")} />
                  </Field>
                  <Field label="Mobile Number" htmlFor="rc-rmob" required error={e("regards.mobile")}>
                    <Input id="rc-rmob" format="phone" aria-invalid={!!e("regards.mobile")} {...register("regards.mobile")} />
                  </Field>
                  <Field label="Email Address" htmlFor="rc-remail" required error={e("regards.email")}>
                    <Input id="rc-remail" type="email" aria-invalid={!!e("regards.email")} {...register("regards.email")} />
                  </Field>
                </div>
              </section>
            </div>
          </fieldset>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
            {editable && (
              <Button variant="brand" onClick={onSave} loading={save.isPending}>
                <Save className="size-4" aria-hidden /> Save Changes
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!data.latest?.pdf?.fileId}
              title={dirty ? "Opens the last saved PDF; save to include your changes" : undefined}
              onClick={() => data.latest?.pdf?.fileId && openFile(data.latest.pdf.fileId, { orderId }).catch((err) => toast(errorMessage(err), "error"))}
            >
              <Eye className="size-4" aria-hidden /> Preview PDF
            </Button>
            <Button variant="outline" onClick={() => setCompareOpen(true)} disabled={!watched.items?.length}>
              <BarChart3 className="size-4" aria-hidden /> Compare Rates
            </Button>
            {can("sales:write") && (
              <Button variant="outline" onClick={() => goBottom("send")} disabled={!data.latest}>
                <Send className="size-4" aria-hidden /> Send Email
              </Button>
            )}
            <Button variant="outline" onClick={() => goBottom("history")}>
              <History className="size-4" aria-hidden /> View Edit History
            </Button>
            <Button variant="outline" onClick={() => goBottom("emails")}>
              <MailCheck className="size-4" aria-hidden /> View Email History
            </Button>
          </div>
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
              ...(can("sales:write") ? [{ key: "send" as const, label: "Email Sending", icon: Mail }] : []),
              { key: "emails", label: "Email History", icon: MailCheck },
            ]}
          />
          <div id="rc-bottom-panel" role="tabpanel">
            {tab === "history" && <EditHistory orderId={orderId} revisions={data.revisions} />}
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

/** Screen 11: Rate Card stage (left live PDF preview, right editor, bottom history / email tabs). */
export function RateCardStage({ orderId }: { orderId: string }) {
  const q = useQuotation(orderId);
  if (q.isPending)
    return (
      <div className="grid gap-5 xl:grid-cols-[5fr_7fr]">
        <Skeleton className="h-[640px]" />
        <Skeleton className="h-[640px]" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <Editor data={q.data} orderId={orderId} />;
}
