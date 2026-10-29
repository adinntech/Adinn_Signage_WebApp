"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Check, CircleAlert, ExternalLink, FileSpreadsheet, Lock, Paperclip, Save, Send, UserRound } from "lucide-react";
import { HandoverTab } from "@/components/orders/handover-tab";
import { EmailComposer } from "@/components/sales/email-composer";
import { EmailHistory } from "@/components/sales/email-history";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { DetailItem } from "@/components/ui/page-header";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import type { LeadDetail } from "@/lib/api/leads";
import { PRIORITIES, useAssignRecce, useRecce, useRecceUsers, useSaveRecceCodes, useSendCodeRequest, type Priority, type RecceState } from "@/lib/api/recce";
import { formatDateTimeIST } from "@/lib/format";
import { RouteNotice, StepFooter } from "./assign-panels";
import { ASSIGN_META } from "./stage-meta";

const TEAL = ASSIGN_META.RECCE.color;
const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv";

/** What goes with every request email by itself: client details + contacts (in the message), shop Excel, handover documents. */
function AutoIncluded({ r }: { r: RecceState }) {
  const a = r.autoAttachments;
  return (
    <div className="mb-3 space-y-1.5 rounded-lg bg-[#ecfeff] px-3 py-2 text-xs" data-testid="auto-attachments">
      <p className="font-semibold text-[#0e7490]">Included automatically</p>
      <p className="flex items-center gap-1.5">
        <UserRound className="size-3.5 shrink-0 text-[#0891b2]" aria-hidden /> Client details and contact persons (in the message)
      </p>
      {a?.shopExcel && (
        <p className="flex items-center gap-1.5">
          <FileSpreadsheet className="size-3.5 shrink-0 text-[#0891b2]" aria-hidden /> Shop list Excel: {a.shopExcel.rows} shop{a.shopExcel.rows === 1 ? "" : "s"}
          {a.shopExcel.sized ? " with sizes" : ""} (as the table is when you send)
        </p>
      )}
      {!!a?.documents.length && (
        <p className="flex items-start gap-1.5">
          <Paperclip className="mt-0.5 size-3.5 shrink-0 text-[#0891b2]" aria-hidden />
          <span>
            {a.documents.length} document{a.documents.length === 1 ? "" : "s"} from Communication & Attachments: {a.documents.map((d) => d.name).join(", ")}
          </span>
        </p>
      )}
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
  const [files, setFiles] = useState<File[]>([]);
  if (locked)
    return (
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {r.requests.count} email{r.requests.count === 1 ? "" : "s"} recorded, last on {formatDateTimeIST(r.requests.lastSentAt)}. Open Email History on the mind map to see them.
      </p>
    );
  return (
    <div className="space-y-4">
      {r.emailDone && (
        <p className="flex items-center gap-2 rounded-lg bg-success-soft/70 px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" aria-hidden /> Already sent {r.requests.count} time{r.requests.count === 1 ? "" : "s"}. Send again only if needed; Email History has the details.
        </p>
      )}
      <EmailComposer
        idPrefix="recce-mail"
        orderId={r.orderId}
        from={r.mail.from}
        mailEnabled={r.mail.enabled}
        draft={r.draft}
        attachments={[]}
        attachmentLabel="Attachments"
        attachmentArea={
          <>
            <AutoIncluded r={r} />
            <FileUploader id="recce-mail-files" files={files} onChange={setFiles} accept={DOC_ACCEPT} multiple compact hint="More files (optional): PDF, images, Word, PowerPoint, Excel · up to 10" />
          </>
        }
        sending={send.isPending}
        onSend={async (v) => {
          const fd = new FormData();
          fd.append("payload", JSON.stringify(v));
          for (const f of files) fd.append("files", f);
          const sent = await send.mutateAsync(fd);
          setFiles([]);
          // Let the composer show its result first, then move on to the codes.
          if (sent.status !== "FAILED") setTimeout(onSent, 400);
          return sent;
        }}
      />
    </div>
  );
}

/**
 * Step 3: the 8-digit project code and the EST- estimation code, with the Client ID in Zoho: typed for a New client
 * (created in Zoho after the request email), read-only from Zoho for an Existing client.
 */
function CodesStep({ r, locked, onSaved }: { r: RecceState; locked: boolean; onSaved: () => void }) {
  const toast = useToast();
  const save = useSaveRecceCodes(r.orderId);
  const [project, setProject] = useState(r.codes?.projectCode ?? "");
  const [est, setEst] = useState((r.codes?.estimationCode ?? "").replace(/^EST-/, ""));
  const fromZoho = !!r.zohoClientId?.fromZoho;
  const [clientId, setClientId] = useState(r.codes?.clientId ?? (fromZoho ? "" : (r.zohoClientId?.value ?? "")));
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (locked && r.codes)
    return (
      <dl className="grid gap-4 sm:grid-cols-4">
        <DetailItem label="Project Code">
          <span className="font-mono text-base">{r.codes.projectCode}</span>
        </DetailItem>
        <DetailItem label="Estimation Code">
          <span className="font-mono text-base">{r.codes.estimationCode}</span>
        </DetailItem>
        <DetailItem label={fromZoho ? "Zoho Client ID" : "Client ID (Zoho)"}>{r.codes.clientId ? <span className="font-mono text-base">{r.codes.clientId}</span> : null}</DetailItem>
        <DetailItem label="Saved">{r.codes.savedBy ? `${r.codes.savedBy} · ${formatDateTimeIST(r.codes.savedAt)}` : formatDateTimeIST(r.codes.savedAt)}</DetailItem>
      </dl>
    );
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!/^\d{8}$/.test(project)) e.projectCode = "Project code must be exactly 8 digits";
    if (!/^\d{6}$/.test(est)) e.estimationCode = "Enter the 6 digits after EST-";
    if (!fromZoho && !/^[A-Za-z0-9-]{2,20}$/.test(clientId.trim())) e.clientId = "Enter the Client ID created in Zoho (2-20 letters, digits or -)";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await save.mutateAsync({ projectCode: project, estimationCode: `EST-${est}`, clientId: fromZoho ? undefined : clientId.trim() });
      toast("Project and estimation codes saved");
      onSaved();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      if (Object.keys(fe).length) setErrors(fe);
      toast(errorMessage(err), "error");
    }
  };
  const changed = project !== (r.codes?.projectCode ?? "") || `EST-${est}` !== (r.codes?.estimationCode ?? "EST-") || (!fromZoho && clientId.trim() !== (r.codes?.clientId ?? ""));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Project Code" htmlFor="recce-project-code" required error={errors.projectCode} hint="8 digits, e.g. 22070277">
          <Input
            id="recce-project-code"
            inputMode="numeric"
            className="font-mono tracking-wider"
            placeholder="22070277"
            value={project}
            aria-invalid={!!errors.projectCode}
            onChange={(e) => setProject(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        </Field>
        <Field label="Estimation Code" htmlFor="recce-est-code" required error={errors.estimationCode} hint="EST- and 6 digits, e.g. EST-323343">
          <div className="flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-muted px-3 font-mono text-sm font-semibold text-muted-foreground">EST-</span>
            <Input
              id="recce-est-code"
              inputMode="numeric"
              className="rounded-l-none font-mono tracking-wider"
              placeholder="323343"
              value={est}
              aria-invalid={!!errors.estimationCode}
              onChange={(e) => setEst(e.target.value.replace(/^EST-?/i, "").replace(/\D/g, "").slice(0, 6))}
            />
          </div>
        </Field>
        {fromZoho ? (
          <Field label="Zoho Client ID" htmlFor="recce-client-id" hint="Existing client: taken from Zoho">
            <div className="relative">
              <Input id="recce-client-id" readOnly value={r.zohoClientId?.value ?? "Not found in Zoho"} className="bg-muted pr-9 font-mono" />
              <Lock className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            </div>
          </Field>
        ) : (
          <Field label="Client ID (Zoho)" htmlFor="recce-client-id" required error={errors.clientId} hint="New client: the ID created in Zoho">
            <Input id="recce-client-id" className="font-mono tracking-wider" maxLength={20} placeholder="e.g. 30196" value={clientId} aria-invalid={!!errors.clientId} onChange={(e) => setClientId(e.target.value.replace(/[^A-Za-z0-9-]/g, ""))} />
          </Field>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{r.codes ? `Saved by ${r.codes.savedBy ?? "-"} · ${formatDateTimeIST(r.codes.savedAt)}` : "Each code can be used for one project only."}</span>
        <Button variant="brand" onClick={submit} loading={save.isPending} disabled={!changed} style={changed ? { background: TEAL } : undefined}>
          <Save className="size-4" aria-hidden /> Save Codes
        </Button>
      </div>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Step 4: the Recce / Operations person, the project dates and location, and notes. Assigning completes the lead. */
function AssignStep({ r, onAssigned }: { r: RecceState; onAssigned?: () => void }) {
  const toast = useToast();
  const users = useRecceUsers();
  const assign = useAssignRecce(r.orderId);
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<SearchOption | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [targetDate, setTargetDate] = useState("");
  const [district, setDistrict] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [note, setNote] = useState("");
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

function AssignedBanner({ r }: { r: RecceState }) {
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
      {r.project && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${r.project._id}`}>
            <ExternalLink className="size-4" aria-hidden /> Open Project
          </Link>
        </Button>
      )}
    </motion.div>
  );
}

export type RecceStep = "email" | "history" | "codes" | "handover" | "assign";

/**
 * Project Assign > Assign to Recce Team, one step at a time (opened from the mind map): the handover (same details as
 * for Client Servicing, always in full), the project code request email (+ Email History), the codes with the Client
 * ID, and the Recce / Operations person. `onDone` moves on; assigning creates the operations project and completes the lead.
 */
export function RecceBranchPanel({ detail, step, onDone, onAssigned }: { detail: LeadDetail; step: RecceStep; onDone: () => void; onAssigned?: () => void }) {
  const q = useRecce(detail.order._id, !detail.handover.assignee);
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

  return (
    <div className="space-y-4">
      {assigned && <AssignedBanner r={r} />}
      {step === "handover" && !locked && !r.route && <RouteNotice branch="RECCE" />}
      {step === "email" && <CodeRequestStep r={r} locked={locked} onSent={onDone} />}
      {step === "history" && <EmailHistory orderId={r.orderId} kind="PROJECT_CODE_REQUEST" allowResend={!locked} />}
      {step === "codes" && <CodesStep r={r} locked={locked} onSaved={onDone} />}
      {step === "handover" && (
        <>
          <HandoverTab order={detail.order} mode="recce" locked={locked} />
          {!locked && <StepFooter orderId={r.orderId} next="Project Code Request Email" onContinue={onDone} full />}
        </>
      )}
      {step === "assign" &&
        (assigned ? <p className="text-sm text-muted-foreground">Assigned. The Recce team works on project {r.project?.code} in Operations.</p> : <AssignStep r={r} onAssigned={onAssigned} />)}
    </div>
  );
}
