"use client";

import { useRef, useState } from "react";
import { AlignLeft, Download, Eye, FileText, History, Info, Lock, Mail, RotateCcw, Save, Trash2, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { RichTextEditor, RichTextView } from "@/components/ui/rich-text-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { errorMessage } from "@/lib/api";
import { downloadFile, formData, openFile } from "@/lib/api/files";
import { TEMPLATE_SLUG, useCompanyProfileTemplate, useRemoveTemplatePdf, useRestoreTemplate, useSaveTemplate, useTemplateHistory, useUploadTemplatePdf, type EmailTemplate } from "@/lib/api/templates";
import { formatBytes, formatDateTime } from "@/lib/format";

const PLACEHOLDERS = [
  ["{{companyName}}", "Client company name"],
  ["{{contactName}}", "Primary contact person"],
  ["{{senderName}}", "BD employee sending the email"],
] as const;

function ChangeHistory() {
  const q = useTemplateHistory();
  if (q.isPending) return <RowsSkeleton rows={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data.length) return <EmptyState icon={History} title="No changes yet" description="Every saved change to the subject, content or PDF is listed here." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Template Name</th>
            <th className="px-4 py-3">Changed Field</th>
            <th className="px-4 py-3">Previous Value</th>
            <th className="px-4 py-3">Updated Value</th>
            <th className="px-4 py-3">Changed By</th>
            <th className="px-4 py-3">Changed Date &amp; Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {q.data.map((h) => (
            <tr key={h.id} className="align-top">
              <td className="px-4 py-3">{h.templateName}</td>
              <td className="px-4 py-3 font-medium">
                {h.field}
                {h.reason && <span className="block text-xs text-muted-foreground">{h.reason}</span>}
              </td>
              <td className="max-w-72 whitespace-pre-line px-4 py-3 text-muted-foreground">{h.oldValue ?? "-"}</td>
              <td className="max-w-72 whitespace-pre-line px-4 py-3">{h.newValue ?? "-"}</td>
              <td className="px-4 py-3">{h.changedBy}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(h.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Editor({ t }: { t: EmailTemplate }) {
  const toast = useToast();
  const save = useSaveTemplate();
  const restore = useRestoreTemplate();
  const upload = useUploadTemplatePdf();
  const removePdf = useRemoveTemplatePdf();
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({});
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const dirty = subject !== t.subject || body !== t.body;
  useUnsavedWarning(dirty);
  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(errorMessage(e), "error"));

  const onSave = async () => {
    const e = { subject: subject.trim() ? undefined : "Enter the email subject", body: body.replace(/<[^>]+>/g, "").trim() ? undefined : "Enter the email content" };
    setErrors(e);
    if (e.subject || e.body) return;
    try {
      const r = await save.mutateAsync({ subject: subject.trim(), body });
      setSubject(r.subject);
      setBody(r.body);
      toast("Template saved. New Company Profile emails will use it.");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const onUpload = async () => {
    if (!files.length) return toast("Choose a PDF to upload", "error");
    try {
      await upload.mutateAsync(formData(files));
      setFiles([]);
      toast(t.pdf ? "PDF replaced. Emails already sent keep their original PDF." : "PDF uploaded");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3 text-sm text-[#1d4ed8]">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Saved template values are used when a BD sends the Company Profile email from the Sales Handling pipeline. Sent emails keep their own copy.
      </p>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="p-5 sm:p-6">
            <SectionTitle icon={Type} title="Email Subject" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Template Name" htmlFor="tp-name" hint="Fixed">
                <div className="relative">
                  <Input id="tp-name" value={t.name} readOnly disabled />
                  <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                </div>
              </Field>
              <Field label="Email Subject" htmlFor="tp-subject" required error={errors.subject}>
                <Input id="tp-subject" value={subject} maxLength={250} aria-invalid={!!errors.subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Default Subject</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm">
                  <span>{t.defaultSubject}</span>
                  <Button variant="ghost" size="sm" disabled={subject === t.defaultSubject} onClick={() => setSubject(t.defaultSubject)}>
                    Use default
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle icon={AlignLeft} title="Email Body" description="Compose the email content. Placeholders are filled in per order when the email is prepared." />
            <Field label="Email Content" htmlFor="tp-body" required error={errors.body}>
              <RichTextEditor id="tp-body" ariaLabel="Email content" value={body} onChange={setBody} invalid={!!errors.body} minHeight={220} />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              {PLACEHOLDERS.map(([k, d]) => (
                <span key={k} className="rounded-md bg-muted px-2 py-1 text-xs" title={d}>
                  <code className="font-semibold text-brand">{k}</code> <span className="text-muted-foreground">{d}</span>
                </span>
              ))}
            </div>
            <details className="mt-4 rounded-lg border border-dashed border-border bg-background">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">Default Email Content</summary>
              <div className="flex items-start justify-between gap-3 border-t border-border px-3 py-3">
                <RichTextView html={t.defaultBody} />
                <Button variant="ghost" size="sm" disabled={body === t.defaultBody} onClick={() => setBody(t.defaultBody)}>
                  Use default
                </Button>
              </div>
            </details>
          </Card>
        </div>

        <Card className="h-fit p-5 sm:p-6">
          <SectionTitle icon={FileText} title="Company Profile PDF" description="Attached automatically to every Company Profile email." />
          {t.pdf ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <FileText className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.pdf.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(t.pdf.size)} · Uploaded {formatDateTime(t.pdf.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={() => run(() => openFile(t.pdf!.fileId, { templateSlug: TEMPLATE_SLUG }))}>
                  <Eye className="size-4" aria-hidden /> View PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => run(() => downloadFile(t.pdf!.fileId, { templateSlug: TEMPLATE_SLUG }, t.pdf!.name))}>
                  <Download className="size-4" aria-hidden /> Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
                  <Trash2 className="size-4 text-danger" aria-hidden /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">No PDF attached. Company Profile emails cannot be sent until one is uploaded.</p>
          )}
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium">{t.pdf ? "Replace PDF" : "Upload PDF"}</p>
            <FileUploader id="tp-pdf" files={files} onChange={setFiles} accept=".pdf" hint="PDF only, up to 50 MB" />
            <Button variant="brand-outline" className="w-full" onClick={onUpload} loading={upload.isPending} disabled={!files.length}>
              <Upload className="size-4" aria-hidden /> {t.pdf ? "Replace PDF" : "Upload PDF"}
            </Button>
          </div>
        </Card>
      </div>

      <div ref={historyRef} className="scroll-mt-4">
        <Card className="overflow-hidden">
          <div className="p-5 pb-0 sm:p-6 sm:pb-0">
            <SectionTitle icon={History} title="Template Change History" />
          </div>
          <ChangeHistory />
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <p className="text-xs text-muted-foreground">
          Version {t.version}
          {t.updatedBy?.name ? ` · last saved by ${t.updatedBy.name} on ${formatDateTime(t.updatedAt)}` : ""}
          {dirty && <span className="ml-2 font-semibold text-warning">Unsaved changes</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth" })}>
            <History className="size-4" aria-hidden /> View Change History
          </Button>
          <Button variant="outline" onClick={() => setConfirmRestore(true)}>
            <RotateCcw className="size-4" aria-hidden /> Restore Default
          </Button>
          <Button variant="brand" onClick={onSave} loading={save.isPending} disabled={!dirty}>
            <Save className="size-4" aria-hidden /> Save Template
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restore the default subject and content?"
        description="The saved subject and email content are replaced with the defaults. The PDF is not changed. This is recorded in the change history."
        confirmLabel="Restore Default"
        loading={restore.isPending}
        onConfirm={async () => {
          try {
            const r = await restore.mutateAsync();
            setSubject(r.subject);
            setBody(r.body);
            setConfirmRestore(false);
            toast("Default template restored");
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove the Company Profile PDF?"
        description="New Company Profile emails cannot be sent until a PDF is uploaded again. If no email has used this PDF it is permanently deleted from storage; emails already sent keep their original attachment."
        confirmLabel="Remove PDF"
        destructive
        loading={removePdf.isPending}
        onConfirm={async () => {
          try {
            await removePdf.mutateAsync();
            setConfirmRemove(false);
            toast("PDF removed from the template");
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </div>
  );
}

/** Screen 09: Email Template Management - Company Profile. */
export function TemplatesView() {
  const q = useCompanyProfileTemplate();
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader icon={Mail} title="Email Template Module - Company Profile" subtitle="Manage the email template and PDF used for the Company Profile stage." />
      {q.isPending ? <Skeleton className="h-96" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Editor key={q.data._id} t={q.data} />}
    </div>
  );
}
