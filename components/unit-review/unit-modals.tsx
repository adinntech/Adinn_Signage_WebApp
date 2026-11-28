"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Mic, Pause, Play, RotateCcw, Ruler, Square, Trash2 } from "lucide-react";
import { MEASUREMENT_REASONS, PHOTO_REASONS } from "@/components/project-approval/review-parts";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useAddUnitVoiceNote, useDecideUnits, type ReviewBoard, type ReviewUnit } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";
import { allUnits, canRevert, catLabel, fmtIst, latestDecision, personName, ReviewerInfo, unitTitle, type UnitWs } from "./unit-shared";

export type UnitRef = { board: ReviewBoard; unit: ReviewUnit };
const STAGE = { CS: "Client Servicing", OPS: "Operations" } as const;

type Draft = { checks: Record<string, boolean>; comment: string };
type Result = { ok: true } | { ok: false; error: string };
const refKey = ({ board, unit }: UnitRef) => `${board.key}/${unit.key}`;

/**
 * Approve one or more units for my stage. Every board has its own tab with its own checklist (required items) and remark; the
 * choices are kept when switching tabs. On submit every board is checked first, then each is approved on its own with its own
 * checklist and remark, so one failure never marks another board approved. Boards already approved here are not sent again.
 */
export function ApproveUnitsModal({ w, list, onClose }: { w: UnitWs; list: UnitRef[]; onClose: () => void }) {
  const toast = useToast();
  const decide = useDecideUnits(w.id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [active, setActive] = useState(refKey(list[0]!));
  const [results, setResults] = useState<Record<string, Result>>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const multi = list.length > 1;
  const draftOf = (k: string): Draft => drafts[k] ?? { checks: {}, comment: "" };
  const required = w.checklist.filter((c) => c.required !== false);
  const missingOf = (k: string) => required.filter((c) => !draftOf(k).checks[c.key]);
  const setDraft = (k: string, d: Partial<Draft>) => setDrafts((s) => ({ ...s, [k]: { ...draftOf(k), ...s[k], ...d } }));
  const [reverted, setReverted] = useState<Record<string, boolean>>({});
  const [revertOf, setRevertOf] = useState<UnitRef | null>(null);
  // The latest data of a board (the workspace refreshes after each decision): reviewer, status, version.
  const freshOf = (x: UnitRef) => allUnits(w).find((f) => f.board.key === x.board.key && f.unit.key === x.unit.key) ?? x;
  const pendingRefs = list.filter((x) => !results[refKey(x)]?.ok && !reverted[refKey(x)]);
  const cur = list.find((x) => refKey(x) === active) ?? list[0]!;
  const curKey = refKey(cur);
  const curDraft = draftOf(curKey);
  const curMissing = missingOf(curKey);
  const curResult = results[curKey];
  const curFresh = freshOf(cur);

  /** Approves one board with its own checklist and remark. */
  const approveRef = async (x: UnitRef): Promise<Result> => {
    const d = draftOf(refKey(x));
    try {
      await decide.mutateAsync({ decision: "APPROVE", units: [{ boardKey: x.board.key, unitKey: x.unit.key, versionNo: x.unit.currentVersion }], comment: d.comment.trim(), checklist: w.checklist.map((c) => ({ key: c.key, passed: !!d.checks[c.key] })), items: [] });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorMessage(e) };
    }
  };
  /** The active tab's own Approve: only this board's checklist is checked; the modal stays open. */
  const approveActive = async () => {
    if (busy || results[curKey]?.ok || reverted[curKey]) return;
    setTouched(true);
    if (curMissing.length) return;
    setBusy(true);
    const r = await approveRef(cur);
    setResults((s) => ({ ...s, [curKey]: r }));
    setBusy(false);
    if (r.ok) toast(`${tabLabel(cur)} approved`);
    else toast(r.error, "error");
  };

  const submit = async () => {
    if (busy) return;
    setTouched(true);
    const invalid = pendingRefs.find((x) => missingOf(refKey(x)).length);
    if (invalid) { setActive(refKey(invalid)); toast("Complete the checklist of every board before approving", "error"); return; }
    setBusy(true);
    const next: Record<string, Result> = { ...results };
    for (const x of pendingRefs) next[refKey(x)] = await approveRef(x);
    setResults(next);
    setBusy(false);
    const failed = list.filter((x) => !reverted[refKey(x)] && next[refKey(x)] && !next[refKey(x)]!.ok);
    const done = list.filter((x) => next[refKey(x)]?.ok).length;
    if (!failed.length) { toast(done > 1 ? `${done} units approved` : "Unit approved"); onClose(); return; }
    setActive(refKey(failed[0]!));
    toast(`${done} approved, ${failed.length} not approved. Check the marked boards.`, "error");
  };

  const tabLabel = (x: UnitRef) => `${x.board.name} · ${x.unit.unitId ?? x.unit.key} · V${x.unit.currentVersion}`;
  return (
    <Modal
      open
      persistent
      onOpenChange={(o) => !o && !busy && onClose()}
      className="max-w-2xl"
      title={multi ? `Approve ${list.length} units` : `Approve ${unitTitle(list[0]!.board, list[0]!.unit)}`}
      description={`${w.me.stage ? STAGE[w.me.stage] : ""} approval. One approval (Client Servicing or Operations) completes a unit.`}
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button className="bg-[#16A34A] text-white hover:bg-[#15803D]" loading={busy} disabled={!pendingRefs.length} onClick={() => void submit()}>{multi ? `Approve ${pendingRefs.length}` : "Approve"}</Button></>}
    >
      {multi && (
        <div role="tablist" aria-label="Boards" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1.5">
          {list.map((x) => {
            const k = refKey(x);
            const r = results[k];
            const left = missingOf(k).length;
            const on = k === curKey;
            return (
              <button
                key={k} type="button" role="tab" aria-selected={on} onClick={() => setActive(k)}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors", on ? "border-[#16A34A] bg-[#F0FDF4] text-[#166534]" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]")}
              >
                {tabLabel(x)}
                {reverted[k] ? <span className="rounded-full bg-[#FFF7ED] px-1.5 text-[10px] text-[#C2410C]">Reverted</span>
                  : r?.ok ? <span className="rounded-full bg-[#DCFCE7] px-1.5 text-[10px] text-[#166534]">Approved</span>
                  : r ? <span className="rounded-full bg-[#FEE2E2] px-1.5 text-[10px] text-[#B91C1C]">Failed</span>
                  : <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", left ? (touched ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#F3F4F6] text-[#6B7280]") : "bg-[#DCFCE7] text-[#166534]")}>{required.length - left}/{required.length}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div role={multi ? "tabpanel" : undefined} aria-label={multi ? tabLabel(cur) : undefined}>
        {reverted[curKey] ? (
          <div className="rounded-lg bg-[#FFF7ED] px-3 py-2 text-sm text-[#9A3412]">
            <p className="font-medium">{tabLabel(cur)}: approval reverted and sent for correction.</p>
            <ReviewerInfo unit={curFresh.unit} className="mt-1" />
          </div>
        ) : curResult?.ok ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-[#F0FDF4] px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#166534]">{tabLabel(cur)} is approved.</p>
              <ReviewerInfo unit={curFresh.unit} className="mt-1" />
            </div>
            {canRevert(w, curFresh.unit) && (
              <Button type="button" size="sm" variant="outline" className="border-[#FED7AA] text-[#C2410C] hover:bg-[#FFF7ED]" disabled={busy} onClick={() => setRevertOf(curFresh)}><RotateCcw className="size-3.5" aria-hidden /> Revert</Button>
            )}
          </div>
        ) : (
          <>
            {curResult && !curResult.ok && <p className="mb-3 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]" role="alert">Not approved: {curResult.error}</p>}
            <fieldset disabled={busy}>
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
                <span>Checklist <span className="text-danger">*</span>{multi && <span className="ml-1 text-xs font-normal text-[#6B7280]">for {cur.unit.unitId ?? cur.unit.key}</span>}</span>
                <span className="text-xs font-normal text-[#6B7280]">{required.length - curMissing.length} of {required.length} done</span>
              </legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {w.checklist.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 rounded-md border border-[#EEF2F7] px-2.5 py-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[#16A34A]" checked={!!curDraft.checks[c.key]} onChange={(e) => setDraft(curKey, { checks: { ...curDraft.checks, [c.key]: e.target.checked } })} />
                    {c.label}{c.required === false && <span className="text-xs text-muted-foreground">(optional)</span>}
                  </label>
                ))}
              </div>
              <button type="button" className="mt-2 text-xs font-semibold text-[#2563EB] hover:underline" onClick={() => setDraft(curKey, { checks: Object.fromEntries(w.checklist.map((c) => [c.key, true])) })}>Select all</button>
              {touched && curMissing.length > 0 && <p className="mt-1 text-xs font-medium text-danger" role="alert">Tick: {curMissing.map((x) => x.label).join(", ")}</p>}
            </fieldset>
            <label className="mt-4 block text-sm font-medium">Remarks (optional)<Textarea rows={2} value={curDraft.comment} disabled={busy} onChange={(e) => setDraft(curKey, { comment: e.target.value })} maxLength={1500} className="mt-1.5" /></label>
            {multi && (
              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" className="bg-[#16A34A] text-white hover:bg-[#15803D]" loading={busy} onClick={() => void approveActive()}>Approve {cur.unit.unitId ?? cur.unit.key}</Button>
              </div>
            )}
          </>
        )}
      </div>
      {revertOf && (
        <RejectUnitModal
          w={w} target={revertOf} revert
          onDone={() => setReverted((s) => ({ ...s, [refKey(revertOf)]: true }))}
          onClose={() => setRevertOf(null)}
        />
      )}
    </Modal>
  );
}

type Mode = "PHOTO" | "MEASUREMENT" | "BOTH";
type Choice = { reason: string; other: string };
const text = (c: Choice) => (c.reason === "Other" ? c.other.trim() : c.other.trim() ? `${c.reason}: ${c.other.trim()}` : c.reason);

const REVERT_REASONS = ["Incorrectly reviewed", "Incorrectly approved", "Photo verification issue", "Measurement verification issue", "Client requirement mismatch", "Other"];

/**
 * Reject one unit for my stage: photos, measurement or both, a reason for each, an optional comment and voice note.
 * `revert`: the same workflow takes back an approved unit's approval (mandatory revert reason); the approval stays in the history.
 */
export function RejectUnitModal({ w, target, onClose, revert, onDone }: { w: UnitWs; target: UnitRef; onClose: () => void; revert?: boolean; /** after a successful submit */ onDone?: () => void }) {
  const { board, unit } = target;
  const [revertReason, setRevertReason] = useState("");
  const [revertOther, setRevertOther] = useState("");
  const approval = revert ? latestDecision(unit) : undefined;
  const revertText = revertReason === "Other" ? revertOther.trim() : revertReason;
  const toast = useToast();
  const decide = useDecideUnits(w.id);
  const voice = useAddUnitVoiceNote(w.id);
  const v = unit.versions.at(-1)!;
  const photos = v.photos.map((id) => unit.photos.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const [mode, setMode] = useState<Mode>("PHOTO");
  const [picked, setPicked] = useState<Record<string, Choice>>({});
  const [field, setField] = useState<"width" | "height" | "both">("both");
  const [measure, setMeasure] = useState<Choice>({ reason: "", other: "" });
  const [comment, setComment] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const usePhotos = mode !== "MEASUREMENT";
  const useMeasure = mode !== "PHOTO";
  const chosen = usePhotos ? Object.entries(picked) : [];
  const badPhoto = chosen.some(([, c]) => !c.reason || text(c).length < 3);
  const badMeasure = useMeasure && (!measure.reason || text(measure).length < 3);
  const error =
    revert && !revertReason ? "Choose the revert reason" : revert && revertText.length < 3 ? "Type the revert reason" :
    usePhotos && mode === "PHOTO" && chosen.length === 0 ? "Choose at least one photo" : mode === "BOTH" && chosen.length === 0 ? "Choose at least one photo" : badPhoto ? "Give a reason for every chosen photo" : badMeasure ? "Give the measurement reason" : "";

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setBusy(true);
    try {
      const items = [
        ...chosen.map(([ref, c]) => ({ boardKey: board.key, unitKey: unit.key, kind: "PHOTO" as const, ref, reason: text(c).slice(0, 500) })),
        ...(useMeasure ? [{ boardKey: board.key, unitKey: unit.key, kind: "MEASUREMENT" as const, field, reason: text(measure).slice(0, 500) }] : []),
      ];
      await decide.mutateAsync({ decision: revert ? "REVERT" : "REJECT", ...(revert ? { revertReason: revertText.slice(0, 200) } : {}), units: [{ boardKey: board.key, unitKey: unit.key, versionNo: unit.currentVersion }], comment: comment.trim(), rejectMode: mode, checklist: [], items });
      if (blob) await voice.mutateAsync({ boardKey: board.key, unitKey: unit.key, versionNo: unit.currentVersion, blob }).catch((e) => toast(`${revert ? "Reverted" : "Rejected"}, but the voice note was not saved: ${errorMessage(e)}`, "error"));
      toast(revert ? `Approval reverted. ${unitTitle(board, unit)} sent for correction` : `${unitTitle(board, unit)} sent back for correction`);
      onDone?.();
      onClose();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const reasonInputs = (c: Choice, set: (c: Choice) => void, reasons: string[], title: string) => (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <select aria-label={`Reason for ${title}`} value={c.reason} onChange={(e) => set({ ...c, reason: e.target.value })} className={cn("h-9 rounded-md border bg-white px-2 text-sm", touched && !c.reason ? "border-danger" : "border-[#E5E7EB]")}>
        <option value="">Choose reason…</option>
        {[...reasons, "Other"].map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <input aria-label={`Details for ${title}`} value={c.other} onChange={(e) => set({ ...c, other: e.target.value })} maxLength={300} placeholder={c.reason === "Other" ? "Type the reason *" : "Details (optional)"} className={cn("h-9 rounded-md border bg-white px-2 text-sm", touched && c.reason === "Other" && c.other.trim().length < 3 ? "border-danger" : "border-[#E5E7EB]")} />
    </div>
  );

  return (
    <Modal
      open
      persistent
      onOpenChange={(o) => !o && !busy && onClose()}
      className="max-w-2xl"
      title={revert ? `Revert Approval — ${board.name}` : `Reject ${unitTitle(board, unit)}`}
      description={`${w.me.stage ? STAGE[w.me.stage] : ""} · ${unit.unitId ?? unit.key} · Version ${unit.currentVersion}. Only this unit goes back for correction.`}
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="destructive" loading={busy} onClick={() => void submit()}>{revert ? "Revert & Send for Correction" : "Send back for correction"}</Button></>}
    >
      {revert && (
        <section className="mb-4 space-y-3">
          <dl className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-[#6B7280]">Board</dt><dd className="font-medium text-[#111827]">{board.name}</dd></div>
            <div><dt className="text-xs text-[#6B7280]">Unit</dt><dd className="font-medium text-[#111827]">{unit.unitId ?? unit.key}</dd></div>
            <div><dt className="text-xs text-[#6B7280]">Version</dt><dd className="font-medium text-[#111827]">V{unit.currentVersion}</dd></div>
            {approval && (
              <div className="sm:col-span-3">
                <dt className="text-xs text-[#6B7280]">Current approval</dt>
                <dd className="font-medium text-[#047857]">{approval.stageLabel} approved by {personName(approval.reviewer) ?? "Not recorded"} on {fmtIst(approval.decidedAt)}</dd>
              </div>
            )}
          </dl>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm font-medium">Revert reason <span className="text-danger">*</span>
              <select value={revertReason} onChange={(e) => setRevertReason(e.target.value)} className={cn("mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm font-normal", touched && !revertReason ? "border-danger" : "border-[#E5E7EB]")}>
                <option value="">Choose reason…</option>
                {REVERT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            {revertReason === "Other" && (
              <label className="text-sm font-medium">Type the reason <span className="text-danger">*</span>
                <input value={revertOther} onChange={(e) => setRevertOther(e.target.value)} maxLength={200} className={cn("mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm font-normal", touched && revertOther.trim().length < 3 ? "border-danger" : "border-[#E5E7EB]")} />
              </label>
            )}
          </div>
        </section>
      )}
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="mb-2 text-sm font-medium">{revert ? "Correction type" : "Reject based on"} <span className="text-danger">*</span></legend>
        {([["PHOTO", "Photos", ImageIcon], ["MEASUREMENT", revert ? "Measurement & Q&A" : "Measurement", Ruler], ["BOTH", "Both", null]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold", mode === k ? "border-[#DC2626] bg-[#FEF2F2] text-[#B91C1C]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]")}>
            {Icon && <Icon className="size-4" aria-hidden />}{l}
          </button>
        ))}
      </fieldset>

      {usePhotos && (
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Photos of V{unit.currentVersion}</h3>
            <button type="button" className="text-xs font-semibold text-[#2563EB] hover:underline" onClick={() => setPicked((s) => (photos.every((p) => s[p.id]) ? {} : Object.fromEntries(photos.map((p) => [p.id, s[p.id] ?? { reason: "", other: "" }]))))}>Select / clear all</button>
          </div>
          <ul className="space-y-1.5">
            {photos.map((p) => {
              const c = picked[p.id];
              return (
                <li key={p.id} className={cn("rounded-lg border px-3 py-2", c ? "border-[#FECACA] bg-[#FFF7F7]" : "border-[#EEF0F3]")}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" className="size-4 accent-[#DC2626]" checked={!!c} onChange={(e) => setPicked((s) => { const n = { ...s }; if (e.target.checked) n[p.id] = { reason: "", other: "" }; else delete n[p.id]; return n; })} />
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link */}
                    {p.url ? <img src={p.editedUrl ?? p.url} alt="" className="size-10 rounded object-cover" /> : <span className="size-10 rounded bg-[#F3F4F6]" />}
                    <span className="flex-1 font-medium text-[#111827]">{catLabel(w, p.category)}</span>
                  </label>
                  {c && reasonInputs(c, (n) => setPicked((s) => ({ ...s, [p.id]: n })), PHOTO_REASONS, catLabel(w, p.category))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {useMeasure && (
        <section className="mt-4 rounded-lg border border-[#FECACA] bg-[#FFF7F7] px-3 py-2">
          <h3 className="text-sm font-semibold">Measurement · {unit.measurement?.width ?? "-"} × {unit.measurement?.height ?? "-"} {unit.measurement?.unit ?? "FT"}</h3>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Which measurement">
            {(["width", "height", "both"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={field === f} onClick={() => setField(f)} className={cn("h-8 rounded-md border px-3 text-xs font-semibold capitalize", field === f ? "border-[#DC2626] bg-white text-[#B91C1C]" : "border-[#E5E7EB] bg-white text-[#374151]")}>{f === "both" ? "Width & height" : f}</button>
            ))}
          </div>
          {reasonInputs(measure, setMeasure, MEASUREMENT_REASONS, "measurement")}
        </section>
      )}
      {touched && error && <p className="mt-2 text-xs font-medium text-danger" role="alert">{error}</p>}

      <label className="mt-4 block text-sm font-medium">Comment (optional)<Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1200} className="mt-1.5" placeholder="Anything else the vendor / staff should know" /></label>
      <VoiceNote blob={blob} onChange={setBlob} />
    </Modal>
  );
}

const MAX_MS = 60_000;
const mmss = (ms: number) => { const s = Math.min(60, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/**
 * Optional voice note recorded in the browser: Start, Pause, Resume, Stop. At most 60 s of recorded audio (paused time does not
 * count); it stops by itself at the limit. The microphone is released on stop and when the modal closes.
 */
function VoiceNote({ blob, onChange }: { blob: Blob | null; onChange: (b: Blob | null) => void }) {
  const toast = useToast();
  const rec = useRef<MediaRecorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0); // recorded ms before the current run
  const runFrom = useRef(0); // when the current run started (0 = not running)
  const alive = useRef(true);
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [ms, setMs] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  const clearTick = () => { if (tick.current) clearInterval(tick.current); tick.current = null; };
  const total = () => elapsed.current + (runFrom.current ? Date.now() - runFrom.current : 0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTick();
      const r = rec.current;
      if (r && r.state !== "inactive") { r.onstop = null; r.stop(); }
      r?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = () => {
    clearTick();
    elapsed.current = total();
    runFrom.current = 0;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  };
  const run = () => {
    runFrom.current = Date.now();
    clearTick();
    tick.current = setInterval(() => { const t = total(); setMs(t); if (t >= MAX_MS) stop(); }, 200);
  };
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { toast("Voice recording is not supported in this browser", "error"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const r = new MediaRecorder(stream);
      const parts: BlobPart[] = [];
      r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); if (!alive.current) return; onChange(new Blob(parts, { type: r.mimeType || "audio/webm" })); setState("idle"); };
      r.start();
      rec.current = r;
      elapsed.current = 0;
      setMs(0);
      setState("recording");
      run();
    } catch (e) {
      const name = (e as { name?: string }).name;
      toast(name === "NotAllowedError" || name === "SecurityError" ? "Microphone permission was denied. Allow it in the browser to record." : name === "NotFoundError" ? "No microphone was found" : "Could not start the microphone", "error");
    }
  };
  const pause = () => {
    const r = rec.current;
    if (!r || r.state !== "recording" || typeof r.pause !== "function") return;
    r.pause();
    clearTick();
    elapsed.current = total();
    runFrom.current = 0;
    setMs(elapsed.current);
    setState("paused");
  };
  const resume = () => {
    const r = rec.current;
    if (!r || r.state !== "paused") return;
    r.resume();
    setState("recording");
    run();
  };
  const canPause = typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function";
  const live = state !== "idle";

  return (
    <div className="mt-4">
      <p className="text-sm font-medium">Voice note (optional)</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {!live && !blob && <Button type="button" variant="outline" size="sm" onClick={() => void start()}><Mic className="size-4" aria-hidden /> Start recording</Button>}
        {state === "recording" && canPause && <Button type="button" variant="outline" size="sm" onClick={pause}><Pause className="size-3.5" aria-hidden /> Pause</Button>}
        {state === "paused" && <Button type="button" variant="outline" size="sm" onClick={resume}><Play className="size-3.5" aria-hidden /> Resume</Button>}
        {live && <Button type="button" variant="outline" size="sm" className="border-[#FECACA] text-[#B91C1C]" onClick={stop}><Square className="size-3.5" aria-hidden /> Stop</Button>}
        {live && (
          <span className={cn("flex items-center gap-1.5 text-xs font-medium tabular-nums", state === "recording" ? "text-[#B91C1C]" : "text-[#B45309]")} aria-live="polite">
            <span className={cn("size-2 rounded-full", state === "recording" ? "animate-pulse bg-[#DC2626]" : "bg-[#F59E0B]")} aria-hidden />
            {state === "recording" ? "Recording" : "Paused"} · {mmss(ms)} / 1:00
          </span>
        )}
        {url && <audio controls src={url} className="h-9 max-w-full" />}
        {blob && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} aria-label="Remove voice note"><Trash2 className="size-4" aria-hidden /></Button>}
      </div>
    </div>
  );
}
