"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetReplyButton } from "@/components/mail/get-reply-button";
import { useAutoReplyCheck } from "@/lib/api/mailSettings";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CalendarCheck, CalendarDays, Check, CircleAlert, Download, Eye, ExternalLink, FileSpreadsheet, FileText, Flag, FolderKanban, History, IndianRupee, Inbox, KeyRound, Lock, Mail,  MailCheck, MapPin, Paperclip, Phone, Save, Search, Send, SkipForward, StickyNote, UserRound } from "lucide-react";
import { FileRefPreview, type PreviewTarget } from "@/components/upload/file-ref-preview";
import { CONTACT_PERSON_GAP, HandoverTab, hasUnsavedContacts, saveOrderContactsBeforeLeaving, SO_CONTACT_GAP } from "@/components/orders/handover-tab";
import { EmailComposer } from "@/components/sales/email-composer";
import { ATTACHMENT_CATEGORY, DeliveryBadge, EmailHistory, emailTypes } from "@/components/sales/email-history";
import { RateCardStage } from "@/components/sales/rate-card/rate-card-stage";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ShopTable } from "@/components/handover/shop-table";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
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
import { downloadShopExcel, useHandover, useOrderEmails } from "@/lib/api/sales";
import type { LeadDetail } from "@/lib/api/leads";
import { HANDOVER_TYPES } from "@/lib/api/sales";
import { PRIORITIES, useAssignRecce, useRecce, useRecceUsers, useConfirmRecceHandover, useRecceZohoEstimates, useSaveRecceCodes, useSendCodeRequest, useSkipRecceRateCard, type Priority, type RecceState, type ZohoEstimateOption } from "@/lib/api/recce";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { clearStepDraft, useStepDraft } from "@/lib/step-drafts";
import { formatDateTime, formatCurrency, formatDate, formatDateTimeIST } from "@/lib/format";
import { flagHandoverGaps, RouteNotice, StepFooter } from "./assign-panels";
import { branchSteps, canOpen, csRecceAssign } from "./assign-steps";
import { ASSIGN_META } from "./stage-meta";

const TEAL = ASSIGN_META.RECCE.color;
const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv";

/** One attachment line: icon, file name, what it is, Preview (images / PDF; others download) and Download. */
function AttachmentRow({
  icon: Icon,
  name,
  meta,
  onPreview,
  previewLabel = "Preview",
  onDownload,
  unavailable = false,
}: {
  icon: typeof FileText;
  name: string;
  meta?: string;
  onPreview?: () => void;
  previewLabel?: string;
  onDownload: () => void;
  /** The file is recorded but its stored copy cannot be opened: shown with a status instead of the buttons. */
  unavailable?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-[#0891b2]" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground" title={name}>
          {name}
        </span>
        {meta && <span className="block text-xs text-muted-foreground">{meta}</span>}
      </span>
      {unavailable ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
          <CircleAlert className="size-3.5" aria-hidden /> File unavailable
        </span>
      ) : (
      <span className="flex shrink-0 gap-1.5">
        {onPreview && (
          <Button variant="outline" size="sm" onClick={onPreview} aria-label={`${previewLabel} ${name}`}>
            <Eye className="size-4" aria-hidden /> {previewLabel}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onDownload} aria-label={`Download ${name}`}>
          <Download className="size-4" aria-hidden /> Download
        </Button>
      </span>
      )}
    </li>
  );
}

/**
 * Read-only view of the shop list attached to the request email: the saved shop table (its original Excel columns and
 * rows, paginated, scrolling both ways) — the same data the attached Excel is exported from when the email is sent.
 */
function ShopListPreview({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const h = useHandover(orderId);
  const total = h.data?.shopList?.total ?? 0;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Shop list"
      description={h.data ? `${total} shop${total === 1 ? "" : "s"} · read-only, as attached to this email` : undefined}
      className="max-w-[min(96vw,1400px)] max-h-[90dvh]"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {h.isPending ? (
        <RowsSkeleton rows={6} />
      ) : h.isError ? (
        <ErrorState error={h.error} onRetry={() => void h.refetch()} />
      ) : !h.data.type || h.data.type === "ASO" || !total ? (
        <EmptyState title="No shops in the list" description="The shop table of this order is empty." />
      ) : (
        <ShopTable orderId={orderId} type={h.data.type} summary={h.data.shopList} columns={h.data.columns} editable={false} canAddImages={false} hideHistory />
      )}
    </Modal>
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
  const [shopsOpen, setShopsOpen] = useState(false);
  const fail = (e: unknown) => toast(errorMessage(e), "error");
  return (
    <div className="space-y-4" data-testid="auto-attachments">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0e7490]">Included automatically</p>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-[#a5f3fc] bg-[#ecfeff]/60">
          <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <UserRound className="size-4 shrink-0 text-[#0891b2]" aria-hidden /> Client details and the primary contact person (in the message)
          </li>
          {r.rateCard?.choice === "SKIPPED" && (
            <li className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground">
              <SkipForward className="size-4 shrink-0 text-[#0891b2]" aria-hidden /> Rate Card skipped: no rate card goes with this email
            </li>
          )}
          {/* The included Rate Card was saved with another contact than the current point of contact (changed later). */}
          {a?.rateCard && r.rateCard?.includedContact && r.primaryContact?.name && r.rateCard.includedContact.trim().toLowerCase() !== r.primaryContact.name.trim().toLowerCase() && (
            <li className="flex items-start gap-3 bg-warning-soft/70 px-3 py-2.5 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                Rate Card {a.rateCard.label} has Kind Attn <b>{r.rateCard.includedContact}</b>, but the point of contact is now <b>{r.primaryContact.name}</b>. Open the Rate Card (Previous) and Save &amp; Continue to send a version
                with the new contact, or send with {a.rateCard.label} as it is.
              </span>
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
              // The uploaded Excel's name (the file sent under it); shops added by hand: the generated name.
              name={a.shopExcel.name ?? `Shop list (${a.shopExcel.rows} shop${a.shopExcel.rows === 1 ? "" : "s"}).xlsx`}
              meta={`${a.shopExcel.rows} shop${a.shopExcel.rows === 1 ? "" : "s"} · ${a.shopExcel.sized ? "with sizes · " : ""}as the table is when you send · Excel opens after download`}
              onPreview={() => setShopsOpen(true)}
              previewLabel="View"
              onDownload={() => void downloadShopExcel(r.orderId).catch(fail)}
            />
          )}
          {shopsOpen && <ShopListPreview orderId={r.orderId} onClose={() => setShopsOpen(false)} />}
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
          {/* Read-only (codes saved): the preview shows its own success banner instead. */}
          {!!sends?.sent && tab === "email" && !readOnly && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/25 bg-success-soft/60 px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success text-white">
                <Check className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-success">
                  Initial email sent{sends.sent > 1 && ` · Resent ${sends.sent - 1} time${sends.sent === 2 ? "" : "s"}`}
                </p>
                {sends.lastSentAt && <p className="text-xs text-muted-foreground">Last sent on {formatDateTimeIST(sends.lastSentAt)} · Resend sends a new email with the current details and files.</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setTab("history")}>
                <History className="size-4" aria-hidden /> View Email History
              </Button>
            </div>
          )}
          {/* Resend stays with the composer flow: hidden here once the codes are saved (the server refuses it too). */}
          {tab === "history" && <EmailHistory orderId={r.orderId} kind="PROJECT_CODE_REQUEST" allowResend={false} />}
          {tab === "email" && readOnly && <LatestRequestPreview r={r} onHistory={() => setTab("history")} />}
          {tab === "email" && !readOnly && <CodeRequestComposer r={r} files={files} setFiles={setFiles} send={send} onSent={onSent} resend={!!sends?.sent} />}
        </div>
      </TabPanel>
    </div>
  );
}

/** Codes saved (or branch locked): the latest recorded request email, read-only, with attachment preview / download. */
/** Files the preview opens in place (PDF and images); the others are downloaded. */
const previewable = (a: { name?: string | null; mimeType?: string | null }) => /^(application\/pdf|image\/)/i.test(a.mimeType ?? "") || /\.(pdf|png|jpe?g|webp|gif)$/i.test(a.name ?? "");

/** Email body tables / headings as structured cards (the stored HTML is sanitized, attribute-free, so classes apply). */
const MAIL_BODY =
  "[&_h3]:mt-6 [&_h3]:mb-2.5 [&_h3]:border-0 [&_h3]:pb-0 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-navy " +
  "[&_table]:mb-3 [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:overflow-hidden [&_table]:rounded-[10px] [&_table]:border [&_table]:border-border " +
  "[&_th]:border-b [&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_tr:last-child_td]:border-b-0 [&_tr:last-child_th]:border-b-0 [&_tbody_tr:nth-child(even)]:bg-muted/25";

/** Codes saved (or branch locked): the latest recorded request email, read-only, with attachment preview / download. */
function LatestRequestPreview({ r, onHistory }: { r: RecceState; onHistory: () => void }) {
  const q = useOrderEmails(r.orderId, "PROJECT_CODE_REQUEST");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const toast = useToast();
  const source = { orderId: r.orderId };
  if (q.isPending) return <RowsSkeleton rows={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data[0];
  if (!e) return <EmptyState icon={Inbox} title="No request email recorded" description="Email History shows every project code request sent for this project." />;
  const sent = e.status === "SENT";
  // The files this email actually carried (its own record), one per file id.
  const sentFiles = e.attachments.filter((a, i, all) => a.fileId && all.findIndex((x) => x.fileId === a.fileId) === i);
  const summary: { label: string; value: ReactNode; icon: typeof Mail }[] = [
    { label: "Email Status", value: <DeliveryBadge e={e} />, icon: Mail },
    { label: "Sent On", value: formatDateTimeIST(e.sentAt), icon: History },
    { label: "Sent By", value: e.sentBy?.name ?? "-", icon: UserRound },
    { label: "Reference", value: e.requestId ? <span className="font-mono">{e.requestId}</span> : "-", icon: BadgeCheck },
  ];
  return (
    <div className="space-y-4 text-sm">
      {/* Success banner (the latest email's own status, time and sender), then the read-only note. */}
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", sent ? "border-success/25 bg-success-soft/60" : "border-warning/30 bg-warning-soft/60")}>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", sent ? "bg-success text-white" : "bg-warning text-white")}>
          {sent ? <Check className="size-5" aria-hidden /> : <CircleAlert className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", sent ? "text-success" : "text-warning")}>{sent ? "Email Sent Successfully" : "Latest request email was not delivered"}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTimeIST(e.sentAt)} · by {e.sentBy?.name ?? "-"}
            {e.error && ` · ${e.error}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onHistory}>
          <History className="size-4" aria-hidden /> View Email History
        </Button>
      </div>
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden /> {r.codes ? "Codes saved: the request email is read-only." : "Read-only: the latest request email."}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <s.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <div className="mt-0.5 truncate text-sm font-semibold text-navy">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <h3 className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-navy">Email Details</h3>
        <dl className="divide-y divide-border">
          {[
            ["From", e.from || "-"],
            ["To", e.to.join(", ") || "-"],
            ["CC", e.cc.join(", ") || "-"],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[88px_1fr] gap-3 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[88px_1fr] gap-3 px-4 py-2.5">
            <dt className="text-muted-foreground">Subject</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium text-navy">
              {e.subject}
              {e.requestId && <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-brand">{e.requestId}</span>}
            </dd>
          </div>
        </dl>
      </section>

      {/* The email as sent: Adinn header, then the stored body (greeting, message, client / contact / shop sections). */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#F1F3FA] px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/AdinnLogo.svg" alt="Adinn" className="h-7 w-auto" />
          <p className="text-sm font-semibold text-navy">Project Code &amp; Estimation Code Request</p>
        </div>
        <div className="overflow-x-auto px-5 py-5">
          <RichTextView html={e.body} className={MAIL_BODY} />
        </div>
      </section>

      {sentFiles.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Paperclip className="size-3.5" aria-hidden /> Attachments ({sentFiles.length})
            {e.revisionLabel && <span className="normal-case">· Rate Card {e.revisionLabel}</span>}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {sentFiles.map((a) => {
              const info = e.attachmentInfo?.[a.fileId];
              const unavailable = info?.available === false;
              const type = (a.name ?? "").split(".").pop()?.toUpperCase();
              return (
                <AttachmentRow
                  key={a.fileId}
                  icon={/\.(xlsx?|csv)$/i.test(a.name ?? "") ? FileSpreadsheet : FileText}
                  name={a.name ?? "file"}
                  meta={[info ? ATTACHMENT_CATEGORY[info.category] : null, type && type !== (a.name ?? "").toUpperCase() ? type : null].filter(Boolean).join(" · ") || undefined}
                  unavailable={unavailable}
                  onPreview={previewable(a) ? () => setPreview({ saved: a, source }) : undefined}
                  onDownload={() => void downloadFile(a.fileId, source, a.name ?? "file").catch((err) => toast(errorMessage(err), "error"))}
                />
              );
            })}
          </ul>
        </section>
      )}
      <FileRefPreview target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

type EmailFactsData = NonNullable<RecceState["draft"]["facts"]>;
const FACT_ICONS: Record<string, typeof Building2> = { "Client Details": Building2, "Project Details": FolderKanban, "Contact Persons": UserRound };
const filledCell = (v?: string) => !!v && v !== "—" && v !== "-";

/**
 * Project code request email: the details the mail template prints by itself (client, project, contacts), read-only.
 * Detail sections as label / value pairs; contact tables as compact contact rows with the Primary badge. Display only:
 * the values are the server's, exactly as they go in the email.
 */
function EmailFacts({ facts }: { facts: EmailFactsData }) {
  const details = facts.sections.filter((s) => s.rows.length > 0 && !s.table);
  const lists = facts.sections.filter((s) => s.table);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label="Details the email prints">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[#f8fafd] px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-bold text-navy">
          <Mail className="size-4 text-royal" aria-hidden /> Printed in the email automatically
        </span>
        <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {facts.existing ? <> Client ID : <b className="font-mono text-navy">{facts.clientId || "-"}</b></> : "New client · Client ID requested with the codes"}
        </span>
      </header>
      <div className="space-y-4 p-4">
        {details.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {details.map((s) => {
              const Icon = FACT_ICONS[s.title] ?? FileText;
              return (
                <div key={s.title} className="min-w-0">
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Icon className="size-3.5 text-royal" aria-hidden /> {s.title}
                  </h4>
                  <dl className="divide-y divide-border/70 rounded-lg border border-border/80">
                    {s.rows.map((x) => (
                      <div key={x.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
                        <dt className="text-xs leading-5 text-muted-foreground">{x.label}</dt>
                        <dd className="min-w-0 break-words font-medium text-navy">{x.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
        {lists.map((s) => {
          const cols = s.table!.columns;
          const at = (name: string) => cols.indexOf(name);
          const [iName, iDes, iMob, iMail, iPri] = ["Name", "Designation", "Mobile", "Email", "Primary"].map(at);
          const Icon = FACT_ICONS[s.title] ?? UserRound;
          return (
            <div key={s.title} className="min-w-0">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="size-3.5 text-royal" aria-hidden /> {s.title}
                <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold normal-case tracking-normal">{s.table!.rows.length}</span>
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {s.table!.rows.map((row, i) => {
                  const v = (k: number) => (k >= 0 && filledCell(row[k]) ? row[k] : undefined);
                  const name = v(iName) ?? "-";
                  return (
                    <li key={i} className="flex min-w-0 items-start gap-3 rounded-lg border border-border/80 px-3 py-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-white" aria-hidden>
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-semibold text-navy" title={name}>{name}</span>
                          {v(iPri) && <span className="shrink-0 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-royal">Primary</span>}
                        </p>
                        {v(iDes) && <p className="truncate text-xs text-muted-foreground">{v(iDes)}</p>}
                        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground">
                          {v(iMob) && <span className="flex items-center gap-1"><Phone className="size-3 text-muted-foreground" aria-hidden /> {v(iMob)}</span>}
                          {v(iMail) && <span className="flex min-w-0 items-center gap-1"><Mail className="size-3 shrink-0 text-muted-foreground" aria-hidden /> <span className="truncate" title={v(iMail)}>{v(iMail)}</span></span>}
                          {!v(iMob) && !v(iMail) && <span className="text-muted-foreground">No mobile or email</span>}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">These details are not typed. Write only extra instructions in the Email Body below.</p>
      </div>
    </section>
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
  const facts = r.mail.enabled ? r.draft.facts : undefined;
  return (
    <div className="space-y-4">
      {facts && facts.sections.length > 0 && <EmailFacts facts={facts} />}
      <EmailComposer
        // A neutral prefix: ids such as "recce-mail-to" made Chrome treat To / Cc / Bcc as saved email fields.
        idPrefix="recce-request"
        compact
allowBcc
        persistKey={`${r.orderId}:email-note`}
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
  // Saved codes without a stored Zoho snapshot (saved before it was kept): the estimate is read once to show its details.
  const estimates = useRecceZohoEstimates(r.orderId, fromZoho ? undefined : lookupId || undefined, (locked && r.codes ? !r.codes.estimate : true) && (fromZoho || !!lookupId));
  const [project, setProject] = useStepDraft(`${key}:project`, r.codes?.projectCode ?? "");
  const [estimateId, setEstimateId] = useStepDraft(`${key}:estimate`, "");
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Get Reply: the reply is matched with the Zoho estimates once they load (never over a choice already made, never
  // saved by itself). It matches by the project code read from it, else by the possible codes / EST numbers in it. One
  // usable project code: chosen, with its estimate when it is the only usable one or the one the reply names. Several:
  // offered as suggestions. None: a message, the list stays for a manual choice.
  const [replyPick, setReplyPick] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [replySuggest, setReplySuggest] = useState<string[]>([]);
  const pickedFor = useRef<string | null>(null);
  const replyCode = r.codeReply?.detectedCode ?? [...(r.codeReplyHistory ?? [])].sort((a, b) => +new Date(b.receivedAt ?? b.at ?? 0) - +new Date(a.receivedAt ?? a.at ?? 0)).find((h) => h.detectedCode)?.detectedCode ?? null;
  const replyEsts = (r.codeReply?.estimates?.length ? r.codeReply.estimates : (r.codeReplyHistory ?? []).find((h) => h.estimates?.length)?.estimates) ?? [];
  const replyCands = r.codeReply?.candidates ?? [];
  const replyKey = [r.codeReply?.messageId ?? r.codeReply?.receivedAt ?? "", replyCode ?? "", replyCands.join(","), replyEsts.join(",")].join("|");
  // The project code a reply chose (not one picked by hand): a newer reply with another code replaces it.
  const fromReply = useRef<string | null>(null);
  useEffect(() => {
    const items = estimates.data?.items;
    if (locked || r.codes || !items || (!replyCode && !replyCands.length && !replyEsts.length) || pickedFor.current === replyKey) return;
    pickedFor.current = replyKey;
    setReplySuggest([]);
    const named = new Set([...replyEsts, ...replyCands].map((x) => x.trim().toUpperCase()));
    // Project codes the reply points to: the code read from it, else its possible codes and the projects of its EST numbers.
    const codes = replyCode ? [replyCode] : [...new Set(items.filter((e) => replyCands.includes(e.projectCode) || named.has(e.estimationCode.toUpperCase())).map((e) => e.projectCode))];
    const usableCodes = codes.filter((c) => items.some((e) => e.projectCode === c && e.valid && !e.usedBy));
    const shown = (replyCode ? [replyCode] : [...replyCands, ...replyEsts]).slice(0, 6).join(", ");
    // A code chosen by hand is never replaced: a reply with another usable code is only offered. A code an earlier reply
    // chose (also one kept in the draft) follows the newest reply.
    const replyCodes = [r.codeReply?.detectedCode, ...(r.codeReplyHistory ?? []).map((h) => h.detectedCode)];
    if (project && project !== fromReply.current && !replyCodes.includes(project)) {
      const other = usableCodes.length === 1 && usableCodes[0] !== project ? usableCodes[0] : null;
      if (other) {
        setReplySuggest([other]);
        setReplyPick({ tone: "warn", text: `The reply says project code ${other}, not ${project}. Click ${other} to use it.` });
      }
      return;
    }
    if (!usableCodes.length) {
      const used = items.find((e) => codes.includes(e.projectCode) && e.usedBy);
      setReplyPick({
        tone: "warn",
        text: codes.length
          ? `The reply's project code ${codes.join(", ")} cannot be used: ${used ? `already used by ${used.usedBy}` : "not a valid code"}. Choose another one below.`
          : `The codes in the reply (${shown}) are not among this client's Zoho estimates. Choose the project code below.`,
      });
      return;
    }
    if (usableCodes.length > 1) {
      setReplySuggest(usableCodes);
      setReplyPick({ tone: "warn", text: `The reply matches ${usableCodes.length} project codes in Zoho: choose one, then Save Codes.` });
      return;
    }
    const code = usableCodes[0]!;
    const free = items.filter((e) => e.projectCode === code && e.valid && !e.usedBy);
    const byReply = free.filter((e) => named.has(e.estimationCode.toUpperCase()));
    const pick = free.length === 1 ? free[0] : byReply.length === 1 ? byReply[0] : null;
    const updated = !!project && project !== code;
    // Same code as before: the estimate chosen for it stays unless the reply names one.
    if (!updated && project && !byReply.length && free.length > 1) return;
    fromReply.current = code;
    setProject(code);
    setEstimateId(pick?.estimateId ?? "");
    setReplyPick(
      pick
        ? { tone: "ok", text: `${updated ? "Updated from the newer reply" : "Selected from the reply"}: ${code} / ${pick.estimationCode}. Check them, then Save Codes.` }
        : { tone: "warn", text: `Project code ${code} selected from the reply. It has ${free.length} estimates: choose the estimation code, then Save Codes.` },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the estimates or the reply change, not on each choice
  }, [estimates.data, replyKey, locked, r.codes]);
  // A reply shows without a click or a page refresh: while the codes are not saved, this order's request replies are read
  // every 30 s (only these requests, not the whole mailbox; also a newer reply after one with a code), then the step reloads.
  const qc = useQueryClient();
  const auto = useAutoReplyCheck(r.requestIds, !r.codes && !locked);
  useEffect(() => {
    if (auto.dataUpdatedAt) void qc.invalidateQueries({ queryKey: ["sales", "order", r.orderId, "recce"] });
  }, [auto.dataUpdatedAt, r.orderId, qc]);
  if (locked && r.codes) {
    const found = estimates.data?.items.find((e) => e.estimationCode === r.codes?.estimationCode && e.projectCode === r.codes?.projectCode);
    return <CodesView r={r} estimate={found ?? null} loading={!r.codes.estimate && estimates.isFetching} />;
  }

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
    fromReply.current = replySuggest.includes(o.value) ? o.value : null;
    setReplyPick(null);
    setReplySuggest([]);
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
  // Latest reply read from the mailbox (a later mail without a code keeps the code / estimates an earlier reply gave). A hint only:
  // the codes themselves are chosen from the Zoho estimates below.
  const past = [...(r.codeReplyHistory ?? [])].sort((a, b) => +new Date(b.receivedAt ?? b.at ?? 0) - +new Date(a.receivedAt ?? a.at ?? 0));
  const reply = r.codeReply && {
    ...r.codeReply,
    detectedCode: r.codeReply.detectedCode ?? past.find((h) => h.detectedCode)?.detectedCode,
    estimates: r.codeReply.estimates?.length ? r.codeReply.estimates : past.find((h) => h.estimates?.length)?.estimates,
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
  const replies = [...(r.codeReplyHistory ?? [])].reverse();
  return (
    <div className="space-y-4">
      {!r.codes && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <span className="text-muted-foreground">{reply ? "Newer reply not showing? Read the mailbox again." : "Waiting for the project code reply."}</span>
          <GetReplyButton size="sm" requestIds={r.requestIds} />
        </div>
      )}
      {reply && !r.codes && (
        <div role="status" className="rounded-lg border border-[#cfe0ff] bg-[#eef4ff] px-3 py-2 text-sm text-navy">
          <p className="flex items-center gap-2 font-semibold"><MailCheck className="size-4 text-royal" aria-hidden /> Reply received{reply.from ? ` from ${reply.from}` : ""}</p>
          <p className="mt-1">{reply.detectedCode ? <>Project code <span className="font-mono font-bold">{reply.detectedCode}</span> was read from the reply.</> : "No single project code could be read from the reply."}{!!reply.estimates?.length && <> Estimates in the reply: <span className="font-mono font-semibold">{reply.estimates.join(", ")}</span>.</>}</p>
          {replies.length > 1 && (
            <details className="mt-1 text-xs"><summary className="cursor-pointer font-semibold">Replies read ({replies.length})</summary>
              <ul className="mt-1 space-y-1">{replies.map((h, i) => <li key={i}><span className="font-mono font-semibold">{h.detectedCode ?? "No code found"}</span>{!!h.estimates?.length && <span className="font-mono text-muted-foreground"> · {h.estimates.join(", ")}</span>}<span className="text-muted-foreground"> · {h.from} · {formatDateTime(h.receivedAt ?? h.at)}{i === 0 ? " · latest" : ""}</span></li>)}</ul>
            </details>
          )}
          {replySuggest.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Project codes from the reply">
              {replySuggest.map((c) => (
                <button key={c} type="button" onClick={() => pickProject({ value: c, label: c })} className="rounded-full border border-royal/30 bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-royal hover:bg-royal hover:text-white">
                  {c}
                </button>
              ))}
            </div>
          )}
          {replyPick && (
            <p className={cn("mt-1.5 flex items-start gap-1.5 font-medium", replyPick.tone === "ok" ? "text-success" : "text-warning")}>
              {replyPick.tone === "ok" ? <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />} {replyPick.text}
            </p>
          )}
        </div>
      )}
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

/** Zoho estimate status colour: approved / accepted green, declined / expired red, draft grey, others amber. */
function statusTone(status: string) {
  const v = status.toLowerCase();
  if (/(approved|accepted|invoiced)/.test(v)) return "border-success/30 bg-success/10 text-success";
  if (/(declined|rejected|expired)/.test(v)) return "border-danger/30 bg-danger/10 text-danger";
  if (/draft/.test(v)) return "border-border bg-muted text-muted-foreground";
  return "border-warning/30 bg-warning/10 text-warning";
}

/**
 * Saved codes and Client ID with the Zoho estimate they came from, read-only (the locked codes step and Lead
 * Management > Full Details). `estimate`: read from Zoho for codes saved before the estimate was stored on the order.
 */
export function CodesView({ r, estimate, loading }: { r: RecceState; estimate?: Pick<ZohoEstimateOption, "date" | "total" | "status" | "salesperson" | "location"> | null; loading?: boolean }) {
  if (!r.codes) return null;
  const fromZoho = !!r.zohoClientId?.fromZoho;
  const est = r.codes.estimate ?? estimate ?? null;
  const facts = est
    ? [
        { icon: CalendarDays, label: "Estimate Date", value: est.date ? formatDate(est.date) : null },
        { icon: IndianRupee, label: "Amount", value: est.total !== null && est.total !== undefined ? formatCurrency(est.total) : null, num: true },
        { icon: UserRound, label: "Salesperson", value: est.salesperson },
        { icon: MapPin, label: "Location", value: est.location },
      ]
    : [];
  return (
    <section className="overflow-hidden rounded-xl border bg-surface shadow-sm" style={{ borderColor: `${TEAL}40` }} aria-label="Project and estimation codes">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5" style={{ borderColor: `${TEAL}30`, background: ASSIGN_META.RECCE.soft }}>
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BadgeCheck className="size-4" style={{ color: TEAL }} aria-hidden /> Codes from Zoho estimate
        </span>
        {est?.status && <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize", statusTone(est.status))}>{est.status}</span>}
      </header>
      <dl className="grid sm:grid-cols-3">
        {[
          { label: "Project Code", value: r.codes.projectCode, icon: KeyRound },
          { label: "Estimation Code", value: r.codes.estimationCode, icon: FileText },
          { label: fromZoho ? "Client ID" : "Client ID (Zoho)", value: r.codes.clientId, icon: Lock },
        ].map((c) => (
          <div key={c.label} className="bg-surface px-4 py-3 sm:px-5">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <c.icon className="size-3.5" aria-hidden /> {c.label}
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold tracking-wider text-foreground">{c.value || "-"}</dd>
          </div>
        ))}
      </dl>
      {loading ? (
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-4 sm:px-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : facts.length ? (
        <dl className="grid gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="flex min-w-0 items-start gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: ASSIGN_META.RECCE.soft, color: TEAL }}>
                <f.icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className={cn("truncate text-sm font-medium text-foreground", f.num && "tabular-nums")} title={f.value ?? undefined}>
                  {f.value || "-"}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}
      <footer className="bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:px-5">
        Saved {r.codes.savedBy ? <>by <b className="font-medium text-foreground">{r.codes.savedBy}</b> </> : ""}· {formatDateTimeIST(r.codes.savedAt)}
      </footer>
    </section>
  );
}

/** Today in India (YYYY-MM-DD), not UTC: before 5:30 AM IST the UTC date is still yesterday. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
/** Opens the browser's calendar on a click anywhere in a date input (not only on its icon). */
const openPicker = (e: { currentTarget: HTMLInputElement }) => {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Already open, or the browser refuses: the native icon still works.
  }
};

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
    else if (startDate < today()) e.startDate = "Start date cannot be in the past";
    if (!targetDate) e.targetDate = "Choose the expected end date";
    else if (startDate && targetDate < startDate) e.targetDate = "End date must be on or after the start date";
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" htmlFor="recce-start" required error={errors.startDate}>
            <Input
              id="recce-start"
              type="date"
              className="cursor-pointer"
              min={today()}
              value={startDate}
              aria-invalid={!!errors.startDate}
              onClick={openPicker}
              onChange={(e) => {
                const v = e.target.value;
                setStartDate(v);
                setErrors((x) => ({ ...x, startDate: "" }));
                // An end date before the new start date is cleared and asked again.
                if (v && targetDate && targetDate < v) {
                  setTargetDate("");
                  setErrors((x) => ({ ...x, targetDate: "Choose the expected end date again (on or after the new start date)" }));
                }
              }}
            />
          </Field>
          <Field label="Expected End Date" htmlFor="recce-end" required error={errors.targetDate}>
            <Input
              id="recce-end"
              type="date"
              className="cursor-pointer"
              min={startDate || today()}
              value={targetDate}
              aria-invalid={!!errors.targetDate}
              onClick={openPicker}
              onChange={(e) => {
                setTargetDate(e.target.value);
                setErrors((x) => ({ ...x, targetDate: "" }));
              }}
            />
          </Field>
        </div>
        <Field label="Priority" htmlFor="recce-priority">
          {/* High / Medium / Low; Urgent shows only when it is the value already chosen (kept, never changed silently). */}
          <div id="recce-priority" role="radiogroup" aria-label="Priority" className="flex gap-2">
            {(["HIGH", "MEDIUM", "LOW", ...(priority === "URGENT" ? (["URGENT"] as const) : [])] as Priority[]).map((p, i, all) => {
              const on = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setPriority(p)}
                  onKeyDown={(e) => {
                    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                    if (!step) return;
                    e.preventDefault();
                    const next = all[(i + step + all.length) % all.length]!;
                    setPriority(next);
                    (e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=radio]")[(i + step + all.length) % all.length])?.focus();
                  }}
                  className={cn(
                    "h-10 flex-1 rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                    on ? "border-transparent text-white shadow-sm" : "border-border bg-surface text-foreground hover:bg-muted",
                  )}
                  style={on ? { background: TEAL, ["--tw-ring-color" as string]: TEAL } : undefined}
                >
                  {PRIORITIES[p]}
                </button>
              );
            })}
          </div>
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
            await assign.mutateAsync({ assigneeId: person!.value, startDate, targetDate, priority, note: note.trim() || undefined });
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
          Project <b className="font-mono text-foreground">{r.codes?.projectCode}</b>{r.codes?.estimationCode ? ` (${r.codes.estimationCode})` : ""} is created in Operations with the handover, and {person?.label} gets a
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
          Project <span className="font-mono font-semibold text-foreground">{r.project?.code ?? r.codes?.projectCode}</span>{r.codes?.estimationCode ? ` · ${r.codes.estimationCode}` : ""}
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

const PRIORITY_TONE: Record<string, string> = {
  URGENT: "border-danger/30 bg-danger/10 text-danger",
  HIGH: "border-warning/30 bg-warning/10 text-warning",
  MEDIUM: "border-brand/30 bg-brand/10 text-brand",
  LOW: "border-border bg-muted text-muted-foreground",
};
const initials = (name?: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * Assign step after the assignment, read-only: the Recce / Operations person, the project dates and priority, the
 * notes for the Recce team, and who assigned it.
 */
export function AssignedView({ r, projectLink = false }: { r: RecceState; projectLink?: boolean }) {
  const p = r.project;
  const a = r.assignee;
  const start = p?.startDate ?? null;
  const end = p?.targetDate ?? null;
  const days = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1 : null;
  const priority = p?.priority?.toUpperCase() ?? null;
  const role = a?.role === "RECCE_COORDINATOR" ? "Recce Coordinator" : a?.role === "OPERATIONS" ? "Operations" : "Recce team";
  const schedule = [
    { icon: CalendarDays, label: "Start Date", value: start ? formatDate(start) : "-", sub: null as string | null },
    { icon: CalendarCheck, label: "Expected End Date", value: end ? formatDate(end) : "-", sub: days && days > 0 ? `${days} day${days === 1 ? "" : "s"}` : null },
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border bg-surface shadow-sm"
      style={{ borderColor: `${TEAL}40` }}
      aria-label="Recce assignment"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: `${TEAL}30`, background: ASSIGN_META.RECCE.soft }}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: TEAL }}>
            <BadgeCheck className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Assigned to the Recce team</span>
            <span className="block text-xs text-muted-foreground">
              Project <b className="font-mono text-foreground">{p?.code ?? r.codes?.projectCode}</b> · {r.codes?.estimationCode} · lead completed
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {p?.status && (
            <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-success">{p.status.toLowerCase().replace(/_/g, " ")}</span>
          )}
          {projectLink && p && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${p._id}`}>
                <ExternalLink className="size-4" aria-hidden /> Open Project
              </Link>
            </Button>
          )}
        </span>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
        {/* The Recce / Operations person */}
        <div className="bg-surface px-4 py-4 sm:px-5">
          <p className="text-xs font-medium text-muted-foreground">Recce / Operations Person</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: TEAL }} aria-hidden>
              {initials(a?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{a?.name ?? "-"}</p>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
          </div>
          {(a?.email || a?.phone) && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {a?.phone && (
                <li className="flex items-center gap-2 text-foreground">
                  <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={`tel:${a.phone}`} className="hover:underline">
                    {a.phone}
                  </a>
                </li>
              )}
              {a?.email && (
                <li className="flex min-w-0 items-center gap-2 text-foreground">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={`mailto:${a.email}`} className="truncate hover:underline" title={a.email}>
                    {a.email}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Schedule and priority */}
        <dl className="grid sm:grid-cols-3">
          {schedule.map((f) => (
            <div key={f.label} className="flex items-start gap-2.5 bg-surface px-4 py-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: ASSIGN_META.RECCE.soft, color: TEAL }}>
                <f.icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-semibold text-foreground">{f.value}</dd>
                {f.sub && <dd className="text-xs text-muted-foreground">{f.sub}</dd>}
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2.5 bg-surface px-4 py-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: ASSIGN_META.RECCE.soft, color: TEAL }}>
              <Flag className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Priority</dt>
              <dd className="mt-0.5 text-sm">
                {priority ? (
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", PRIORITY_TONE[priority] ?? PRIORITY_TONE.LOW)}>
                    {PRIORITIES[priority as Priority] ?? priority}
                  </span>
                ) : (
                  "-"
                )}
              </dd>
            </div>
          </div>
        </dl>
      </div>

      {/* Notes for the Recce team */}
      <div className="px-4 py-3 sm:px-5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <StickyNote className="size-3.5" aria-hidden /> Notes for the Recce Team
        </p>
        {r.note ? (
          <p className="mt-1.5 whitespace-pre-wrap rounded-lg border-l-4 bg-muted/40 px-3 py-2 text-sm text-foreground" style={{ borderLeftColor: TEAL }}>
            {r.note}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No notes were added.</p>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:px-5">
        <span>
          Assigned {r.assignedBy ? <>by <b className="font-medium text-foreground">{r.assignedBy}</b> </> : ""}· {formatDateTimeIST(r.assignedAt)}
        </span>
        <span className="flex items-center gap-1.5">
          <FolderKanban className="size-3.5" aria-hidden /> The Recce team works on this project in Operations.
        </span>
      </footer>
    </motion.section>
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
      {assigned && step !== "assign" && <AssignedBanner r={r} projectLink={projectLink} />}
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
        (assigned ? <AssignedView r={r} projectLink={projectLink} /> : <AssignStep r={r} onAssigned={onAssigned} />)}
    </div>
  );
}
