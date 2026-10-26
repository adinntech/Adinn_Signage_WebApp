"use client";

import { useState } from "react";
import { BadgeCheck, Building2, CheckCircle2, CircleAlert, Download, Eye, FileText, History, PencilLine, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { downloadFile, formData, openFile } from "@/lib/api/files";
import { APPROVAL_DOC_TYPES, useApproval, useCompleteApproval, useDeleteApproval, useUpdateApproval, useUploadApproval, type ApprovalDoc, type ApprovalDocType } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, toDateInput } from "@/lib/format";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx";

function UploadForm({ orderId, replace, onDone }: { orderId: string; replace?: ApprovalDoc; onDone?: () => void }) {
  const toast = useToast();
  const upload = useUploadApproval(orderId);
  const [docType, setDocType] = useState<ApprovalDocType | "">(replace?.docType ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [date, setDate] = useState(replace ? toDateInput(replace.approvalDate) : "");
  const [remarks, setRemarks] = useState(replace?.remarks ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const p = replace ? "rep" : "up";

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!docType) e.docType = "Choose the approval document type";
    if (!files.length) e.file = "Choose a document to upload";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await upload.mutateAsync(formData(files, { docType, approvalDate: date, remarks: remarks.trim(), replacesId: replace?._id }));
      toast(replace ? "Document replaced. The previous version is kept in history." : "Approval document uploaded");
      setFiles([]);
      setRemarks("");
      setDate("");
      if (!replace) setDocType("");
      onDone?.();
    } catch (err) {
      setErrors(fieldErrorsOf(err));
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Approval Document Type" htmlFor={`${p}-type`} required error={errors.docType}>
          <Select id={`${p}-type`} value={docType} disabled={!!replace} aria-invalid={!!errors.docType} onChange={(ev) => setDocType(ev.target.value as ApprovalDocType)}>
            <option value="">Select type</option>
            {Object.entries(APPROVAL_DOC_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Approval Date" htmlFor={`${p}-date`} error={errors.approvalDate}>
          <Input id={`${p}-date`} type="date" value={date} max={toDateInput(new Date().toISOString())} onChange={(ev) => setDate(ev.target.value)} />
        </Field>
      </div>
      <Field label="Upload Document" htmlFor={`${p}-file`} required error={errors.file}>
        <FileUploader id={`${p}-file`} files={files} onChange={setFiles} accept={ACCEPT} hint="PDF, JPG, PNG or DOCX (images up to 3 MB)" invalid={!!errors.file} />
      </Field>
      <Field label="Remarks" htmlFor={`${p}-remarks`}>
        <Textarea id={`${p}-remarks`} className="min-h-16" maxLength={1000} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} placeholder="e.g. PO number, who approved" />
      </Field>
      <div className="flex justify-end">
        <Button variant="brand" onClick={submit} loading={upload.isPending}>
          <Upload className="size-4" aria-hidden /> {replace ? "Replace Document" : "Upload Document"}
        </Button>
      </div>
    </div>
  );
}

function DetailsDialog({ orderId, doc, onOpenChange }: { orderId: string; doc: ApprovalDoc | null; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const update = useUpdateApproval(orderId);
  const [date, setDate] = useState(doc ? toDateInput(doc.approvalDate) : "");
  const [remarks, setRemarks] = useState(doc?.remarks ?? "");
  return (
    <Modal
      open={!!doc}
      onOpenChange={onOpenChange}
      title="Approval Details"
      description={doc?.file.name}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            loading={update.isPending}
            onClick={async () => {
              if (!doc) return;
              try {
                await update.mutateAsync({ docId: doc._id, approvalDate: date || null, remarks: remarks.trim() || null });
                toast("Details saved");
                onOpenChange(false);
              } catch (e) {
                toast(errorMessage(e), "error");
              }
            }}
          >
            Save Details
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Approval Date" htmlFor="ad-date">
          <Input id="ad-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Remarks" htmlFor="ad-remarks">
          <Textarea id="ad-remarks" maxLength={1000} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Screen 12: Client Approval Proof stage. In Lead Management (`inLead`) the documents are uploaded in Client Rate
 * Approval and the stage's own Complete button finishes the lead, so the separate "Mark Complete" is hidden.
 */
export function ApprovalTab({ orderId, inLead = false }: { orderId: string; inLead?: boolean }) {
  const { can } = useAuth();
  const toast = useToast();
  const q = useApproval(orderId);
  const complete = useCompleteApproval(orderId);
  const [replacing, setReplacing] = useState<ApprovalDoc | null>(null);
  const [editing, setEditing] = useState<ApprovalDoc | null>(null);
  const [historyOf, setHistoryOf] = useState<ApprovalDoc | "all" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<ApprovalDoc | null>(null);
  const removeDoc = useDeleteApproval(orderId);
  const run =(fn: () => Promise<void>) => fn().catch((e) => toast(errorMessage(e), "error"));

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { order, documents, history, missing, latestRevision } = q.data;
  const done = order.approvalStatus === "COMPLETED";
  // Same rule as the API: a lead's own stage decides, older orders use the pipeline stage.
  const inStage = order.lead ? order.lead.stage === "CLIENT_APPROVAL" && order.lead.status === "OPEN" : order.stage === "CLIENT_APPROVAL";
  const editable = can("sales:write") && !done && inStage;
  const isNew = order.clientType === "NEW";

  // Versions of one document: walk the replaces chain back from the current one.
  const chainOf = (d: ApprovalDoc) => {
    const out: ApprovalDoc[] = [d];
    let cur = d;
    while (cur.replaces) {
      const prev = history.find((h) => h._id === cur.replaces);
      if (!prev) break;
      out.push(prev);
      cur = prev;
    }
    return out;
  };
  const historyRows = historyOf === "all" ? history : historyOf ? chainOf(historyOf) : [];

  return (
    <div className="space-y-5">
      {done && (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft p-4 text-success">
          <BadgeCheck className="size-6 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Client approval complete</p>
            <p className="text-sm">
              Marked by {order.approvalCompletedBy?.name ?? "-"} on {formatDateTime(order.approvalCompletedAt)}.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionTitle icon={Building2} title="Client & Order Information" />
          <dl className="grid gap-5 sm:grid-cols-3">
            <DetailItem label="Client Name">{order.client.name}</DetailItem>
            <DetailItem label="Client ID">
              <span className="font-mono">{order.client.clientNo ?? order.client.code}</span>
            </DetailItem>
            <DetailItem label="Order ID">
              <span className="font-mono text-brand">{order.orderNo}</span>
            </DetailItem>
            <DetailItem label="Client Type">
              <ClientTypeBadge type={order.clientType} />
            </DetailItem>
            <DetailItem label="Latest Rate Card Revision">
              {latestRevision ? (
                <button type="button" className="inline-flex items-center gap-1 text-brand hover:underline" onClick={() => latestRevision.pdf?.fileId && run(() => openFile(latestRevision.pdf!.fileId, { orderId }))}>
                  <FileText className="size-4" aria-hidden /> {latestRevision.label}
                </button>
              ) : undefined}
            </DetailItem>
          </dl>
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle title="Approval Requirements" />
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              {missing.length ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />}
              {isNew ? "New client: the Purchase Order is mandatory. Supporting documents and photos are optional." : "Existing client: upload at least one approval document or photo (PO, email, WhatsApp, photo or supporting document)."}
            </li>
            {missing.map((m) => (
              <li key={m} className="rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                {m}
              </li>
            ))}
          </ul>
          {inLead && !done && !missing.length && <p className="mt-3 text-xs text-success">All set: use Approve &amp; Complete Lead below.</p>}
          {can("sales:write") && !done && !inLead && (
            <Button variant="brand" className="mt-4 w-full" disabled={!!missing.length || !editable} onClick={() => setConfirm(true)}>
              <ShieldCheck className="size-4" aria-hidden /> Mark Client Approval Complete
            </Button>
          )}
        </Card>
      </div>

      {editable && (
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={Upload} title="Approval Document Upload" description="Purchase Order, Email / WhatsApp / other written approval, photos or supporting documents." />
          <UploadForm orderId={orderId} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <SectionTitle
            icon={FileText}
            title="Uploaded Documents"
            action={
              <Button variant="ghost" size="sm" onClick={() => setHistoryOf("all")} disabled={!history.length}>
                <History className="size-4" aria-hidden /> View History
              </Button>
            }
          />
        </div>
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No approval documents yet" description={editable ? "Upload the client's written approval above." : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Document Type</th>
                  <th className="px-4 py-3">Approval Date</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Uploaded Date &amp; Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((d) => (
                  <tr key={d._id} className="align-top hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        <FileText className="size-4 shrink-0 text-brand" aria-hidden />
                        <span className="truncate">{d.file.name}</span>
                      </span>
                      {d.remarks && <span className="mt-0.5 block text-xs text-muted-foreground">{d.remarks}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={d.docType === "PURCHASE_ORDER" ? "success" : "info"}>{APPROVAL_DOC_TYPES[d.docType]}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(d.approvalDate)}</td>
                    <td className="px-4 py-3">{d.uploadedBy?.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(d.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => run(() => openFile(d.file.fileId, { orderId }))}>
                          <Eye className="size-4" aria-hidden /> Preview
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => run(() => downloadFile(d.file.fileId, { orderId }, d.file.name))}>
                          <Download className="size-4" aria-hidden /> Download
                        </Button>
                        {editable && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(d)}>
                              <PencilLine className="size-4" aria-hidden /> Details
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setReplacing(d)}>
                              <RefreshCw className="size-4" aria-hidden /> Replace
                            </Button>
                            <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setDeletingDoc(d)}>
                              <Trash2 className="size-4" aria-hidden /> Delete
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setHistoryOf(d)}>
                          <History className="size-4" aria-hidden /> History
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!replacing} onOpenChange={(o) => !o && setReplacing(null)} title="Replace Document" description={`Replacing ${replacing?.file.name ?? ""}. The current version stays in history.`} className="max-w-xl">
        {replacing && <UploadForm key={replacing._id} orderId={orderId} replace={replacing} onDone={() => setReplacing(null)} />}
      </Modal>
      <DetailsDialog key={editing?._id ?? "none"} orderId={orderId} doc={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <Modal open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)} title={historyOf === "all" ? "Document History" : "Version History"} description="Every uploaded and replaced approval document." className="max-w-3xl">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {historyRows.map((d) => (
            <li key={d._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <FileText className="size-4 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.file.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {APPROVAL_DOC_TYPES[d.docType]} · {d.uploadedBy?.name} · {formatDateTime(d.createdAt)}
                </span>
              </span>
              {d.supersededAt ? <Badge>Replaced {formatDate(d.supersededAt)}</Badge> : <Badge tone="success">Current</Badge>}
              <Button variant="ghost" size="sm" onClick={() => run(() => openFile(d.file.fileId, { orderId }))}>
                <Eye className="size-4" aria-hidden /> View
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
      <ConfirmDialog
        open={!!deletingDoc}
        onOpenChange={(o) => !o && setDeletingDoc(null)}
        title="Delete this approval document?"
        description={`${deletingDoc?.file.name ?? "The document"} will be permanently deleted from storage.${deletingDoc?.replaces ? " The version it replaced becomes the current document again." : ""}`}
        confirmLabel="Delete"
        destructive
        loading={removeDoc.isPending}
        onConfirm={async () => {
          if (!deletingDoc) return;
          try {
            await removeDoc.mutateAsync(deletingDoc._id);
            toast("Approval document deleted");
            setDeletingDoc(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Mark client approval complete?"
        description="The approval documents and rate card will be locked for this order."
        confirmLabel="Mark Complete"
        loading={complete.isPending}
        onConfirm={async () => {
          try {
            await complete.mutateAsync();
            toast("Client approval marked complete");
            setConfirm(false);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </div>
  );
}
