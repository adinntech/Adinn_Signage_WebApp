"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Check, ChevronDown, CircleAlert, ClipboardList, ExternalLink, Hash, LockKeyhole, Mail, Save, Send, UserRoundCheck } from "lucide-react";
import { HandoverTab } from "@/components/orders/handover-tab";
import { EmailComposer } from "@/components/sales/email-composer";
import { EmailHistory } from "@/components/sales/email-history";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { DetailItem } from "@/components/ui/page-header";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import type { LeadDetail } from "@/lib/api/leads";
import { PRIORITIES, useAssignRecce, useRecce, useRecceUsers, useSaveRecceCodes, useSendCodeRequest, type Priority, type RecceState } from "@/lib/api/recce";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useScrollTo } from "@/hooks/use-scroll-to";
import { ASSIGN_META } from "./stage-meta";

const TEAL = ASSIGN_META.RECCE.color;
const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv";
type StepStatus = "DONE" | "CURRENT" | "PENDING";

/** One step of the Recce branch: a numbered node on a vertical rail, with a collapsible body. */
function Step({
  id,
  n,
  title,
  icon: Icon,
  status,
  summary,
  last,
  defaultOpen,
  children,
}: {
  id: string;
  n: number;
  title: string;
  icon: typeof Mail;
  status: StepStatus;
  summary?: React.ReactNode;
  last?: boolean;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = status === "DONE";
  const current = status === "CURRENT";
  return (
    <motion.li id={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.06 }} className="relative scroll-mt-4 pl-14">
      {/* Rail to the next step: filled once this one is done. */}
      {!last && (
        <span aria-hidden className="absolute bottom-[-1rem] left-[1.3rem] top-12 w-0.5 rounded-full bg-slate-200">
          <motion.span className="absolute inset-0 origin-top rounded-full" style={{ background: TEAL }} initial={{ scaleY: 0 }} animate={{ scaleY: done ? 1 : 0 }} transition={{ duration: 0.5 }} />
        </span>
      )}
      <span
        aria-hidden
        className={cn("absolute left-0 top-1 flex size-11 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors", done ? "text-white" : current ? "bg-white" : "border-slate-300 bg-white text-muted-foreground")}
        style={done ? { background: TEAL, borderColor: TEAL } : current ? { borderColor: TEAL, color: TEAL, boxShadow: `0 0 0 4px ${TEAL}22` } : undefined}
      >
        {done ? <Check className="size-5" strokeWidth={3} /> : n}
      </span>
      <Card className={cn("overflow-hidden", current && "shadow-card")} style={current ? { borderColor: `${TEAL}66` } : undefined}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40">
          <Icon className="size-5 shrink-0" style={{ color: done || current ? TEAL : "#94a3b8" }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-primary">{title}</span>
            {summary && <span className="block truncate text-xs text-muted-foreground">{summary}</span>}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", done ? "bg-success-soft text-success" : current ? "text-white" : "bg-muted text-muted-foreground")} style={current ? { background: TEAL } : undefined}>
            {done ? "Done" : current ? "Now" : "Pending"}
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
              <div className="border-t border-border p-5">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.li>
  );
}

/** Step 1: ask for the project code by email (To / CC / subject / message / attachments). */
function CodeRequestStep({ r, locked }: { r: RecceState; locked: boolean }) {
  const send = useSendCodeRequest(r.orderId);
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div className="space-y-5">
      {!locked && (
        <EmailComposer
          idPrefix="recce-mail"
          orderId={r.orderId}
          from={r.mail.from}
          mailEnabled={r.mail.enabled}
          draft={r.draft}
          attachments={[]}
          attachmentLabel="Attachments (optional): PDF, images, Word, PowerPoint, Excel"
          attachmentArea={<FileUploader id="recce-mail-files" files={files} onChange={setFiles} accept={DOC_ACCEPT} multiple compact hint="Up to 10 files" />}
          sending={send.isPending}
          onSend={async (v) => {
            const fd = new FormData();
            fd.append("payload", JSON.stringify(v));
            for (const f of files) fd.append("files", f);
            const sent = await send.mutateAsync(fd);
            setFiles([]);
            return sent;
          }}
        />
      )}
      <div id="recce-step-history" className="scroll-mt-4">
        <p className="mb-2 text-sm font-semibold text-primary">Email History</p>
        <EmailHistory orderId={r.orderId} kind="PROJECT_CODE_REQUEST" allowResend={!locked} />
      </div>
    </div>
  );
}

/** Step 2: the 8-digit project code and the EST- estimation code. */
function CodesStep({ r, locked }: { r: RecceState; locked: boolean }) {
  const toast = useToast();
  const save = useSaveRecceCodes(r.orderId);
  const [project, setProject] = useState(r.codes?.projectCode ?? "");
  const [est, setEst] = useState((r.codes?.estimationCode ?? "").replace(/^EST-/, ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (locked && r.codes)
    return (
      <dl className="grid gap-4 sm:grid-cols-3">
        <DetailItem label="Project Code">
          <span className="font-mono text-base">{r.codes.projectCode}</span>
        </DetailItem>
        <DetailItem label="Estimation Code">
          <span className="font-mono text-base">{r.codes.estimationCode}</span>
        </DetailItem>
        <DetailItem label="Saved">{r.codes.savedBy ? `${r.codes.savedBy} · ${formatDateTime(r.codes.savedAt)}` : formatDateTime(r.codes.savedAt)}</DetailItem>
      </dl>
    );
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!/^\d{8}$/.test(project)) e.projectCode = "Project code must be exactly 8 digits";
    if (!/^\d{6}$/.test(est)) e.estimationCode = "Enter the 6 digits after EST-";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await save.mutateAsync({ projectCode: project, estimationCode: `EST-${est}` });
      toast("Project and estimation codes saved");
    } catch (err) {
      const fe = fieldErrorsOf(err);
      if (Object.keys(fe).length) setErrors(fe);
      toast(errorMessage(err), "error");
    }
  };
  const changed = project !== (r.codes?.projectCode ?? "") || `EST-${est}` !== (r.codes?.estimationCode ?? "EST-");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{r.codes ? `Saved by ${r.codes.savedBy ?? "-"} · ${formatDateTime(r.codes.savedAt)}` : "Each code can be used for one project only."}</span>
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
  const ready = r.missing.length === 0 && r.projectContacts > 0;

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
      {(r.missing.length > 0 || r.projectContacts === 0) && (
        <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm">
          {r.missing.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden /> {m}
            </li>
          ))}
          {r.projectContacts === 0 && (
            <li className="flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden /> Add a contact person with both a mobile number and an email (step 3): the Recce team calls them
            </li>
          )}
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
          Assigned to <b>{r.assignee?.name}</b> (Recce team) on {formatDate(r.assignedAt)}
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

/**
 * Project Assign > Assign to Recce Team: project code request email, codes, the handover (same details as for Client
 * Servicing, always in full) and the Recce / Operations person. Assigning creates the operations project and completes the lead.
 */
export function RecceBranchPanel({ detail, onAssigned, focus }: { detail: LeadDetail; onAssigned?: () => void; focus?: string | null }) {
  const q = useRecce(detail.order._id, !detail.handover.assignee);
  // Opened from a mind map step: that step opens and scrolls into view (Email History sits inside step 1).
  useScrollTo(focus ? `recce-step-${focus}` : null, q.isSuccess, 450);
  if (detail.handover.assignee)
    return <EmptyState icon={LockKeyhole} title="Not needed" description={`This project is assigned to Client Servicing (${detail.handover.assignee.name}).`} />;
  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const assigned = !!r.assignee;
  if (!assigned && !r.unlocked) return <EmptyState icon={LockKeyhole} title="Opens at Project Assign" description="The Recce team can be assigned once the lead is at Project Assign." />;
  const handoverMissing = r.missing.filter((m) => !m.includes("project code"));
  const s1: StepStatus = r.requests.count ? "DONE" : "CURRENT";
  const s2: StepStatus = r.codes ? "DONE" : "CURRENT";
  const s3: StepStatus = handoverMissing.length || r.projectContacts === 0 ? (r.codes ? "CURRENT" : "PENDING") : "DONE";
  const s4: StepStatus = assigned ? "DONE" : r.missing.length === 0 ? "CURRENT" : "PENDING";
  const first = !assigned ? [s1, s2, s3, s4].findIndex((s) => s !== "DONE") : -1;
  const asked = focus === "history" ? 0 : ["email", "codes", "handover", "assign"].indexOf(focus ?? "");
  const opens = (i: number) => (asked >= 0 ? asked === i : first === i);

  return (
    <div className="space-y-4">
      {assigned && <AssignedBanner r={r} />}
      <ol className="space-y-4">
        <Step
          id="recce-step-email"
          n={1}
          title="Project Code Request Email"
          icon={Mail}
          status={assigned ? "DONE" : s1}
          defaultOpen={opens(0)}
          summary={r.requests.count ? `${r.requests.count} sent · last ${formatDateTime(r.requests.lastSentAt)}${r.requests.lastStatus && r.requests.lastStatus !== "SENT" ? ` (${r.requests.lastStatus === "SKIPPED" ? "not sent" : "failed"})` : ""}` : "Ask for the project code to be created"}
        >
          <CodeRequestStep r={r} locked={assigned} />
        </Step>
        <Step id="recce-step-codes" n={2} title="Project Code & Estimation Code" icon={Hash} status={assigned ? "DONE" : s2} defaultOpen={opens(1)} summary={r.codes ? `${r.codes.projectCode} · ${r.codes.estimationCode}` : "8-digit project code and EST- estimation code"}>
          <CodesStep r={r} locked={assigned} />
        </Step>
        <Step
          id="recce-step-handover"
          n={3}
          title="Handover Type & Details"
          icon={ClipboardList}
          status={assigned ? "DONE" : s3}
          defaultOpen={opens(2)}
          summary={handoverMissing[0] ?? "ASO, Shop Details Only or Shop + Measurement, with notes, voice notes and documents"}
        >
          <HandoverTab order={detail.order} mode="recce" locked={assigned} />
        </Step>
        <Step
          id="recce-step-assign"
          n={4}
          title="Assign to Recce / Operations"
          icon={UserRoundCheck}
          status={s4}
          last
          defaultOpen={asked >= 0 ? asked === 3 : first === 3 || (first === -1 && !assigned)} summary={assigned ? `${r.assignee?.name} · ${formatDate(r.assignedAt)}` : "Recce person, dates, location and notes"}>
          {assigned ? <p className="text-sm text-muted-foreground">Assigned. The Recce team works on project {r.project?.code} in Operations.</p> : <AssignStep r={r} onAssigned={onAssigned} />}
        </Step>
      </ol>
    </div>
  );
}
