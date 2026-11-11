"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CircleAlert, Download, Eye, ExternalLink, FileSpreadsheet, FileText, History, Inbox, Lock, Mail, Paperclip, Save, Search, Send, SkipForward, UserRound } from "lucide-react";
import { FileRefPreview, type PreviewTarget } from "@/components/upload/file-ref-preview";
import { CONTACT_PERSON_GAP, HandoverTab, hasUnsavedContacts, saveOrderContactsBeforeLeaving, SO_CONTACT_GAP } from "@/components/orders/handover-tab";
import { EmailComposer } from "@/components/sales/email-composer";
import { DeliveryBadge, EmailHistory, emailTypes } from "@/components/sales/email-history";
import { RateCardStage } from "@/components/sales/rate-card/rate-card-stage";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { DetailItem } from "@/components/ui/page-header";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { RichTextView } from "@/components/ui/rich-text-editor";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { downloadFile } from "@/lib/api/files";
import { downloadShopExcel, useOrderEmails } from "@/lib/api/sales";
import type { LeadDetail } from "@/lib/api/leads";
import { HANDOVER_TYPES } from "@/lib/api/sales";
import { PRIORITIES, useAssignRecce, useRecce, useRecceUsers, useConfirmRecceHandover, useRecceZohoEstimates, useSaveRecceCodes, useSendCodeRequest, useSkipRecceRateCard, type Priority, type RecceState, type ZohoEstimateOption } from "@/lib/api/recce";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTimeIST } from "@/lib/format";
import { clearStepDraft, useStepDraft } from "@/lib/step-drafts";
import { flagHandoverGaps, RouteNotice, StepFooter } from "./assign-panels";
import { branchSteps, canOpen, csRecceAssign } from "./assign-steps";
import { ASSIGN_META } from "./stage-meta";

const TEAL = ASSIGN_META.RECCE.color;
const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv";

/** One attachment line: icon, file name, what it is, Preview (images / PDF; others download) and Download. */
function AttachmentRow({ icon: Icon, name, meta, onPreview, onDownload }: { icon: typeof FileText; name: string; meta?: string; onPreview?: () => void; onDownload: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-[#0891b2]" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground" title={name}>
          {name}
        </span>
        {meta && <span className="block text-xs text-muted-foreground">{meta}</span>}
      </span>
      <span className="flex shrink-0 gap-1.5">
        {onPreview && (
          <Button variant="outline" size="sm" onClick={onPreview} aria-label={`Preview ${name}`}>
            <Eye className="size-4" aria-hidden /> Preview
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onDownload} aria-label={`Download ${name}`}>
          <Download className="size-4" aria-hidden /> Download
        </Button>
      </span>
    </li>
  );
}

/**
 * What goes with every request email by itself (client details + contacts in the message, the shop Excel, handover
 * documents), each file on its own line with Preview / Download, then the files added for this email.
 */
function Attachments({ r, files, onFiles }: { r: RecceState; files: File[]; onFiles: (f: File[]) => void }) {
  const toast = useToast();
  const a = r.autoAttachments;
  const source = { orderId: r.orderId };
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const fail = (e: unknown) => toast(errorMessage(e), "error");
  return (
    <div className="space-y-4" data-testid="auto-attachments">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0e7490]">Included automatically</p>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-[#a5f3fc] bg-[#ecfeff]/60">
          <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <UserRound className="size-4 shrink-0 text-[#0891b2]" aria-hidden /> Client details and contact persons (in the message)
          </li>
          {r.rateCard?.choice === "SKIPPED" && (
            <li className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground">
              <SkipForward className="size-4 shrink-0 text-[#0891b2]" aria-hidden /> Rate Card skipped: no rate card goes with this email
            </li>
          )}
          {a?.rateCard && (
            <AttachmentRow
              icon={FileText}
              name={a.rateCard.name ?? `Rate Card ${a.rateCard.label}.pdf`}
              meta={`Rate Card ${a.rateCard.label} · the saved version included in this flow`}
              onPreview={() => setPreview({ saved: a.rateCard!, source })}
              onDownload={() => void downloadFile(a.rateCard!.fileId, source, a.rateCard!.name ?? "Rate_Card.pdf").catch(fail)}
            />
          )}
          {a?.shopExcel && (
            <AttachmentRow
              icon={FileSpreadsheet}
              name={`Shop list (${a.shopExcel.rows} shop${a.shopExcel.rows === 1 ? "" : "s"}).xlsx`}
              meta={`${a.shopExcel.sized ? "With sizes · " : ""}as the table is when you send · Excel opens after download`}
              onDownload={() => void downloadShopExcel(r.orderId).catch(fail)}
            />
          )}
          {a?.gstCertificates?.map((d) => (
            <AttachmentRow
              key={`gst-${d.fileId}`}
              icon={FileText}
              name={d.name ?? "GST certificate"}
              meta="GST certificate · New Client (for the client ID)"
              onPreview={() => setPreview({ saved: d, source })}
              onDownload={() => void downloadFile(d.fileId, source, d.name ?? "file").catch(fail)}
            />
          ))}
          {a?.documents.map((d) => (
            <AttachmentRow
              key={d.fileId}
              icon={FileText}
              name={d.name ?? "File"}
              meta={d.so ? "SO · Additional Documents" : "From Communication & Attachments"}
              onPreview={() => setPreview({ saved: d, source })}
              onDownload={() => void downloadFile(d.fileId, source, d.name ?? "file").catch(fail)}
            />
          ))}
        </ul>
      </section>
      <section>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Paperclip className="size-3.5" aria-hidden /> Added for this email
        </p>
        <FileUploader id="recce-mail-files" files={files} onChange={onFiles} accept={DOC_ACCEPT} multiple compact onPreview={(f) => setPreview({ local: f })} hint="Optional: PDF, images, Word, PowerPoint, Excel · up to 10" />
      </section>
      <FileRefPreview target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/**
 * Step 2: ask for the project code (and, for a New client, the Zoho Client ID) by email. The client details, contacts,
 * shop Excel and handover documents go automatically; more files can be added. An email recorded as sent (or not sent
 * only because mail is off) completes the step; a failed one stays here to be sent again.
 */
function CodeRequestStep({ r, locked, onSent }: { r: RecceState; locked: boolean; onSent: () => void }) {
  const send = useSendCodeRequest(r.orderId);
  const [files, setFiles] = useStepDraft<File[]>(`${r.orderId}:email:files`, []);
  const [tab, setTab] = useState<"email" | "history">("email");
  // Same history data as the Email History tab: Initial Send / Resend counts (successful sends only).
  const history = useOrderEmails(r.orderId, "PROJECT_CODE_REQUEST");
  const sends = history.data ? emailTypes(history.data) : null;
  // Saved codes (persisted on the order; a failed save leaves them null) end the step: the email is preview-only and
  // the server refuses new sends and resends.
  const readOnly = locked || !!r.codes;
  return (
    <div className="space-y-4">
      <Tabs
        idPrefix="recce-mail-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { key: "email", label: "Email", icon: Mail },
          { key: "history", label: "Email History", icon: History, badge: r.requests.count ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{r.requests.count}</span> : undefined },
        ]}
      />
      <TabPanel k={tab}>
        <div id="recce-mail-tabs-panel" className="space-y-4">
          {!!sends?.sent && tab === "email" && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-success-soft/70 px-3 py-2 text-sm text-success">
              <Check className="size-4 shrink-0" aria-hidden /> Initial email sent
              {sends.sent > 1 && ` · Resent ${sends.sent - 1} time${sends.sent === 2 ? "" : "s"}`}
              {sends.lastSentAt && ` · Last sent on ${formatDateTimeIST(sends.lastSentAt)}`}
              <button type="button" className="font-semibold underline underline-offset-2 hover:no-underline" onClick={() => setTab("history")}>
                View Email History
              </button>
            </p>
          )}
          {/* Resend stays with the composer flow: hidden here once the codes are saved (the server refuses it too). */}
          {tab === "history" && <EmailHistory orderId={r.orderId} kind="PROJECT_CODE_REQUEST" allowResend={false} />}
          {tab === "email" && readOnly && <LatestRequestPreview r={r} />}
          {tab === "email" && !readOnly && <CodeRequestComposer r={r} files={files} setFiles={setFiles} send={send} onSent={onSent} resend={!!sends?.sent} />}
        </div>
      </TabPanel>
    </div>
  );
}

/** Codes saved (or branch locked): the latest recorded request email, read-only, with attachment preview / download. */
function LatestRequestPreview({ r }: { r: RecceState }) {
  const q = useOrderEmails(r.orderId, "PROJECT_CODE_REQUEST");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const toast = useToast();
  const source = { orderId: r.orderId };
  if (q.isPending) return <RowsSkeleton rows={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data[0];
  if (!e) return <EmptyState icon={Inbox} title="No request email recorded" description="Email History shows every project code request sent for this project." />;
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden /> {r.codes ? "Codes saved: the request email is read-only." : "Read-only: the latest request email."}
      </p>
      <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card p-4">
        <dt className="text-muted-foreground">From</dt>
        <dd>{e.from || "-"}</dd>
        <dt className="text-muted-foreground">To</dt>
        <dd>{e.to.join(", ")}</dd>
        <dt className="text-muted-foreground">CC</dt>
        <dd>{e.cc.join(", ") || "-"}</dd>
        <dt className="text-muted-foreground">Subject</dt>
        <dd className="font-medium">
          {e.subject}
          {e.requestId && <span className="ml-2 font-mono text-xs text-muted-foreground">{e.requestId}</span>}
        </dd>
        <dt className="text-muted-foreground">Sent</dt>
        <dd>
          {formatDateTimeIST(e.sentAt)} by {e.sentBy?.name ?? "-"}
        </dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <DeliveryBadge e={e} />
          {e.error && <span className="ml-2 text-xs text-muted-foreground">{e.error}</span>}
        </dd>
      </dl>
      <div className="rounded-lg border border-border bg-background p-4">
        <RichTextView html={e.body} />
      </div>
      {e.attachments.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Paperclip className="size-3.5" aria-hidden /> Attachments ({e.attachments.length})
            {e.revisionLabel && <span className="normal-case">· Rate Card {e.revisionLabel}</span>}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {e.attachments.map((a) => (
              <AttachmentRow
                key={a.fileId}
                icon={/.(xlsx?|csv)$/i.test(a.name ?? "") ? FileSpreadsheet : FileText}
                name={a.name ?? "file"}
                onPreview={() => setPreview({ saved: a, source })}
                onDownload={() => void downloadFile(a.fileId, source, a.name ?? "file").catch((err) => toast(errorMessage(err), "error"))}
              />
            ))}
          </ul>
        </section>
      )}
      <FileRefPreview target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/** Before the codes are saved: the composer (send / send again) and its attachments. */
function CodeRequestComposer({
  r,
  files,
  setFiles,
  send,
  onSent,
  resend,
}: {
  r: RecceState;
  files: File[];
  setFiles: (f: File[]) => void;
  send: ReturnType<typeof useSendCodeRequest>;
  onSent: () => void;
  /** An email already went (successfully): the button reads Resend Email. */
  resend: boolean;
}) {
  return (
    <div className="space-y-4">
      <EmailComposer
        idPrefix="recce-mail"
        compact
        persistKey={`${r.orderId}:email`}
        sendLabel={resend ? "Resend Email" : "Send Email"}
        notConfigured={'The signage email API is not configured on the server (SIGNAGE_MAIL_API_URL / SIGNAGE_MAIL_API_KEY). Sending will be recorded as "Not sent" until it is set up.'}
        orderId={r.orderId}
        from={r.mail.from}
        mailEnabled={r.mail.enabled}
        draft={r.draft}
        attachments={[]}
        attachmentLabel="Attachments"
        attachmentArea={<Attachments r={r} files={files} onFiles={setFiles} />}
        sending={send.isPending}
        onSend={async (v) => {
          const fd = new FormData();
          fd.append("payload", JSON.stringify(v));
          for (const f of files) fd.append("files", f);
          const sent = await send.mutateAsync(fd);
          // A failed send keeps the added files for another try.
          if (sent.status !== "FAILED") {
            setFiles([]);
            clearStepDraft(`${r.orderId}:email:files`);
          }
          // Let the composer show its result first, then move on to the codes.
          if (sent.status !== "FAILED") setTimeout(onSent, 400);
          return sent;
        }}
      />
    </div>
  );
}

/**
 * Step 3: the project code and estimation code, chosen only from the client's Zoho Books estimates
 * (reference_number = project code, estimate_number = estimation code). Existing client: its estimates load from its
 * Zoho contact; New client: type the Client ID created in Zoho, then Find in Zoho.
 */
function CodesStep({ r, locked, onSaved }: { r: RecceState; locked: boolean; onSaved: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const csUser = user?.role === "CLIENT_SERVICING";
  const save = useSaveRecceCodes(r.orderId);
  const key = `${r.orderId}:codes`;
  const fromZoho = !!r.zohoClientId?.fromZoho;
  const [clientId, setClientId] = useStepDraft(`${key}:client`, r.codes?.clientId ?? (fromZoho ? "" : (r.zohoClientId?.value ?? "")));
  const clientIdOk = /^[A-Za-z0-9-]{2,20}$/.test(clientId.trim());
  // New client: the Client ID the list was searched with (Find in Zoho).
  const [lookupId, setLookupId] = useState(!fromZoho && clientIdOk ? clientId.trim() : "");
  const estimates = useRecceZohoEstimates(r.orderId, fromZoho ? undefined : lookupId || undefined, !(locked && r.codes) && (fromZoho || !!lookupId));
  const [project, setProject] = useStepDraft(`${key}:project`, r.codes?.projectCode ?? "");
  const [estimateId, setEstimateId] = useStepDraft(`${key}:estimate`, "");
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (locked && r.codes) return <CodesView r={r} />;

  const usable = (e: ZohoEstimateOption) => e.valid && !e.usedBy;
  const byCode = new Map<string, ZohoEstimateOption[]>();
  for (const e of estimates.data?.items ?? []) byCode.set(e.projectCode, [...(byCode.get(e.projectCode) ?? []), e]);
  /** Why a project code cannot be chosen, or a short summary of its estimate. */
  const codeNote = (list: ZohoEstimateOption[]) => {
    if (!list.some(usable)) {
      const used = list.find((e) => e.usedBy);
      return used ? `Already used by ${used.usedBy}` : "Not a valid code (needs 8 digits and EST- + 6 digits)";
    }
    const first = list[0];
    const more = list.length > 1 ? `${list.length} estimates · ` : `${first.estimationCode} · `;
    return `${more}${formatDate(first.date)} · ${formatCurrency(first.total)}${first.status ? ` · ${first.status}` : ""}`;
  };
  const q = query.trim().toLowerCase();
  const options: SearchOption[] = [...byCode]
    .filter(([code, list]) => !q || code.includes(q) || list.some((e) => e.estimationCode.toLowerCase().includes(q)))
    .map(([code, list]) => ({ value: code, label: code, sublabel: codeNote(list) }));
  const list = byCode.get(project) ?? [];
  const free = list.filter(usable);
  // The chosen estimate; one free estimate (or the saved one) is taken without asking.
  const estimate =
    list.find((e) => e.estimateId === estimateId && usable(e)) ??
    (free.length === 1 ? free[0] : null) ??
    free.find((e) => e.estimationCode === r.codes?.estimationCode) ??
    null;

  const pickProject = (o: SearchOption) => {
    const rows = byCode.get(o.value) ?? [];
    if (!rows.some(usable)) {
      toast(`${o.value}: ${codeNote(rows)}`, "error");
      return;
    }
    setProject(o.value);
    setEstimateId("");
    setQuery("");
    setErrors({});
  };
  const find = () => {
    if (!clientIdOk) {
      setErrors({ clientId: "Enter the Client ID created in Zoho (2-20 letters, digits or -)" });
      return;
    }
    setErrors({});
    setProject("");
    setEstimateId("");
    setLookupId(clientId.trim());
  };
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!fromZoho && !clientIdOk) e.clientId = "Enter the Client ID created in Zoho (2-20 letters, digits or -)";
    else if (!fromZoho && clientId.trim() !== lookupId) e.clientId = "Click Find in Zoho for this Client ID";
    if (!project) e.projectCode = "Choose the project code from Zoho";
    else if (!estimate) e.estimationCode = "Choose the estimation code";
    setErrors(e);
    if (Object.keys(e).length || !estimate) return;
    try {
      await save.mutateAsync({ projectCode: estimate.projectCode, estimationCode: estimate.estimationCode, zohoEstimateId: estimate.estimateId, clientId: fromZoho ? undefined : clientId.trim() });
      toast("Project and estimation codes saved");
      clearStepDraft(key);
      onSaved();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      if (Object.keys(fe).length) setErrors(fe);
      toast(errorMessage(err), "error");
    }
  };
  const changed =
    !!estimate &&
    (estimate.projectCode !== (r.codes?.projectCode ?? "") || estimate.estimationCode !== (r.codes?.estimationCode ?? "") || (!fromZoho && clientId.trim() !== (r.codes?.clientId ?? "")));
  const searching = fromZoho || !!lookupId;
  const emptyText = estimates.data && !estimates.data.items.length ? `No estimates in Zoho for Client ID ${estimates.data.clientId ?? "-"}` : "No matching project code";

  return (
    <div className="space-y-4">
      <div className={fromZoho ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
        {/* New client: the Client ID created in Zoho finds its estimates. Existing client: kept automatically (no input). */}
        {!fromZoho && (
          <Field label="Client ID (Zoho)" htmlFor="recce-client-id" required error={errors.clientId} hint="New client: the client code created in Zoho">
            <div className="flex gap-2">
              <Input
                id="recce-client-id"
                className="font-mono tracking-wider"
                maxLength={20}
                placeholder="e.g. 30196"
                value={clientId}
                aria-invalid={!!errors.clientId}
                onChange={(e) => setClientId(e.target.value.replace(/[^A-Za-z0-9-]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    find();
                  }
                }}
              />
              <Button variant="outline" onClick={find} loading={estimates.isFetching && !!lookupId} className="shrink-0">
                <Search className="size-4" aria-hidden /> Find in Zoho
              </Button>
            </div>
          </Field>
        )}
        <Field label="Project Code" htmlFor="recce-project-code" required error={errors.projectCode} hint="From Zoho estimates (reference number)">
          <SearchSelect
            id="recce-project-code"
            inputClassName="font-mono tracking-wider"
            value={project ? { value: project, label: project, sublabel: list.length ? codeNote(list) : undefined } : null}
            options={options}
            query={query}
            onQueryChange={setQuery}
            onSelect={pickProject}
            onClear={() => {
              setProject("");
              setEstimateId("");
            }}
            loading={estimates.isFetching}
            disabled={!searching || estimates.isError}
            invalid={!!errors.projectCode}
            placeholder={searching ? "Search project code or EST- number" : "Enter the Client ID, then Find in Zoho"}
            emptyText={emptyText}
          />
        </Field>
        <Field label="Estimation Code" htmlFor="recce-est-code" required error={errors.estimationCode} hint={list.length > 1 ? `${list.length} estimates for this project code` : "From Zoho, for the chosen project code"}>
          <Select
            id="recce-est-code"
            className="font-mono tracking-wider"
            value={estimate?.estimateId ?? ""}
            disabled={!project || !list.length}
            aria-invalid={!!errors.estimationCode}
            onChange={(e) => {
              setEstimateId(e.target.value);
              setErrors((x) => ({ ...x, estimationCode: "" }));
            }}
          >
            <option value="" disabled>
              {project ? "Choose the estimation code" : "Choose a project code first"}
            </option>
            {list.map((e) => (
              <option key={e.estimateId} value={e.estimateId} disabled={!usable(e)}>
                {/* The code only; date, amount and status show in the From Zoho strip below. */}
                {e.estimationCode}
                {e.usedBy ? ` (used by ${e.usedBy})` : !e.valid ? " (invalid)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {estimates.isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          <span className="flex items-center gap-1.5">
            <CircleAlert className="size-4 shrink-0" aria-hidden /> {errorMessage(estimates.error)}
          </span>
          <Button variant="outline" size="sm" onClick={() => estimates.refetch()} loading={estimates.isFetching}>
            Retry
          </Button>
        </div>
      )}
      {estimate && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs text-muted-foreground" style={{ borderColor: `${TEAL}55`, background: ASSIGN_META.RECCE.soft }}>
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <BadgeCheck className="size-4" style={{ color: TEAL }} aria-hidden /> From Zoho
          </span>
          <span>
            Project <b className="font-mono text-foreground">{estimate.projectCode}</b> · <b className="font-mono text-foreground">{estimate.estimationCode}</b>
          </span>
          {estimate.date && <span>{formatDate(estimate.date)}</span>}
          {estimate.total !== null && <span className="tabular-nums">{formatCurrency(estimate.total)}</span>}
          {estimate.status && <span className="capitalize">{estimate.status}</span>}
          {estimate.salesperson && <span>{estimate.salesperson}</span>}
          {estimate.location && <span>{estimate.location}</span>}
        </div>
      )}
      {fromZoho && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> {csUser ? "" : "Existing client: "}Client ID <span className="font-mono font-semibold text-foreground">{r.zohoClientId?.value ?? "not found in Zoho"}</span> is kept automatically.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{r.codes ? `Saved by ${r.codes.savedBy ?? "-"} · ${formatDateTimeIST(r.codes.savedAt)}` : "Each code can be used for one project only."}</span>
        <Button variant="brand" onClick={submit} loading={save.isPending} disabled={!changed} style={changed ? { background: TEAL } : undefined}>
          <Save className="size-4" aria-hidden /> Save Codes
        </Button>
      </div>
    </div>
  );
}

/** Client Servicing workflow: the handover the BD sent (its selected type only), used as it is for the request email. */
function ReceivedHandover({ r }: { r: RecceState }) {
  const a = r.autoAttachments;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: `${TEAL}55`, background: ASSIGN_META.RECCE.soft }}>
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        <BadgeCheck className="size-4" style={{ color: TEAL }} aria-hidden /> Handover received from BD
      </span>
      <span>{r.handoverType ? HANDOVER_TYPES[r.handoverType].label : "No type"}</span>
      {a?.shopExcel && <span className="text-muted-foreground">{a.shopExcel.rows} shops{a.shopExcel.sized ? " with sizes" : ""}</span>}
      {!!a?.documents.length && <span className="text-muted-foreground">{a.documents.length} document{a.documents.length === 1 ? "" : "s"}</span>}
      <span className="text-xs text-muted-foreground">The email below is prepared from it.</span>
    </div>
  );
}

/** Saved codes and Client ID, read-only (the locked codes step and Lead Management > Full Details). */
export function CodesView({ r }: { r: RecceState }) {
  if (!r.codes) return null;
  const fromZoho = !!r.zohoClientId?.fromZoho;
  return (
      <dl className="grid gap-4 sm:grid-cols-4">
        <DetailItem label="Project Code">
          <span className="font-mono text-base">{r.codes.projectCode}</span>
        </DetailItem>
        <DetailItem label="Estimation Code">
          <span className="font-mono text-base">{r.codes.estimationCode}</span>
        </DetailItem>
        <DetailItem label={fromZoho ? "Client ID" : "Client ID (Zoho)"}>{r.codes.clientId ? <span className="font-mono text-base">{r.codes.clientId}</span> : null}</DetailItem>
        <DetailItem label="Saved">{r.codes.savedBy ? `${r.codes.savedBy} · ${formatDateTimeIST(r.codes.savedAt)}` : formatDateTimeIST(r.codes.savedAt)}</DetailItem>
      </dl>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Step 4: the Recce / Operations person, the project dates and location, and notes. Assigning completes the lead. */
function AssignStep({ r, onAssigned }: { r: RecceState; onAssigned?: () => void }) {
  const toast = useToast();
  const users = useRecceUsers();
  const assign = useAssignRecce(r.orderId);
  const [query, setQuery] = useState("");
  const key = `${r.orderId}:assign`;
  const [person, setPerson] = useStepDraft<SearchOption | null>(`${key}:person`, null);
  const [startDate, setStartDate] = useStepDraft(`${key}:start`, today);
  const [targetDate, setTargetDate] = useStepDraft(`${key}:end`, "");
  const [district, setDistrict] = useStepDraft(`${key}:district`, "");
  const [priority, setPriority] = useStepDraft<Priority>(`${key}:priority`, "MEDIUM");
  const [note, setNote] = useStepDraft(`${key}:note`, "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const q = query.trim().toLowerCase();
  const options: SearchOption[] = (users.data ?? [])
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    .map((u) => ({ value: u._id, label: u.name, sublabel: [u.role === "RECCE_COORDINATOR" ? "Recce Coordinator" : "Operations", u.email, u.phone].filter(Boolean).join(" · ") }));
  // Contact persons are optional; those with a mobile and an email go on the project.
  const ready = r.missing.length === 0;

  const check = () => {
    const e: Record<string, string> = {};
    if (!person) e.assigneeId = "Choose the Recce / Operations person";
    if (!startDate) e.startDate = "Choose the start date";
    if (!targetDate) e.targetDate = "Choose the expected end date";
    else if (startDate && targetDate < startDate) e.targetDate = "End date must be on or after the start date";
    if (district.trim().length < 2) e.district = "Enter the district / location";
    setErrors(e);
    if (!Object.keys(e).length) setConfirm(true);
  };

  return (
    <div className="space-y-4">
      {r.missing.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm">
          {r.missing.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden /> {m}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Recce / Operations Person" htmlFor="recce-person" required error={errors.assigneeId}>
          <SearchSelect
            id="recce-person"
            value={person}
            options={options}
            query={query}
            onQueryChange={setQuery}
            onSelect={(o) => {
              setPerson(o);
              setQuery("");
              setErrors((e) => ({ ...e, assigneeId: "" }));
            }}
            onClear={() => setPerson(null)}
            loading={users.isFetching}
            invalid={!!errors.assigneeId}
            placeholder="Search the Recce / Operations team..."
            emptyText={users.isError ? `Could not load: ${errorMessage(users.error)}` : users.isPending ? "Loading..." : "No active Recce / Operations users"}
          />
        </Field>
        <Field label="District / Location" htmlFor="recce-district" required error={errors.district}>
          <Input id="recce-district" maxLength={120} placeholder="e.g. Chennai" value={district} aria-invalid={!!errors.district} onChange={(e) => setDistrict(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" htmlFor="recce-start" required error={errors.startDate}>
            <Input id="recce-start" type="date" value={startDate} aria-invalid={!!errors.startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Expected End Date" htmlFor="recce-end" required error={errors.targetDate}>
            <Input id="recce-end" type="date" min={startDate || undefined} value={targetDate} aria-invalid={!!errors.targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Priority" htmlFor="recce-priority">
          <Select id="recce-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITIES[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes for the Recce Team" htmlFor="recce-note" className="md:col-span-2" hint="Optional: added to the project instructions with the handover notes.">
          <Textarea id="recce-note" className="min-h-20" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Creates project {r.codes?.projectCode ?? "(code)"} in Operations and completes the lead.</p>
        <Button variant="brand" disabled={!ready} onClick={check} style={ready ? { background: TEAL } : undefined}>
          <Send className="size-4" aria-hidden /> Assign to Recce Team
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Assign ${r.orderNo} to ${person?.label ?? ""}?`}
        confirmLabel="Assign"
        loading={assign.isPending}
        autoClose={false}
        onConfirm={async () => {
          try {
            await assign.mutateAsync({ assigneeId: person!.value, startDate, targetDate, district: district.trim(), priority, note: note.trim() || undefined });
            toast(`Project ${r.codes?.projectCode} created and assigned to ${person!.label}. They have been notified.`);
            setConfirm(false);
            clearStepDraft(key);
            onAssigned?.();
          } catch (err) {
            setConfirm(false);
            const fe = fieldErrorsOf(err);
            if (Object.keys(fe).length) setErrors(fe);
            toast(errorMessage(err), "error");
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          Project <b className="font-mono text-foreground">{r.codes?.projectCode}</b> ({r.codes?.estimationCode}) is created in Operations with the handover, and {person?.label} gets a
          notification. The lead is completed; the codes and handover can no longer be changed.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export function AssignedBanner({ r, projectLink = false }: { r: RecceState; projectLink?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: `${TEAL}55`, background: ASSIGN_META.RECCE.soft }}>
      <span className="flex size-10 items-center justify-center rounded-full text-white" style={{ background: TEAL }}>
        <BadgeCheck className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p>
          Assigned to <b>{r.assignee?.name}</b> (Recce team) on {formatDateTimeIST(r.assignedAt)}
          {r.assignedBy ? ` by ${r.assignedBy}` : ""}.
        </p>
        <p className="text-muted-foreground">
          Project <span className="font-mono font-semibold text-foreground">{r.project?.code ?? r.codes?.projectCode}</span> · {r.codes?.estimationCode}
          {r.note ? ` · “${r.note}”` : ""}
        </p>
      </div>
      {projectLink && r.project && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${r.project._id}`}>
            <ExternalLink className="size-4" aria-hidden /> Open Project
          </Link>
        </Button>
      )}
    </motion.div>
  );
}

export type RecceStep = "email" | "history" | "codes" | "handover" | "ratecard" | "assign";

/**
 * Project Assign > Assign to Recce Team, one step at a time (opened from the mind map): the handover (same details as
 * for Client Servicing, always in full), the project code request email (+ Email History), the codes with the Client
 * ID, and the Recce / Operations person. `onDone` moves on; assigning creates the operations project and completes the lead.
 */
export function RecceBranchPanel({
  detail,
  step,
  onDone,
  onAssigned,
  onGo,
  projectLink = false,
}: {
  /** Lead Management: the lead. Client Servicing workflow: the order with `handover.assignee` null (their own steps). */
  detail: { order: LeadDetail["order"]; handover: { assignee: unknown } };
  step: RecceStep;
  onDone: () => void;
  onAssigned?: () => void;
  /**
   * Opens another step in the same drawer: Previous / Next, and Skip Rate Card (on to the request email). Without it
   * (read-only places) there is no step navigation.
   */
  onGo?: (step: RecceStep) => void;
  /** "Open Project" on the assignment banner (Client Servicing workflow); Lead Management drawers do not show it. */
  projectLink?: boolean;
}) {
  const q = useRecce(detail.order._id, !detail.handover.assignee);
  const { user } = useAuth();
  const toast = useToast();
  const csUser = user?.role === "CLIENT_SERVICING";
  const confirm = useConfirmRecceHandover(detail.order._id);
  const skip = useSkipRecceRateCard(detail.order._id);
  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const assigned = !!r.assignee;
  const locked = assigned || !r.unlocked;
  // Previous / Next: the steps this order has, in order (same list as the mind map). Only steps that can be opened.
  const steps = branchSteps(csRecceAssign(r), "RECCE");
  const at = steps.findIndex((s) => s.step === step);
  const prev = at > 0 && canOpen(steps[at - 1]!) ? steps[at - 1]! : null;
  // Assign Type & Details (editable): the top Next is shown and goes through the same check as Continue / Skip.
  const handoverForward = step === "handover" && !locked && at >= 0 ? (steps[at + 1] ?? null) : null;
  const next = handoverForward ?? (at >= 0 && steps[at]!.state === "DONE" && steps[at + 1] && canOpen(steps[at + 1]!) ? steps[at + 1]! : null);
  /**
   * One check for every forward action out of Assign Type & Details (top Next, Continue, Skip: Rate Card): with
   * mandatory details missing it stays here, pulses the bottom banner and scrolls to the first invalid section;
   * otherwise it saves step 1 as done (server-checked) and the caller moves on.
   */
  const leaveHandover = async () => {
    // Unsaved contact persons and POC contacts are saved first (so the Rate Card prefills the point of contact), then
    // the gaps are read again from the server.
    const unsaved = hasUnsavedContacts();
    if (!(await saveOrderContactsBeforeLeaving())) return false;
    const gaps = (unsaved ? (await q.refetch()).data?.handoverMissing : r.handoverMissing) ?? [];
    if (gaps.length) {
      flagHandoverGaps(gaps);
      return false;
    }
    try {
      await confirm.mutateAsync(undefined);
      return true;
    } catch (e) {
      // Server gap (details changed meanwhile): the same feedback, then the error message.
      flagHandoverGaps([errorMessage(e)]);
      throw e;
    }
  };
  /** Skip Rate Card: the request email goes without a rate card (saved versions are kept); opens the email. */
  const skipRateCard = async () => {
    await skip.mutateAsync(undefined);
    toast("Rate Card skipped: the request email goes without a rate card.");
    if (onGo) onGo("email");
    else onDone();
  };

  return (
    <div className="space-y-4">
      {onGo && (prev || next) && (
        <nav aria-label="Step navigation" className="flex flex-wrap items-center justify-between gap-2">
          {prev ? (
            <Button variant="outline" size="sm" onClick={() => onGo(prev.step as RecceStep)}>
              <ArrowLeft className="size-4" aria-hidden /> Previous: {prev.label}
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button
              variant="outline"
              size="sm"
              loading={!!handoverForward && confirm.isPending}
              onClick={() =>
                handoverForward
                  ? void leaveHandover().then((ok) => ok && onGo(handoverForward.step as RecceStep), (e) => toast(errorMessage(e), "error"))
                  : onGo(next.step as RecceStep)
              }
            >
              Next: {next.label} <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </nav>
      )}
      {assigned && <AssignedBanner r={r} projectLink={projectLink} />}
      {step === "handover" && !locked && !r.route && !csUser && <RouteNotice branch="RECCE" />}
      {step === "email" && r.csFlow?.handoverSent && <ReceivedHandover r={r} />}
      {step === "email" && <CodeRequestStep r={r} locked={locked} onSent={onDone} />}
      {step === "history" && <EmailHistory orderId={r.orderId} kind="PROJECT_CODE_REQUEST" allowResend={!locked && !r.codes && !r.csFlow && !csUser} />}
      {step === "codes" && <CodesStep r={r} locked={locked} onSaved={onDone} />}
      {/* Rate Card: never locked (updated at any time, also after the assignment). Save & Continue includes the saved
          version in this flow and moves on; Skip Rate Card (before the assignment) leaves it out. */}
      {step === "ratecard" && (
        <>
          {r.rateCard?.choice === "SKIPPED" && !assigned && (
            <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm">
              <SkipForward className="size-4 shrink-0 text-warning" aria-hidden /> Skipped: the request email goes without a rate card. Save &amp; Continue to include it.
            </p>
          )}
          <RateCardStage orderId={r.orderId} step={{ onContinue: assigned ? undefined : onDone, onSkip: assigned || r.rateCard?.choice === "SKIPPED" ? undefined : skipRateCard }} />
        </>
      )}
      {step === "handover" && (
        <>
          <HandoverTab order={detail.order} mode="recce" locked={locked} csEdit={!!r.csFlow || csUser} />
          {!locked && <StepFooter
              orderId={r.orderId}
              next={r.rateCard ? "Rate Card" : "Project Code Request Email"}
              // The Recce route always takes the full handover of the selected type: its gaps come from the server
              // (handoverGaps with the full handover), never from the Client Servicing toggle.
              missing={r.handoverMissing ?? []}
              // Contact gaps keep Continue / Skip enabled: they save unsaved contacts, then check again.
              softGaps={[CONTACT_PERSON_GAP, SO_CONTACT_GAP]}
              // Saves step 1 as done (server-checked), then opens the next step (Rate Card, or the email on older orders).
              onContinue={async () => {
                if (await leaveHandover()) onDone();
              }}
              // Orders with the Rate Card step: Skip saves step 1 the same way, then skips the rate card (the email next).
              skip={
                r.rateCard
                  ? {
                      label: "Skip: Rate Card",
                      onSkip: async () => {
                        if (await leaveHandover()) await skipRateCard();
                      },
                    }
                  : undefined
              }
            />}
        </>
      )}
      {step === "assign" &&
        (assigned ? <p className="text-sm text-muted-foreground">Assigned. The Recce team works on project {r.project?.code} in Operations.</p> : <AssignStep r={r} onAssigned={onAssigned} />)}
    </div>
  );
}
