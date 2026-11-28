"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Mic, Ruler, Square, Trash2 } from "lucide-react";
import { MEASUREMENT_REASONS, PHOTO_REASONS } from "@/components/project-approval/review-parts";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useAddUnitVoiceNote, useDecideUnits, type ReviewBoard, type ReviewUnit } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";
import { catLabel, unitTitle, type UnitWs } from "./unit-shared";

export type UnitRef = { board: ReviewBoard; unit: ReviewUnit };
const STAGE = { CS: "Client Servicing", OPS: "Operations" } as const;

/** Approve one or more units for my stage: the review checklist (required) and an optional remark. */
export function ApproveUnitsModal({ w, list, onClose }: { w: UnitWs; list: UnitRef[]; onClose: () => void }) {
  const toast = useToast();
  const decide = useDecideUnits(w.id);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = w.checklist.filter((c) => c.required !== false && !checks[c.key]);
  const submit = () => {
    setTouched(true);
    if (missing.length) return;
    decide.mutate(
      { decision: "APPROVE", units: list.map(({ board, unit }) => ({ boardKey: board.key, unitKey: unit.key, versionNo: unit.currentVersion })), comment: comment.trim(), checklist: w.checklist.map((c) => ({ key: c.key, passed: !!checks[c.key] })), items: [] },
      { onSuccess: () => { toast(list.length > 1 ? `${list.length} units approved` : "Unit approved"); onClose(); }, onError: (e) => toast(errorMessage(e), "error") },
    );
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={list.length > 1 ? `Approve ${list.length} units` : `Approve ${unitTitle(list[0]!.board, list[0]!.unit)}`}
      description={`${w.me.stage ? STAGE[w.me.stage] : ""} approval. A unit is completed when both stages approve it.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="bg-[#16A34A] text-white hover:bg-[#15803D]" loading={decide.isPending} onClick={submit}>Approve</Button></>}
    >
      {list.length > 1 && <ul className="mb-3 flex flex-wrap gap-1.5">{list.map(({ board, unit }) => <li key={`${board.key}-${unit.key}`} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium">{unitTitle(board, unit)} · V{unit.currentVersion}</li>)}</ul>}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Checklist <span className="text-danger">*</span></legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {w.checklist.map((c) => (
            <label key={c.key} className="flex items-center gap-2 rounded-md border border-[#EEF2F7] px-2.5 py-2 text-sm">
              <input type="checkbox" className="size-4 accent-[#16A34A]" checked={!!checks[c.key]} onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))} />
              {c.label}{c.required === false && <span className="text-xs text-muted-foreground">(optional)</span>}
            </label>
          ))}
        </div>
        <button type="button" className="mt-2 text-xs font-semibold text-[#2563EB] hover:underline" onClick={() => setChecks(Object.fromEntries(w.checklist.map((c) => [c.key, true])))}>Tick all</button>
        {touched && missing.length > 0 && <p className="mt-1 text-xs font-medium text-danger" role="alert">Tick: {missing.map((x) => x.label).join(", ")}</p>}
      </fieldset>
      <label className="mt-4 block text-sm font-medium">Remarks (optional)<Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} className="mt-1.5" /></label>
    </Modal>
  );
}

type Mode = "PHOTO" | "MEASUREMENT" | "BOTH";
type Choice = { reason: string; other: string };
const text = (c: Choice) => (c.reason === "Other" ? c.other.trim() : c.other.trim() ? `${c.reason}: ${c.other.trim()}` : c.reason);

/** Reject one unit for my stage: photos, measurement or both, a reason for each, an optional comment and voice note. */
export function RejectUnitModal({ w, target, onClose }: { w: UnitWs; target: UnitRef; onClose: () => void }) {
  const { board, unit } = target;
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
  const error = usePhotos && mode === "PHOTO" && chosen.length === 0 ? "Choose at least one photo" : mode === "BOTH" && chosen.length === 0 ? "Choose at least one photo" : badPhoto ? "Give a reason for every chosen photo" : badMeasure ? "Give the measurement reason" : "";

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setBusy(true);
    try {
      const items = [
        ...chosen.map(([ref, c]) => ({ boardKey: board.key, unitKey: unit.key, kind: "PHOTO" as const, ref, reason: text(c).slice(0, 500) })),
        ...(useMeasure ? [{ boardKey: board.key, unitKey: unit.key, kind: "MEASUREMENT" as const, field, reason: text(measure).slice(0, 500) }] : []),
      ];
      await decide.mutateAsync({ decision: "REJECT", units: [{ boardKey: board.key, unitKey: unit.key, versionNo: unit.currentVersion }], comment: comment.trim(), rejectMode: mode, checklist: [], items });
      if (blob) await voice.mutateAsync({ boardKey: board.key, unitKey: unit.key, versionNo: unit.currentVersion, blob }).catch((e) => toast(`Rejected, but the voice note was not saved: ${errorMessage(e)}`, "error"));
      toast(`${unitTitle(board, unit)} sent back for correction`);
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
      title={`Reject ${unitTitle(board, unit)}`}
      description={`${w.me.stage ? STAGE[w.me.stage] : ""} · Version ${unit.currentVersion}. Only this unit goes back for correction.`}
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="destructive" loading={busy} onClick={() => void submit()}>Send back for correction</Button></>}
    >
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="mb-2 text-sm font-medium">Reject based on <span className="text-danger">*</span></legend>
        {([["PHOTO", "Photos", ImageIcon], ["MEASUREMENT", "Measurement", Ruler], ["BOTH", "Both", null]] as const).map(([k, l, Icon]) => (
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

/** Optional voice note (up to 60 s) recorded in the browser. */
function VoiceNote({ blob, onChange }: { blob: Blob | null; onChange: (b: Blob | null) => void }) {
  const toast = useToast();
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { toast("Voice recording is not supported in this browser", "error"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const parts: BlobPart[] = [];
      r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); onChange(new Blob(parts, { type: r.mimeType || "audio/webm" })); setRecording(false); };
      r.start();
      rec.current = r;
      setRecording(true);
      timer.current = setTimeout(() => { if (r.state === "recording") r.stop(); }, 60_000);
    } catch {
      toast("Microphone permission was denied", "error");
    }
  };
  const stop = () => { if (timer.current) clearTimeout(timer.current); if (rec.current?.state === "recording") rec.current.stop(); };

  return (
    <div className="mt-4">
      <p className="text-sm font-medium">Voice note (optional)</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {!recording && !blob && <Button type="button" variant="outline" size="sm" onClick={() => void start()}><Mic className="size-4" aria-hidden /> Record</Button>}
        {recording && <Button type="button" variant="outline" size="sm" className="border-[#FECACA] text-[#B91C1C]" onClick={stop}><Square className="size-3.5" aria-hidden /> Stop (max 60 s)</Button>}
        {recording && <span className="flex items-center gap-1.5 text-xs text-[#B91C1C]"><span className="size-2 animate-pulse rounded-full bg-[#DC2626]" />Recording…</span>}
        {url && <audio controls src={url} className="h-9 max-w-full" />}
        {blob && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} aria-label="Remove voice note"><Trash2 className="size-4" aria-hidden /></Button>}
      </div>
    </div>
  );
}
