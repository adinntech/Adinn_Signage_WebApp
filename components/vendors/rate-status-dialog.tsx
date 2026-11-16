"use client";

import { useState } from "react";
import { CalendarDays, Car, Check, CheckCircle2, Clock, Info, LineChart, Mail, PauseCircle, Reply, Store, User, X, XCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GetReplyButton } from "@/components/mail/get-reply-button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useChangeRateStatus, useCostHistory, type RateApproval } from "@/lib/api/vendors";
import { RateAnalysisDialog } from "./rate-analysis-dialog";
import { cn } from "@/lib/utils";

const money = (n: number | null) => (n == null ? "–" : `₹${n}`);
export const APPROVAL_LABEL: Record<string, string> = { PENDING: "Waiting for approval", APPROVED: "Approved", NOT_APPROVED: "Not approved" };
const BANNER: Record<string, string> = { PENDING: "bg-[#fff6ea]", APPROVED: "bg-[#e9f9ef]", NOT_APPROVED: "bg-[#fdf0f0]" };
const TONE: Record<string, string> = { PENDING: "text-approval", APPROVED: "text-finance", NOT_APPROVED: "text-loss" };

/** The status of a vendor amount request, in the Vendors with cost list. */
export function ApprovalTag({ a }: { a: RateApproval }) {
  const full =
    a.status === "PENDING" ? `Requested ${money(a.ratePerShop)}${a.farRatePerShop != null ? ` / ${money(a.farRatePerShop)}` : ""}`
    : a.status === "NOT_APPROVED" ? `Company rate applied ${money(a.appliedRate)}${a.appliedFar != null ? ` / ${money(a.appliedFar)}` : ""}`
    : `Applied ${money(a.appliedRate)}${a.appliedFar != null ? ` / ${money(a.appliedFar)}` : ""}`;
  return (
    <span className={cn("mt-1 inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", { PENDING: "bg-[#fff0e0] text-approval", APPROVED: "bg-[#e2f8ea] text-finance", NOT_APPROVED: "bg-[#fdecec] text-loss" }[a.status] ?? "bg-muted text-muted-foreground")} title={`${full}. Company rate ${money(a.limitRate)} / travelling cost ${money(a.limitFar)}. Request ${a.requestId}${a.decidedBy ? `. By ${a.decidedBy}` : ""}`}>
      {APPROVAL_LABEL[a.status] ?? a.status}
    </span>
  );
}

/** One comparison row: current (company) amount beside the requested one, with a change chip. */
function CostRow({ icon: Icon, label, current, requested }: { icon: LucideIcon; label: string; current: number | null; requested: number | null }) {
  const diff = current != null && requested != null ? requested - current : null;
  const box = (title: string, v: number | null, cls: string) => (
    <div className="min-w-0 flex-1 rounded-lg bg-[#eef3ff] px-2.5 py-1"><p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{title}</p><p className={cn("text-sm font-bold leading-tight tabular-nums sm:text-base lg:text-lg", cls)}>{money(v)}</p></div>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-white px-3 py-2" role="group" aria-label={`${label}: current ${money(current)}, requested ${money(requested)}`}>
      <div className="flex min-w-[8rem] items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#e8f0ff] text-royal sm:size-9"><Icon className="size-4 sm:size-[18px]" aria-hidden /></span><span className="text-sm font-semibold text-navy">{label}</span></div>
      <div className="flex min-w-[12rem] flex-1 items-center gap-2">
        {box("Current", current, "text-navy")}
        {box("Requested", requested, "text-royal")}
      </div>
      {diff != null && diff > 0 ? <span className="whitespace-nowrap rounded-lg bg-[#fff0e0] px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-approval">+₹{diff} vs current</span>
        : diff != null && diff < 0 ? <span className="whitespace-nowrap rounded-lg bg-[#e2f8ea] px-2 py-0.5 text-[11px] font-semibold text-finance sm:text-xs">−₹{Math.abs(diff)} vs current</span>
        : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-[#e2f8ea] px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-finance"><Check className="size-3.5" aria-hidden />No change</span>}
    </div>
  );
}

/** What a reply did, from the outcome note: it decided (green / red), was only a hold or a question (amber, still waiting), or changed nothing (grey). */
function outcomeTone(outcome: string | undefined): { label: string; cls: string; icon: LucideIcon } {
  const o = outcome ?? "Reply read";
  const decided = /(?:Decided: |changed (?:from \w+ )?to |to )(APPROVED|NOT_APPROVED)/i.exec(o)?.[1]?.toUpperCase();
  if (decided === "APPROVED") return { label: o, cls: "bg-[#e2f8ea] text-finance", icon: CheckCircle2 };
  if (decided === "NOT_APPROVED") return { label: o, cls: "bg-[#fdecec] text-loss", icon: XCircle };
  if (/hold|wait|not clear|question|check the mail/i.test(o)) return { label: o, cls: "bg-[#fff0e0] text-approval", icon: PauseCircle };
  return { label: o, cls: "bg-secondary text-muted-foreground", icon: Info };
}

/** Every reply read for the amount request, newest mail first. */
function ReplyList({ replies, current }: { replies: (RateApproval["history"][number] & { requestId?: string })[]; current: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <h3 className="flex items-center gap-2 bg-[#e8eefb] px-3 py-2.5 text-base font-bold text-navy"><Reply className="size-5 text-royal" aria-hidden />Approver replies ({replies.length})</h3>
      {replies.length ? (
        <ul className="max-h-56 space-y-2 overflow-y-auto p-3 text-xs">
          {replies.map((h, i) => (
            <li key={i} className="space-y-1.5 rounded-xl border border-border p-3">
              <span className="flex flex-wrap items-center gap-2">{(() => { const t = outcomeTone(h.outcome); return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold", t.cls)}><t.icon className="size-3.5" aria-hidden />{t.label}</span>; })()}{i === 0 && <span className="rounded-full bg-royal px-2 py-0.5 text-[10px] font-bold text-white">Newest</span>}{h.requestId && <span className={cn("ml-auto font-mono text-[10px]", h.requestId === current ? "text-royal" : "text-muted-foreground")} title={h.requestId === current ? "This request" : "An earlier request of this vendor"}>{h.requestId}</span>}</span>
              <span className="flex flex-wrap items-center gap-x-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><User className="size-3.5" aria-hidden />{h.from ?? ""}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{formatDateTime(h.receivedAt ?? h.at)}</span></span>
              {h.snippet && <span className="block rounded-md border-l-4 border-royal bg-secondary/60 px-3 py-1.5 italic text-navy" title={h.snippet}>&ldquo;{h.snippet}&rdquo;</span>}
            </li>
          ))}
        </ul>
      ) : <p className="px-3 py-3 text-xs text-muted-foreground">No reply read yet.</p>}
    </section>
  );
}

const REASONS = ["Amount is too high", "Management did not agree", "Reply was read wrongly"];

/**
 * Status of a vendor amount request. Approval only comes from the approver's reply (Get reply), so there is no Approved button.
 * Once a reply has been read, Operations can mark it Not approved (the company rate is applied) with a short reason.
 */
export function RateStatusDialog({ name, contactId, approval: listed, onClose }: { name: string; contactId: string; approval: RateApproval; onClose: () => void }) {
  const toast = useToast();
  const change = useChangeRateStatus();
  // Read live: Get reply refreshes it, and it is read again every 15 seconds, so the status, the replies and the chart update here without closing or reloading.
  const live = useCostHistory(contactId, true, 15000);
  const approval = live.data?.approval?.requestId === listed.requestId ? live.data.approval : listed;
  const [analysing, setAnalysing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // Newest first by the time the mail was received (never by the order it was read): the newest reply is the one that counts.
  const history = [...approval.history].sort((a, b) => new Date(b.receivedAt ?? b.at ?? 0).getTime() - new Date(a.receivedAt ?? a.at ?? 0).getTime());
  // Every reply read for any request of this vendor (older requests too), newest mail first; before the live data arrives, this request's own replies.
  const allReplies = live.data?.replies ?? history;
  const replyRead = history.length > 0;
  const canReject = replyRead && approval.status !== "NOT_APPROVED";
  const reject = () =>
    change.mutate({ requestId: approval.requestId, decision: "NOT_APPROVED", ...(reason.trim() ? { reason: reason.trim() } : {}) }, { onSuccess: () => { toast(`${name}: not approved, the current amount stays`); onClose(); }, onError: (e) => toast(errorMessage(e), "error") });
  return (
    <>
    <Modal
      open
      persistent
      onOpenChange={(o) => !o && onClose()}
      title="Amount Approval Status"
      description={`${name} · ${approval.requestId}`}
      className="max-w-xl"
      headerAction={<Button variant="outline" size="sm" className="border-royal/40 text-royal" onClick={() => setAnalysing(true)}><LineChart className="size-4" aria-hidden /> Rate History &amp; Analysis</Button>}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <GetReplyButton showLast />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {canReject && !rejecting && <Button variant="outline" className="border-loss/40 text-loss" onClick={() => setRejecting(true)}><X className="size-4" aria-hidden /> Mark as not approved</Button>}
            {rejecting && <Button className="bg-loss hover:bg-loss/90" loading={change.isPending} onClick={reject}><X className="size-4" aria-hidden /> Confirm not approved</Button>}
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-2.5", BANNER[approval.status] ?? "bg-secondary")}>
          <span className={cn("inline-flex items-center gap-2 text-lg font-bold", TONE[approval.status])}>{approval.status === "APPROVED" ? <CheckCircle2 className="size-6" aria-hidden /> : approval.status === "NOT_APPROVED" ? <XCircle className="size-6" aria-hidden /> : <Clock className="size-6" aria-hidden />}{APPROVAL_LABEL[approval.status] ?? approval.status}</span>
          {approval.decidedAt && <span className="inline-flex items-center gap-1.5 text-xs text-navy"><CalendarDays className="size-4 text-muted-foreground" aria-hidden />{formatDateTime(approval.decidedAt)}</span>}
          {approval.decidedBy && <span className="inline-flex items-center gap-1.5 text-xs text-navy"><Mail className="size-4 text-muted-foreground" aria-hidden />{approval.decidedBy}</span>}
        </div>
        <CostRow icon={Store} label="Price per shop" current={approval.limitRate} requested={approval.ratePerShop} />
        <CostRow icon={Car} label="Travelling cost" current={approval.limitFar} requested={approval.farRatePerShop} />
        {approval.status === "PENDING" && !replyRead && <p className="text-xs text-muted-foreground">Waiting for the approver. Press Get reply after the reply is sent; the approved amount is applied from the reply.</p>}
        {rejecting && (
          <div className="rounded-xl border border-border p-3">
            <p className="mb-1.5 text-xs font-semibold text-navy">Reason (optional)</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-2.5 py-1 text-xs", reason === r ? "border-royal bg-[#e8f0ff] text-royal" : "border-border text-muted-foreground hover:bg-secondary")}>{r}</button>)}
            </div>
            <Input aria-label="Reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a short reason" />
          </div>
        )}
        <ReplyList replies={allReplies} current={approval.requestId} />
        {replyRead && <p className="flex items-center gap-2 rounded-xl bg-[#e8eefb] px-3 py-2 text-xs text-navy" data-testid="newest-reply"><Info className="size-4 shrink-0 text-royal" aria-hidden />This decision was captured from a system-tracked email reply.</p>}
      </div>
    </Modal>
    {analysing && <RateAnalysisDialog name={name} history={live.data} loading={live.isPending} onClose={() => setAnalysing(false)} />}
    </>
  );
}
