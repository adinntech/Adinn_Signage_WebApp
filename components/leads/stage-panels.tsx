"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Clock3, ExternalLink, LockKeyhole, MessagesSquare, Pencil, Save, Send, Sparkles, Repeat, Trash2 } from "lucide-react";
import { CompanyDetailsCard, ContactsCard } from "@/components/clients/client-info";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { HandoverTab } from "@/components/orders/handover-tab";
import { AttachmentChip } from "@/components/sales/order-comments";
import { RateCardStage } from "@/components/sales/rate-card/rate-card-stage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FileUploader } from "@/components/ui/file-uploader";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { RoleBadge } from "@/components/ui/role-badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { formData } from "@/lib/api/files";
import {
  useAddRequirementNote,
  useDeleteRequirementNote,
  useLeadInitialNotes,
  useRequirementNotes,
  type LeadDetail,
  type LeadStage,
  type RequirementNote,
} from "@/lib/api/leads";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OnboardingPanel } from "./onboarding-panel";
import { STAGE_META } from "./stage-meta";

/** What still blocks completing the current stage (from the server). */
export function MissingList({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm text-foreground">
      {missing.map((m) => (
        <li key={m} className="flex items-center gap-2">
          <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden /> {m}
        </li>
      ))}
    </ul>
  );
}

function FlagExplain({ type }: { type: "NEW" | "EXISTING" }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3", type === "NEW" ? "border-warning/40 bg-warning-soft/40" : "border-success/40 bg-success-soft/40")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", type === "NEW" ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
        {type === "NEW" ? <Sparkles className="size-4.5" aria-hidden /> : <Repeat className="size-4.5" aria-hidden />}
      </span>
      <div className="text-sm">
        <ClientTypeBadge type={type} full />
        <p className="mt-1 text-muted-foreground">
          {type === "NEW"
            ? "Picked from Client Management. The client cannot be changed once the order is created."
            : "Picked from the Zoho customer list. The client cannot be changed once the order is created."}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------- 1. Create Project -------------------------------- */

/** Stage 1 of a started lead: its order and client, and the initial notes (editable while the lead is open). */
export function NewLeadDone({ detail, canWrite }: { detail: LeadDetail; canWrite: boolean }) {
  const toast = useToast();
  const save = useLeadInitialNotes(detail.order._id);
  const [notes, setNotes] = useState(detail.lead.initialNotes ?? "");
  const open = detail.lead.status === "OPEN";
  const dirty = notes.trim() !== (detail.lead.initialNotes ?? "");
  return (
    <div className="space-y-4">
      <FlagExplain type={detail.order.clientType} />
      <CompanyDetailsCard client={detail.order.client} extras={detail.order.clientType === "NEW"} />
      <ContactsCard contacts={detail.order.client.contacts ?? []} />
      <Card className="space-y-3 p-5">
        <Field label="Initial Notes" htmlFor="lead-notes-edit">
          <Textarea id="lead-notes-edit" maxLength={4000} className="min-h-24" disabled={!canWrite || !open} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="No initial notes" />
        </Field>
        {canWrite && open && (
          <div className="flex justify-end">
            <Button
              variant="brand-outline"
              size="sm"
              disabled={!dirty}
              loading={save.isPending}
              onClick={() => save.mutateAsync(notes.trim()).then(() => toast("Initial notes saved"), (e) => toast(errorMessage(e), "error"))}
            >
              <Save className="size-4" aria-hidden /> Save Notes
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------- 2. Client Registered -------------------------------- */

export function ClientRegisteredPanel({ detail, canWrite }: { detail: LeadDetail; canWrite: boolean }) {
  const c = detail.order.client;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Fill the Customer Onboarding Form (prefilled from Client Management), generate its PDF and email it to the client.</p>
        {canWrite && (
          <Button variant="brand-outline" size="sm" asChild>
            <Link href={`/clients/${c._id}/edit`}>
              <Pencil className="size-4" aria-hidden /> Edit Client Details
            </Link>
          </Button>
        )}
      </div>
      <OnboardingPanel orderId={detail.order._id} canWrite={canWrite} open={detail.lead.status === "OPEN"} />
    </div>
  );
}

/* ------------------------------ 3. Requirement Discussion ------------------------------ */

function NoteItem({ n, orderId, canDelete, onDelete }: { n: RequirementNote; orderId: string; canDelete: boolean; onDelete: () => void }) {
  return (
    <motion.li layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="relative flex gap-3 pb-5 pl-1 last:pb-0">
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-planning text-xs font-bold text-white">{n.createdBy?.name?.slice(0, 2).toUpperCase() ?? "?"}</span>
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{n.createdBy?.name}</span>
          {n.role && <RoleBadge role={n.role} />}
          <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
          {canDelete && (
            <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-danger" aria-label="Delete note" onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden />
            </Button>
          )}
        </div>
        {n.body && <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.body}</p>}
        {n.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {n.attachments.map((a) => (
              <AttachmentChip key={a.fileId} file={a} source={{ orderId }} />
            ))}
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function RequirementPanel({ detail, canWrite }: { detail: LeadDetail; canWrite: boolean }) {
  const id = detail.order._id;
  const toast = useToast();
  const { user } = useAuth();
  const list = useRequirementNotes(id);
  const add = useAddRequirementNote(id);
  const remove = useDeleteRequirementNote(id);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [deleting, setDeleting] = useState<RequirementNote | null>(null);
  const open = detail.lead.status === "OPEN";
  const notes = list.data ?? [];
  const fileCount = notes.reduce((n, x) => n + x.attachments.length, 0);

  const submit = async () => {
    if (!body.trim() && !files.length) return toast("Write the requirement or attach a file", "error");
    try {
      await add.mutateAsync(formData(files, { body: body.trim() }));
      setBody("");
      setFiles([]);
      toast("Requirement note added");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
      {canWrite && open ? (
        <Card className="h-fit space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <MessagesSquare className="size-4 text-planning" aria-hidden /> Add Requirement
          </h3>
          <label htmlFor="req-body" className="sr-only">
            Requirement
          </label>
          <Textarea
            id="req-body"
            maxLength={4000}
            className="min-h-32"
            placeholder="Board sizes, number of shops, locations, materials, timelines, budget..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <FileUploader id="req-files" files={files} onChange={setFiles} multiple compact hint="Documents or reference images, up to 10 files" />
          <div className="flex justify-end">
            <Button variant="brand" onClick={submit} loading={add.isPending}>
              <Send className="size-4" aria-hidden /> Add Note
            </Button>
          </div>
        </Card>
      ) : (
        <span className="hidden lg:block" />
      )}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-primary">Client Requirements</h3>
          <span className="rounded-full bg-planning/15 px-2 py-0.5 text-xs font-semibold text-planning">{notes.length} notes</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{fileCount} files</span>
        </div>
        {list.isPending ? (
          <RowsSkeleton rows={3} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : notes.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="No requirements noted yet" description="Write down what the client needs and attach their documents or reference images." />
        ) : (
          <ol className="relative before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-0.5 before:bg-border">
            <AnimatePresence initial={false}>
              {notes.map((n) => (
                <NoteItem key={n._id} n={n} orderId={id} canDelete={canWrite && open && (n.createdBy?._id === user?.id || user?.role === "SUPER_ADMIN")} onDelete={() => setDeleting(n)} />
              ))}
            </AnimatePresence>
          </ol>
        )}
      </Card>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this requirement note?"
        description={deleting?.attachments.length ? `The note and its ${deleting.attachments.length} file(s) will be permanently deleted.` : "The note will be permanently deleted."}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting._id);
            toast("Note deleted");
            setDeleting(null);
          } catch (e) {
            toast(errorMessage(e), "error");
          }
        }}
      />
    </div>
  );
}

/* ---------------------------------- 4. Rate Card ---------------------------------- */

export function RateCardPanel({ detail }: { detail: LeadDetail }) {
  return <RateCardStage orderId={detail.order._id} />;
}

/* -------------------------- not yet reached / next update -------------------------- */

export function StageInfo({ stage, detail }: { stage: LeadStage; detail: LeadDetail | null }) {
  const m = STAGE_META[stage];
  const s = detail?.stages.find((x) => x.key === stage);
  const items = [...(m.left?.items ?? []), ...(m.right?.items ?? [])];
  const locked = s ? !s.available : false;
  return (
    <div className="mx-auto max-w-xl py-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl text-white" style={{ background: m.color }}>
        {locked ? <LockKeyhole className="size-6" aria-hidden /> : <Clock3 className="size-6" aria-hidden />}
      </span>
      <h3 className="mt-3 text-lg font-semibold text-primary">{m.label}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {s?.status === "SKIPPED"
          ? "Skipped: this client is already registered."
          : locked
            ? "This stage opens in the next Lead Management update."
            : "This stage opens when the stages before it are completed."}
      </p>
      <ul className="mx-auto mt-4 grid max-w-md gap-1.5 text-left text-sm">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <CheckCircle2 className="size-4 shrink-0" style={{ color: m.color }} aria-hidden /> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Client Servicing handover ------------------------------ */

/** Project Assign > Assign to Client Servicing. `onAssigned` runs once the order is handed over (the lead is then completed). */
export function HandoverPanel({ detail, onAssigned, focus }: { detail: LeadDetail; onAssigned?: () => void; focus?: string | null }) {
  if (detail.recce.assignee)
    return <EmptyState icon={LockKeyhole} title="Not needed" description={`This project is assigned to the Recce team (${detail.recce.assignee.name}).`} />;
  if (!detail.handover.unlocked && !detail.handover.assignee)
    return <EmptyState icon={LockKeyhole} title="Opens at Project Assign" description="Client Servicing can be assigned once the lead is at Project Assign." />;
  return (
    <div className="space-y-3">
      <HandoverTab order={detail.order} onAssigned={onAssigned} focus={focus} />
      <Link href={`/orders/${detail.order._id}`} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-brand">
        <ExternalLink className="size-3.5" aria-hidden /> Open the order in Order Management
      </Link>
    </div>
  );
}
