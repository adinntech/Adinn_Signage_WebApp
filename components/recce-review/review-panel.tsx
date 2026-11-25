"use client";
import { useState } from "react";
import { Check, ClipboardCheck, Lock, RotateCcw, Send, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChangeDecision, useDecide, useMarks, useOverride, useReopen, useSendBack, type DecisionInput, type MarkTarget, type WsMark, type WsReview, type Workspace } from "@/lib/api/recceReview";
import { markName, myProblems } from "./board-review";
import { DecisionBadge, STAGE_LABEL, fmtDate } from "./common";
import { ResubmittedCard } from "./resubmitted";

/**
 * The right-hand column of the review workspace: both teams' status, the checklist, and the decision buttons.
 *
 * The checklist works on SELECTED items, and every selected item has its OWN remark (never one overall remark):
 *  - "Select all" ticks every item at once, and Approve is open only when every item is selected.
 *  - Rework / Reject act on the selected items only. A remark box opens under each selected item. Rework and Reject are the same work for the
 *    recce person (each item is sent back to its section on the phone with its own remark and its own Rework / Rejected tag); only the word differs.
 *  - "Reject the whole shop" is the one overall rejection (an overall reason, no item needed).
 *  - After a decision the checklist stays on screen but locked (the items that were sent back are marked, with their remarks) until the recce person
 *    submits the next version; that version opens a fresh checklist.
 */

type Mode = null | "MARK" | "ADDITIONAL" | "SHOP_REJECT";
type MarkAs = "REWORK" | "REJECTED";
const MIN_ITEM_REMARK = 3;
const MIN_REMARK = 5;
const MAX_ITEM_REMARK = 500;
const MAX_REMARK = 2000;
const WORD: Record<string, string> = { REJECTED: "Rejected", REWORK: "Rework" };

export function ReviewPanel({ w, cur }: { w: Workspace; cur: number }) {
  const decide = useDecide(w.id);
  const changeDecision = useChangeDecision(w.id);
  const sendBack = useSendBack(w.id);
  const marker = useMarks(w.id);
  const toast = useToast();
  const stage = w.me.stage;
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>(null);
  const [markAs, setMarkAs] = useState<MarkAs>("REWORK");
  const [comment, setComment] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const version = w.versions.find((v) => v.version === cur);
  const myReview = stage ? version?.reviews.find((r) => r.stage === stage) : undefined;
  const readOnly = cur !== w.currentVersion;
  const can = w.me.canDecide && !readOnly && !!stage;
  // My stage already approved this version: it may still change to Rework / More photos / Reject, with a reason (both reviewer logins).
  const canChange = w.me.canChange && !readOnly && !!stage && !can;
  const acting = can || canChange;
  const pending = decide.isPending || changeDecision.isPending || sendBack.isPending;
  const run = canChange ? changeDecision : decide;

  const items = w.checklist;
  const selected = items.filter((c) => checks[c.key]);
  const allSelected = items.length > 0 && selected.length === items.length;
  // What my stage marked Rejected / Rework (photos, board details, checklist items) and has not sent yet. The server turns each into a rework item with its remark.
  const problems = readOnly ? [] : myProblems(w, cur);
  const hasTargets = selected.length > 0 || problems.length > 0;
  const remarkOf = (key: string) => (remarks[key] ?? "").trim();
  const itemsOk = selected.every((c) => remarkOf(c.key).length >= MIN_ITEM_REMARK);

  const done = (msg: string) => { toast(msg); setMode(null); setComment(""); setCats([]); setChecks({}); setRemarks({}); };
  const fail = (e: unknown) => toast(errorMessage(e), "error");

  const approve = () => {
    if (!stage || !can || !allSelected || problems.length > 0) return;
    decide.mutate({ stage, decision: "APPROVE", versionNo: w.currentVersion, comment: "", checklist: items.map((c) => ({ key: c.key, passed: true })), items: [] }, { onSuccess: () => done("Approved"), onError: fail });
  };
  /** Marks the selected items (each with its own remark) as Rework or Rejected and sends them, with everything else marked, to the recce person. */
  const sendBackNow = () => {
    if (!stage) return;
    const summary = [...selected.map((c) => `${c.label}: ${remarkOf(c.key)}`), ...problems.map((m) => `${markName(w, m)}${m.reason ? `: ${m.reason}` : ""}`)].join("; ").slice(0, MAX_REMARK);
    const marks = selected.length ? { stage, versionNo: w.currentVersion, decision: markAs, reason: "", targets: selected.map((c): MarkTarget => ({ kind: "CHECK", key: c.key, reason: remarkOf(c.key) })) } : null;
    sendBack.mutate({ marks, decision: { stage, decision: "REWORK", versionNo: w.currentVersion, comment: summary, checklist: [], items: [] }, change: canChange }, { onSuccess: () => done(canChange ? "Decision changed" : "Sent back to the recce person"), onError: fail });
  };
  const sendItems = () => { if (mode === "MARK") sendBackNow(); };
  const sendOther = () => {
    if (!stage || (mode !== "ADDITIONAL" && mode !== "SHOP_REJECT")) return;
    const text = comment.trim();
    if (mode === "SHOP_REJECT") {
      run.mutate({ stage, decision: "REJECT", versionNo: w.currentVersion, comment: text, reason: text, checklist: [], items: [] }, { onSuccess: () => done(canChange ? "Decision changed" : "Shop rejected"), onError: fail });
      return;
    }
    const extra: DecisionInput["items"] = cats.map((c) => ({ type: "ADDITIONAL_PHOTO", category: c, mediaKey: w.mediaItems[0]?.key }));
    run.mutate({ stage, decision: "ADDITIONAL", versionNo: w.currentVersion, comment: text, checklist: [], items: extra }, { onSuccess: () => done(canChange ? "Decision changed" : "Decision saved"), onError: fail });
  };
  const unmark = (m: WsMark) => {
    if (!stage) return;
    const target: MarkTarget = m.kind === "PHOTO" ? { kind: "PHOTO", photo: m.photo as string } : m.kind === "CHECK" ? { kind: "CHECK", key: m.check as string } : { kind: "BOARD", mediaKey: m.mediaKey, field: m.field as NonNullable<WsMark["field"]> };
    marker.mutate({ stage, versionNo: w.currentVersion, decision: "APPROVED", reason: "", targets: [target] }, { onSuccess: () => toast("Marked approved"), onError: fail });
  };

  const valid = mode === "MARK" ? hasTargets && itemsOk
    : mode === "SHOP_REJECT" ? comment.trim().length >= MIN_REMARK
    : mode === "ADDITIONAL" ? cats.length > 0 && (!canChange || comment.trim().length >= MIN_REMARK)
    : false;

  return (
    <div className="flex flex-col gap-3">
      <StatusCard w={w} cur={cur} />

      <ResubmittedCard w={w} cur={cur} />

      {stage && (acting || (myReview && ["APPROVED", "REJECTED", "REWORK"].includes(myReview.decision))) && (
        <ChecklistCard
          w={w}
          cur={cur}
          checks={checks}
          onChange={setChecks}
          locked={!acting}
          review={myReview}
          changing={canChange}
          disabled={pending}
          marking={mode === "MARK"}
          markAs={markAs}
          onMarkAs={setMarkAs}
          remarks={remarks}
          onRemark={(key, text) => setRemarks((r) => ({ ...r, [key]: text }))}
        />
      )}

      {acting && problems.length > 0 && (
        <Card className="flex flex-col gap-2 border-danger/40 p-3 text-sm" data-testid="marked-items">
          <p className="text-xs font-medium uppercase tracking-wide text-danger">Already marked ({problems.length})</p>
          <ul className="flex flex-col gap-2">
            {problems.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-x-2 gap-y-1">
                <Badge tone={m.decision === "REJECTED" ? "danger" : "warning"}>{WORD[m.decision]}</Badge>
                <span className="min-w-0 flex-1 basis-40"><span className="block truncate font-medium" title={markName(w, m)}>{markName(w, m)}</span><span className="block text-xs text-muted-foreground">{m.reason}</span></span>
                <Button size="sm" variant="ghost" disabled={marker.isPending} aria-label={`Approve ${markName(w, m)} instead`} onClick={() => unmark(m)}>Approve instead</Button>
              </li>
            ))}
          </ul>
          <p className="rounded-md bg-warning-soft px-2 py-1 text-xs font-medium text-warning">Not sent yet. The recce person sees these only after you send them back.</p>
          {!mode && selected.length === 0 && (
            <Button size="sm" disabled={pending || marker.isPending} loading={sendBack.isPending} onClick={sendBackNow} data-testid="send-marked-back">
              <Send className="size-4" aria-hidden /> Send back {problems.length} item{problems.length === 1 ? "" : "s"} now
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Each goes to the recce person with its own remark.</p>
        </Card>
      )}

      {acting && mode === "SHOP_REJECT" && (
        <Card className="flex flex-col gap-2 border-danger/50 p-3 text-sm" data-testid="reject-shop-form">
          <label>
            <span className="font-medium">{canChange ? "Change your decision to " : ""}Reject the whole shop <span className="text-danger" aria-hidden>*</span></span>
            <Textarea className="mt-1" rows={3} autoFocus maxLength={MAX_REMARK} value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={comment.length > 0 && comment.trim().length < MIN_REMARK}
              placeholder="Why is the whole shop rejected? e.g. This is not the shop in the order." />
            <span className="mt-0.5 flex justify-between text-xs text-muted-foreground"><span>The overall reason. To send single items back, use Rework or Reject on the selected items instead.</span><span>{comment.length} / {MAX_REMARK}</span></span>
          </label>
        </Card>
      )}

      {acting && mode === "ADDITIONAL" && (
        <Card className="flex flex-col gap-3 p-3 text-sm" data-testid="more-photos-form">
          <fieldset>
            <legend className="font-medium">Extra photos needed <span className="text-danger" aria-hidden>*</span></legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {w.categories.map((c) => (
                <label key={c.key} className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs focus-within:outline-2 focus-within:outline-ring", cats.includes(c.key) ? "border-primary bg-secondary" : "border-border")}>
                  <input type="checkbox" className="sr-only" checked={cats.includes(c.key)} onChange={() => setCats((s) => (s.includes(c.key) ? s.filter((x) => x !== c.key) : [...s, c.key]))} />{c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className="font-medium">{canChange ? `Reason for changing your decision (min ${MIN_REMARK} characters)` : "Note for the recce person (optional)"}</span>
            <Textarea className="mt-1" rows={2} maxLength={MAX_REMARK} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
        </Card>
      )}

      {acting ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t border-border bg-background/95 px-1 py-2.5 backdrop-blur">
          {mode ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={!valid || pending} loading={pending} onClick={mode === "MARK" ? sendItems : sendOther} variant={mode === "SHOP_REJECT" || (mode === "MARK" && markAs === "REJECTED") ? "destructive" : "default"}>
                <Send className="size-4" aria-hidden />
                {mode === "MARK" ? ` ${markAs === "REJECTED" ? "Reject" : "Rework"} ${selected.length + problems.length} item${selected.length + problems.length === 1 ? "" : "s"}` : mode === "SHOP_REJECT" ? " Confirm: reject the shop" : " Confirm request"}
              </Button>
              <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
              {mode === "MARK" && !itemsOk && <p className="basis-full text-xs text-danger" role="status">Write a remark (at least {MIN_ITEM_REMARK} characters) for every selected item.</p>}
            </div>
          ) : (
            <>
              {!canChange && (
                <Button className="w-full" disabled={!allSelected || problems.length > 0 || pending} loading={pending} onClick={approve} title={!allSelected ? "Select every checklist item first (Select all)" : problems.length > 0 ? "Approve the marked items again, or send them back, first" : undefined}>
                  <Check className="size-4" aria-hidden /> Approve{allSelected ? "" : ` (${selected.length}/${items.length} selected)`}
                </Button>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="px-2" disabled={!hasTargets} title={hasTargets ? "Send the selected items back to the recce person, each with its own remark" : "Select the checklist items to send back first"} onClick={() => { setMarkAs("REWORK"); setMode("MARK"); }}><RotateCcw className="size-4" aria-hidden /> Rework</Button>
                <Button variant="outline" className="border-danger px-2 text-danger hover:bg-danger-soft" disabled={!hasTargets} title={hasTargets ? "Reject the selected items: the recce person fixes them, each with its own remark" : "Select the checklist items to reject first"} onClick={() => { setMarkAs("REJECTED"); setMode("MARK"); }}><ShieldX className="size-4" aria-hidden /> Reject</Button>
                <Button variant="outline" className="px-2" onClick={() => setMode("ADDITIONAL")}>More photos</Button>
              </div>
              <button type="button" className="self-start text-xs font-medium text-danger underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setMode("SHOP_REJECT")}>Reject the whole shop…</button>
            </>
          )}
        </div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {readOnly ? "You are looking at an older version. Switch to the current version to decide." : w.me.stage && w.me.openStage && w.me.openStage !== w.me.stage ? `${STAGE_LABEL[w.me.openStage]} has not decided yet. Your decision is already saved.` : w.status === "REWORK_REQUIRED" ? "Waiting for the recce person to resubmit. The checklist opens again with the next version." : w.me.stage ? "Nothing for you to decide right now." : "You can view this submission. Decisions are made by the review teams."}
        </p>
      )}

      <AdminTools w={w} />
    </div>
  );
}

/** Both teams' answers for the version. The other team's answer is shown with what it rejected and why, and it refreshes by itself (live notification + polling). */
function StatusCard({ w, cur }: { w: Workspace; cur: number }) {
  const stage = w.me.stage;
  const version = w.versions.find((v) => v.version === cur);
  const canChange = w.me.canChange && cur === w.currentVersion;
  return (
    <Card className="p-3 text-sm" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review status · version {cur}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {(version?.reviews ?? []).map((r) => {
          const own = r.stage === stage;
          const ms = w.marks.filter((m) => m.versionNo === cur && m.stage === r.stage);
          const count = (d: string) => ms.filter((m) => m.decision === d).length;
          const flagged = ms.filter((m) => m.decision !== "APPROVED");
          return (
            <li key={r.stage} className={cn("rounded-lg border px-3 py-2", own ? "border-primary/40" : "border-border")}>
              <div className="flex flex-wrap items-center justify-between gap-x-2"><span className="font-medium">{r.stageLabel}{stage && <span className="ml-1 text-xs font-normal text-muted-foreground">{own ? "(you)" : "(other team)"}</span>}</span><DecisionBadge decision={r.decision} /></div>
              {r.reviewer && <p className="text-xs text-muted-foreground">{r.reviewer} · {fmtDate(r.decidedAt)}</p>}
              {r.comment && <p className="mt-1 wrap-break-word text-xs">{r.comment}</p>}
              {ms.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Marked: {count("APPROVED")} approved · {count("REWORK")} rework · {count("REJECTED")} rejected</p>}
              {!own && flagged.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 text-xs" aria-label={`${r.stageLabel} flagged items`}>
                  {flagged.slice(0, 4).map((m) => (
                    <li key={m.id} className="wrap-break-word"><span className={m.decision === "REJECTED" ? "font-medium text-danger" : "font-medium text-warning"}>{WORD[m.decision]}:</span> {markName(w, m)}{m.reason ? ` · ${m.reason}` : ""}</li>
                  ))}
                  {flagged.length > 4 && <li className="text-muted-foreground">+{flagged.length - 4} more (see the Boards view)</li>}
                </ul>
              )}
              {r.override && <p className="mt-1 text-xs text-warning">Admin override: {r.override.reason}</p>}
              {(r.history ?? []).map((h, i) => (
                <p key={i} className="mt-1 text-xs text-muted-foreground">Changed from {h.decision?.toLowerCase() ?? "earlier answer"}{h.reviewer ? ` (${h.reviewer}` : " ("}{h.decidedAt ? `, ${fmtDate(h.decidedAt)}` : ""}) on {fmtDate(h.changedAt)}</p>
              ))}
            </li>
          );
        })}
      </ul>
      {w.status === "APPROVED" && <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-success">{canChange ? "Final approved. You can still change your decision below." : "Final approved. This version is locked."}</p>}
      {canChange && w.status !== "APPROVED" && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">You approved this version. You can still change your decision below.</p>}
    </Card>
  );
}

/**
 * The checklist of my stage. Open (`locked` false): tick items, or "Select all"; while sending items back, every selected item gets its own remark box.
 * Locked: what my stage answered on this version; items that were sent back are marked with their remarks, and nothing can be changed until the recce
 * person submits the next version (it opens a new, empty checklist).
 */
function ChecklistCard({ w, cur, checks, onChange, locked, review, changing, disabled, marking, markAs, onMarkAs, remarks, onRemark }: {
  w: Workspace; cur: number; checks: Record<string, boolean>; onChange: (c: Record<string, boolean>) => void; locked: boolean; review: WsReview | undefined; changing: boolean; disabled: boolean;
  marking: boolean; markAs: MarkAs; onMarkAs: (m: MarkAs) => void; remarks: Record<string, string>; onRemark: (key: string, text: string) => void;
}) {
  const stage = w.me.stage;
  const items = w.checklist;
  const approved = review?.decision === "APPROVED";
  // My stage's marks on these items in this version (a sent-back item keeps its mark: that is what the locked list shows).
  const marked = new Map(w.marks.filter((m) => m.kind === "CHECK" && m.stage === stage && m.versionNo === cur && m.decision !== "APPROVED").map((m) => [m.check as string, m]));
  /** What a row shows: open = my tick; locked = the recorded answer (approved: all ticked; sent back: the flagged items). */
  const isOn = (key: string) => (locked ? (approved ? true : marked.has(key)) : !!checks[key]);
  const count = items.filter((c) => isOn(c.key)).length;
  const all = items.length > 0 && count === items.length;
  const toggleAll = () => onChange(all ? {} : Object.fromEntries(items.map((c) => [c.key, true])));
  const flaggedCount = locked && !approved ? items.filter((c) => marked.has(c.key)).length : 0;

  return (
    <Card className={cn("p-3 text-sm", locked && "bg-muted/40")}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><ClipboardCheck className="size-4" aria-hidden /> {stage ? STAGE_LABEL[stage] : ""} checklist</p>
        {locked
          ? <Badge tone={approved ? "success" : "warning"}><Lock className="size-3" aria-hidden /> Locked</Badge>
          : <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{count} / {items.length} selected</span>}
      </div>

      {!locked && items.length > 1 && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 font-medium has-focus-visible:outline-2 has-focus-visible:outline-ring">
          <input type="checkbox" className="size-4 accent-primary" disabled={disabled} checked={all} ref={(el) => { if (el) el.indeterminate = count > 0 && !all; }} onChange={toggleAll} aria-label="Select all checklist items" />
          <span>Select all</span>
        </label>
      )}

      {marking && !locked && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs" role="group" aria-label="Send the selected items back as">
          <span className="font-medium">Send back as</span>
          {(["REWORK", "REJECTED"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={markAs === m} onClick={() => onMarkAs(m)} className={cn("rounded-full border px-2.5 py-0.5 font-medium focus-visible:outline-2 focus-visible:outline-ring", markAs === m ? (m === "REJECTED" ? "border-danger bg-danger-soft text-danger" : "border-warning bg-warning-soft text-warning") : "border-border text-muted-foreground")}>{WORD[m]}</button>
          ))}
          <span className="text-muted-foreground">Write a remark for each selected item.</span>
        </div>
      )}

      <ul className="mt-1.5 flex flex-col" aria-label="Checklist items">
        {items.map((c) => {
          const on = isOn(c.key);
          const m = marked.get(c.key);
          const flagged = locked && !approved && on;
          const text = remarks[c.key] ?? "";
          return (
            <li key={c.key}>
              <label className={cn("flex items-start gap-2 rounded-md px-2.5 py-1.5 leading-snug", locked || disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted", flagged && "bg-danger-soft/50 text-danger", !locked && on && "bg-secondary/60")}>
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={on} disabled={locked || disabled} onChange={(e) => onChange({ ...checks, [c.key]: e.target.checked })} />
                <span className="min-w-0 flex-1">{c.label}</span>
                {m && <span className={cn("shrink-0 text-[11px] font-medium", m.decision === "REJECTED" ? "text-danger" : "text-warning")}>{locked ? "Sent back · " : ""}{WORD[m.decision]}</span>}
              </label>
              {m?.reason && (locked || !on) && <p className="mb-1 ml-9 wrap-break-word text-xs text-muted-foreground">{m.reason}</p>}
              {marking && !locked && on && (
                <label className="mb-1.5 ml-9 block">
                  <span className="sr-only">Remark for {c.label}</span>
                  <Textarea rows={2} autoFocus={items.filter((x) => checks[x.key])[0]?.key === c.key} maxLength={MAX_ITEM_REMARK} value={text} onChange={(e) => onRemark(c.key, e.target.value)} aria-invalid={text.trim().length < MIN_ITEM_REMARK}
                    placeholder={`Remark for "${c.label}": what must the recce person fix?`} />
                  <span className="mt-0.5 flex justify-between text-[11px] text-muted-foreground"><span>{text.trim().length < MIN_ITEM_REMARK ? `Required, at least ${MIN_ITEM_REMARK} characters.` : "Goes only with this item."}</span><span>{text.length} / {MAX_ITEM_REMARK}</span></span>
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">
        {locked
          ? approved ? "You approved every item. This stays locked." : flaggedCount > 0 ? `${flaggedCount} item${flaggedCount === 1 ? "" : "s"} sent back, each with its own remark. The checklist opens again when the recce person submits the next version.` : "Sent back. The checklist opens again with the next version."
          : changing ? "Select the items you no longer accept, then choose Rework or Reject."
          : "Select all to approve. To send items back, select only those items and choose Rework or Reject: each gets its own remark."}
      </p>
    </Card>
  );
}

/** Admin only: override a decision with a reason, or reopen a shop for a new attempt. */
function AdminTools({ w }: { w: Workspace }) {
  const override = useOverride(w.id);
  const reopen = useReopen(w.id);
  const toast = useToast();
  const [reason, setReason] = useState("");
  return (
    <>
      {w.me.isAdmin && ["SUBMITTED", "UNDER_REVIEW"].includes(w.status) && (
        <Card className="flex flex-col gap-2 p-3 text-sm">
          <p className="font-medium">Admin override</p>
          <Input aria-label="Override reason" placeholder="Reason (kept in the audit trail)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {(["APPROVE", "REJECT"] as const).map((a) => (
              <Button key={a} size="sm" variant="outline" disabled={reason.trim().length < 5 || override.isPending} onClick={() => override.mutate({ action: a, reason }, { onSuccess: () => { toast(`Override: ${a.toLowerCase()}`); setReason(""); }, onError: (e) => toast(errorMessage(e), "error") })}>{a === "APPROVE" ? "Approve anyway" : "Reject anyway"}</Button>
            ))}
          </div>
        </Card>
      )}
      {w.me.canReopen && (
        <Card className="flex flex-col gap-2 p-3 text-sm">
          <p className="font-medium">Reopen for a new attempt</p>
          <Input aria-label="Reopen reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" variant="outline" disabled={reason.trim().length < 5 || reopen.isPending} onClick={() => reopen.mutate({ reason }, { onSuccess: () => { toast("Shop reopened"); setReason(""); }, onError: (e) => toast(errorMessage(e), "error") })}>Reopen</Button>
        </Card>
      )}
    </>
  );
}
