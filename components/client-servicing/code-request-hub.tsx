"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, Check, ChevronDown, FolderKanban, History, Mail, SquareArrowOutUpRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CodeStatusBadge } from "@/components/client-servicing/code-parts";
import { CodeMailComposer, type SendMode } from "@/components/client-servicing/code-mail-composer";
import { REQUIRED_DOCS, ViewMailModal } from "@/components/client-servicing/code-mail-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { CODE_LABEL, useAlreadySent, useCodeHistory, useCodes, type CodeKind, type CodesOverview, type KindState } from "@/lib/api/codeRequests";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const KINDS: CodeKind[] = ["CLIENT_CODE", "PROJECT_CODE"];

/** Status chip of the reference screen: "Not Requested" in red until a request exists. */
const CHIP: Record<KindState, { label: string; cls: string }> = {
  NOT_REQUESTED: { label: "Not Requested", cls: "bg-[#ffe8e8] text-loss" },
  DRAFT: { label: "Draft Saved", cls: "bg-muted text-muted-foreground" },
  PENDING: { label: "Pending Confirmation", cls: "bg-[#fff0e0] text-approval" },
  BD_SENT: { label: "Requested by BD", cls: "bg-[#e8f0ff] text-royal" },
  CONFIRMED: { label: "Confirmed", cls: "bg-[#e2f8ea] text-finance" },
  FAILED: { label: "Email Failed", cls: "bg-[#ffe8e8] text-loss" },
};

const SKIN: Record<CodeKind, { card: string; icon: string; Icon: typeof Building2; sub: string; ring: string }> = {
  CLIENT_CODE: { card: "from-[#e2f8ea] to-white border-[#bdebcc]", icon: "bg-finance", Icon: Building2, sub: "For new client registration", ring: "accent-[var(--color-finance)]" },
  PROJECT_CODE: { card: "from-[#f1e6ff] to-white border-[#ddc4fb]", icon: "bg-vendor", Icon: FolderKanban, sub: "For new project creation", ring: "accent-[var(--color-vendor)]" },
};

/**
 * Code Request Hub (reference screen 05): pick the client code and/or project code, tick the documents that go with
 * each, then send together in one mail, send separately, or record that it was already sent. The composer follows.
 */
export function CodeRequestHub() {
  const { orderId } = useParams<{ orderId: string }>();
  const q = useCodes(orderId);
  const history = useCodeHistory(orderId);
  const reduce = useReducedMotion();
  const [mailOpen, setMailOpen] = useState(false);
  const [run, setRun] = useState(0);
  const center = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<CodeKind[] | null>(null);
  const [mode, setMode] = useState<SendMode>("COMBINED");
  const [ticked, setTicked] = useState<Record<CodeKind, string[]>>({ CLIENT_CODE: [], PROJECT_CODE: [] });
  const [skipping, setSkipping] = useState(false);
  const [mailOf, setMailOf] = useState<CodeKind | null>(null);

  if (q.isPending)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const open = KINDS.filter((k) => d.kinds[k].canRequest);
  const sel = (picked ?? open).filter((k) => open.includes(k));
  const toggle = (k: CodeKind) => setPicked(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);
  /** Opens the Mail Center on this same page, set up for one combined mail or separate mails. */
  const go = (m: SendMode) => {
    setMode(m);
    setMailOpen(true);
    setRun((n) => n + 1);
    requestAnimationFrame(() => center.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };
  const mailKind = mailOf ? d.kinds[mailOf] : null;
  const mailRow = mailOf ? d.requests.find((r) => r.kind === mailOf && r.mail) : undefined;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/client-servicing/codes">
          <ArrowLeft className="size-4" aria-hidden /> Back to Code Requests
        </Link>
      </Button>
      <PageHeader
        icon={Mail}
        title="Request Client Code and/or Project Code"
        subtitle={open.length ? "Select the codes to be requested and proceed to send email." : "Every code is already requested or confirmed for this order."}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/client-servicing/codes/${orderId}/confirm`}>
              <BadgeCheck className="size-4" aria-hidden /> Code Confirmation
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {KINDS.map((kind) => {
          const k = d.kinds[kind];
          const s = SKIN[kind];
          const on = sel.includes(kind);
          return (
            <Card key={kind} className={cn("bg-gradient-to-br p-5 transition-shadow", s.card, on && "shadow-card ring-2 ring-royal/40", !k.canRequest && "opacity-95")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-soft", s.icon)}>
                  <s.Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-primary">{CODE_LABEL[kind]} Request</h2>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
                {k.canRequest && <input type="checkbox" aria-label={`Request ${CODE_LABEL[kind]}`} className={cn("size-5", s.ring)} checked={on} onChange={() => toggle(kind)} />}
              </div>

              <dl className="mt-4 grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2 text-sm">
                {kind === "CLIENT_CODE" ? (
                  <>
                    <dt className="text-muted-foreground">Client Name</dt>
                    <dd className="font-medium">{d.client.name}</dd>
                    <dt className="text-muted-foreground">GST Number</dt>
                    <dd className="font-mono text-xs font-medium">{d.client.gstin ?? "-"}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-muted-foreground">Order No</dt>
                    <dd className="font-mono text-xs font-semibold">{d.order.orderNo}</dd>
                    <dt className="text-muted-foreground">Client</dt>
                    <dd className="font-medium">{d.client.name}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", CHIP[k.state].cls)}>{CHIP[k.state].label}</span>
                  {k.code && <span className="ml-2 font-mono text-xs font-semibold text-finance">{k.code}</span>}
                </dd>
              </dl>

              {k.canRequest ? (
                <fieldset className="mt-4">
                  <legend className="mb-1.5 text-sm font-semibold text-primary">Required Documents</legend>
                  <div className="space-y-1.5">
                    {REQUIRED_DOCS[kind].map((doc) => (
                      <label key={doc} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className={cn("size-4", s.ring)}
                          checked={ticked[kind].includes(doc)}
                          onChange={() => setTicked((t) => ({ ...t, [kind]: t[kind].includes(doc) ? t[kind].filter((x) => x !== doc) : [...t[kind], doc] }))}
                        />
                        {doc}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <div className="mt-4 space-y-2 text-sm">
                  {k.state === "BD_SENT" && <p className="text-muted-foreground">The BD team already emailed this request{k.bdMail?.sentAt ? ` on ${formatDateTime(k.bdMail.sentAt)}` : ""}.</p>}
                  {k.state === "PENDING" && <p className="text-muted-foreground">Request sent. Waiting for the code to come back.</p>}
                  {k.state === "CONFIRMED" && <p className="text-muted-foreground">Nothing more to request.</p>}
                  {(k.bdMail || d.requests.some((r) => r.kind === kind && r.mail)) && (
                    <Button size="sm" variant="outline" onClick={() => setMailOf(kind)}>
                      <SquareArrowOutUpRight className="size-4" aria-hidden /> View Mail
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {open.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" className="min-w-56 bg-royal text-white hover:bg-royal/90" disabled={sel.length === 0} onClick={() => go("COMBINED")}>
            <Mail className="size-4" aria-hidden /> Send Together (Single Mail)
          </Button>
          <Button size="lg" variant="outline" className="min-w-44" disabled={sel.length < 2} onClick={() => go("SEPARATE")}>
            Send Separately
          </Button>
          <Button size="lg" className="min-w-44 bg-approval text-white hover:bg-approval/90" disabled={sel.length === 0} onClick={() => setSkipping(true)}>
            <Check className="size-4" aria-hidden /> Skip Already Sent
          </Button>
          {sel.length < 2 && open.length === 2 && <span className="text-xs text-muted-foreground">Tick both codes to send them together or separately.</span>}
        </div>
      )}

      <Card ref={center} className="overflow-hidden scroll-mt-4">
        <button type="button" aria-expanded={mailOpen} aria-controls="mail-center" onClick={() => setMailOpen(!mailOpen)} className="flex w-full items-center gap-3 bg-gradient-to-r from-navy via-[#173a8a] to-royal px-5 py-4 text-left text-white">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
            <Mail className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">Mail Center – Client Code &amp; Project Code{sel.length === 2 ? (mode === "SEPARATE" ? " (Separate Mails)" : " (Single Mail)") : ""}</span>
            <span className="block text-xs text-white/75">{open.length ? "Write, send and track the code request emails here." : "Mail history for this order."}</span>
          </span>
          <ChevronDown className={cn("size-5 transition-transform", mailOpen && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {mailOpen && (
            <motion.div id="mail-center" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
              <CodeMailComposer key={`${run}-${mode}-${sel.join()}`} data={d} initialKinds={sel} initialMode={mode} enclosed={ticked} onDone={() => (setMailOpen(false), setPicked(null))} history={<MailHistory d={d} />} />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <GradientHeader title="Activity" />
          {history.isPending ? (
            <Skeleton className="m-4 h-24" />
          ) : (history.data ?? []).length === 0 ? (
            <EmptyState icon={History} title="No activity yet" />
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-auto">
              {history.data!.map((h) => (
                <li key={h.id} className="px-4 py-2.5 text-xs">
                  <p className="text-foreground">{h.reason}</p>
                  <p className="text-muted-foreground">
                    {h.by ?? "System"} · {formatDateTime(h.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SkipDialog open={skipping} kinds={sel} orderId={orderId} onClose={() => setSkipping(false)} onDone={() => (setSkipping(false), setPicked(null))} />
      <ViewMailModal mail={mailKind?.bdMail && !mailRow ? { ...mailKind.bdMail, status: mailKind.bdMail.status as "SENT" } : (mailRow?.mail ?? null)} onClose={() => setMailOf(null)} />
    </div>
  );
}

function MailHistory({ d }: { d: CodesOverview }) {
  const rows = d.requests.filter((r) => r.status !== "DRAFT");
  return (
    <div>
      {rows.length === 0 ? (
        <EmptyState icon={Mail} title="No requests yet" description="Sent requests and their status appear here." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r._id} className="space-y-1 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{CODE_LABEL[r.kind]}</span>
                <CodeStatusBadge status={r.status} />
                {r.mode === "COMBINED" && <Badge tone="info">Combined email</Badge>}
                {r.mode === "MANUAL" && <Badge tone="neutral">Marked as already sent</Badge>}
                {r.source === "BD" && <Badge tone="info">From BD mail</Badge>}
                {r.confirmedCode && <span className="font-mono text-xs font-semibold">{r.confirmedCode}</span>}
              </div>
              {r.mail && (
                <p className="text-xs text-muted-foreground">
                  {r.mail.subject} · To {r.mail.to.join(", ")} · {formatDateTime(r.mail.sentAt)}
                  {r.mail.attachments.length > 0 && ` · ${r.mail.attachments.map((a) => a.name).join(", ")}`}
                </p>
              )}
              {r.mode === "MANUAL" && r.evidenceNote && <p className="text-xs text-muted-foreground">{r.evidenceNote}</p>}
              {r.mailStatus === "SKIPPED" && <p className="text-xs text-warning">Recorded only: email is not configured on the server.</p>}
              {r.mailError && r.status === "FAILED" && <p className="text-xs text-danger">{r.mailError}</p>}
              {r.rejectedReason && <p className="text-xs text-danger">Rejected: {r.rejectedReason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Skip Already Sent": the request went out outside the CRM, so no email is sent; the code is simply awaited. */
function SkipDialog({ open, kinds, orderId, onClose, onDone }: { open: boolean; kinds: CodeKind[]; orderId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const mark = useAlreadySent(orderId);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    if (note.trim().length < 3) return setError("Say where and when it was sent");
    try {
      await mark.mutateAsync({ kinds, note: note.trim() });
      toast("Recorded as already sent. Waiting for confirmation.");
      setNote("");
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Skip: already sent"
      description={`No email will be sent. ${kinds.map((k) => CODE_LABEL[k]).join(" and ")} will wait for confirmation.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-approval text-white hover:bg-approval/90" loading={mark.isPending} onClick={submit}>
            Record as Sent
          </Button>
        </>
      }
    >
      <Field label="Where and when was it sent?" htmlFor="skip-note" required error={error} hint="For example: emailed to accounts on 28 Oct, or phoned the team.">
        <Textarea id="skip-note" autoFocus className="min-h-20" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
