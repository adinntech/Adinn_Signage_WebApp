"use client";

import { useState, type ReactNode } from "react";
import { CheckCheck, CheckCircle2, ChevronDown, Download, History, Image as ImageIcon, Layers, RotateCcw, Ruler, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import type { ReviewBoard, ReviewUnit, WsPhoto } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";
import { ApproveUnitsModal, RejectUnitModal, type UnitRef } from "./unit-modals";
import { allUnits, canDecide, canRevert, catLabel, DecisionChip, decisionsOf, fmtAt, fmtIst, personName, ReviewerInfo, UNIT_LOOK, UnitBadge, unitTitle, type UnitWs } from "./unit-shared";

type Tab = "photos" | "measure" | "versions";
const RED = "#D92D20";

/**
 * Unit-wise review: every board unit (quantity) with its own photos, measurement, answers, versions and OPS / CS decisions.
 * `compact` (Recce Review side panel): the unit list with decisions and actions only.
 */
export function UnitReview({ w, compact }: { w: UnitWs; compact?: boolean }) {
  const units = allUnits(w);
  const [sel, setSel] = useState<string | null>(null);
  const [approve, setApprove] = useState<UnitRef[] | null>(null);
  const [reject, setReject] = useState<{ ref: UnitRef; revert?: boolean } | null>(null);
  const mine = units.filter((x) => canDecide(w, x.unit));
  if (!units.length) return <EmptyState icon={Layers} title="No unit record yet" description="Units appear here after the recce is submitted (older shops need the unit migration)." />;
  const current = units.find((x) => `${x.board.key}/${x.unit.key}` === sel) ?? units[0]!;

  // Yet to Review / resubmitted → Approve + Reject. Approved → Revert. Rework → no action (waits for the field person).
  const actions = (x: UnitRef, small?: boolean) =>
    canDecide(w, x.unit) ? (
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className={cn("border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]", small && "h-7 px-2 text-xs")} onClick={() => setReject({ ref: x })}><XCircle className="size-3.5" aria-hidden /> Reject</Button>
        <Button size="sm" className={cn("bg-[#16A34A] text-white hover:bg-[#15803D]", small && "h-7 px-2 text-xs")} onClick={() => setApprove([x])}><CheckCircle2 className="size-3.5" aria-hidden /> Approve</Button>
      </div>
    ) : canRevert(w, x.unit) ? (
      <Button size="sm" variant="outline" className={cn("border-[#FED7AA] text-[#C2410C] hover:bg-[#FFF7ED]", small && "h-7 px-2 text-xs")} onClick={() => setReject({ ref: x, revert: true })}><RotateCcw className="size-3.5" aria-hidden /> Revert</Button>
    ) : null;

  const list = (
    // Full view: a horizontal strip of cards in a narrow drawer (tablet / mobile), a vertical list from 760px. Compact view keeps its stack.
    <ul
      className={cn(compact ? "space-y-1.5" : "-mx-1 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-2 @min-[760px]:mx-0 @min-[760px]:flex-col @min-[760px]:overflow-visible @min-[760px]:p-0")}
      aria-label="Units"
    >
      {units.map((x) => {
        const id = `${x.board.key}/${x.unit.key}`;
        const active = !compact && current === x;
        return (
          <li key={id} className={cn(!compact && "w-[232px] shrink-0 snap-start @min-[760px]:w-auto")}>
            <div
              className={cn("h-full rounded-xl border px-3 py-2.5 transition-colors", active ? "border-transparent ring-2" : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]")}
              style={active ? { ["--tw-ring-color" as string]: `${RED}66`, background: "#FFF7F7" } : undefined}
            >
              <button type="button" onClick={() => setSel(id)} className="flex h-full min-h-[72px] w-full flex-col gap-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2" aria-current={active} title={unitTitle(x.board, x.unit)}>
                {/* Unit id + status, then the media line (wraps, never clipped), then version and stage decisions. */}
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-semibold leading-5 text-[#111827]">{x.unit.unitId ?? x.unit.key}</span>
                  <UnitBadge status={x.unit.status} />
                </span>
                <span className="line-clamp-2 break-words text-xs leading-4 text-[#6B7280]">
                  {x.board.name}{x.board.sideType ? ` · ${x.board.sideType === "DOUBLE" ? "Double side" : "Single side"}` : ""}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-1">
                  <span className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-bold text-[#374151]">{x.unit.currentVersion ? `V${x.unit.currentVersion}` : "Not submitted"}</span>
                  <ReviewerInfo unit={x.unit} compact className="basis-full" />
                </span>
              </button>
              {compact && <div className="mt-2">{actions(x, true)}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      {mine.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F0FDF4] px-3 py-2 text-sm">
          <span className="text-[#166534]">{mine.length} units are waiting for your decision.</span>
          <Button size="sm" className="bg-[#16A34A] text-white hover:bg-[#15803D]" onClick={() => setApprove(mine)}><CheckCheck className="size-4" aria-hidden /> Approve all {mine.length}</Button>
        </div>
      )}
      {compact ? list : (
        // Sized by its own width (drawer or full page), not the window.
        <div className="@container">
          <div className="grid gap-3 @min-[760px]:grid-cols-[240px_minmax(0,1fr)] @min-[760px]:gap-4">
            <div className="min-w-0 @min-[760px]:max-h-[65vh] @min-[760px]:overflow-y-auto @min-[760px]:p-1">{list}</div>
            <UnitDetail key={`${current.board.key}/${current.unit.key}`} w={w} board={current.board} unit={current.unit} actions={actions(current)} />
          </div>
        </div>
      )}
      {approve && <ApproveUnitsModal w={w} list={approve} onClose={() => setApprove(null)} />}
      {reject && <RejectUnitModal w={w} target={reject.ref} revert={reject.revert} onClose={() => setReject(null)} />}
    </div>
  );
}

function UnitDetail({ w, board, unit, actions }: { w: UnitWs; board: ReviewBoard; unit: ReviewUnit; actions: ReactNode }) {
  const [tab, setTab] = useState<Tab>("photos");
  const [zoom, setZoom] = useState<WsPhoto | null>(null);
  const v = unit.versions.at(-1);
  const tabs: { key: Tab; label: string; icon: typeof ImageIcon }[] = [
    { key: "photos", label: `Photos (${v?.photos.length ?? 0})`, icon: ImageIcon },
    { key: "measure", label: "Measurement & Q&A", icon: Ruler },
    { key: "versions", label: `Versions (${unit.versions.length})`, icon: History },
  ];
  return (
    <section className="min-w-0 rounded-xl border border-[#EEF0F3] p-3 sm:p-4" aria-label={unitTitle(board, unit)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-[#111827]">{unitTitle(board, unit)}</h3>
        <UnitBadge status={unit.status} />
        {unit.currentVersion > 0 && <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-semibold">V{unit.currentVersion}</span>}
        <span className="ml-auto">{actions}</span>
      </div>
      <ReviewerInfo unit={unit} className="mt-1.5 text-xs" />
      <div role="tablist" className="mt-3 flex gap-1 overflow-x-auto border-b border-[#EEF0F3]">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-medium", tab === t.key ? "text-[#111827]" : "text-[#6B7280] hover:text-[#111827]")}>
            <t.icon className="size-4" aria-hidden />{t.label}
            {tab === t.key && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full" style={{ background: RED }} />}
          </button>
        ))}
      </div>
      <div className="pt-3">
        {tab === "photos" && <Photos w={w} unit={unit} onZoom={setZoom} />}
        {tab === "measure" && <Measure unit={unit} />}
        {tab === "versions" && <Versions w={w} unit={unit} />}
      </div>
      {zoom && <Lightbox w={w} unit={unit} p={zoom} onClose={() => setZoom(null)} />}
    </section>
  );
}

/** Rejections of a photo in any version of the unit. */
const photoRejections = (unit: ReviewUnit, id: string) => unit.versions.flatMap((v) => v.reviews.flatMap((r) => r.items.filter((i) => i.kind === "PHOTO" && i.ref === id).map((i) => ({ ...i, stage: r.stage, version: v.version }))));

function Photos({ w, unit, onZoom }: { w: UnitWs; unit: ReviewUnit; onZoom: (p: WsPhoto) => void }) {
  const [old, setOld] = useState(false);
  const v = unit.versions.at(-1);
  const current = (v?.photos ?? []).map((id) => unit.photos.find((p) => p.id === id)).filter((p): p is WsPhoto => !!p);
  const previous = unit.photos.filter((p) => !(v?.photos ?? []).includes(p.id));
  const required = w.unitPhotoCategories ?? [];
  const missing = required.filter((c) => !current.some((p) => p.category === c));
  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";
  const tile = (p: WsPhoto, label: string) => {
    const rej = photoRejections(unit, p.id);
    const isNew = v?.changed.photos.includes(p.id) && (v?.version ?? 1) > 1;
    return (
      <figure key={p.id} className="overflow-hidden rounded-xl border border-[#EEF0F3] bg-white">
        <button type="button" onClick={() => onZoom(p)} className="relative block w-full" aria-label={`Open ${label}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link */}
          {p.url ? <img src={p.editedUrl ?? p.url} alt={label} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <span className="grid aspect-[4/3] place-items-center bg-[#F3F4F6] text-xs text-[#9CA3AF]">No preview</span>}
          {isNew && <span className="absolute left-1.5 top-1.5 rounded bg-[#16A34A] px-1.5 text-[10px] font-bold text-white">NEW V{v!.version}</span>}
        </button>
        <figcaption className="space-y-0.5 p-2">
          <span className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: RED }}>{label}</span>
          <p className="text-[11px] text-[#6B7280]">{fmtAt(p.capturedAt)}{p.version ? ` · V${p.version}` : ""}</p>
          <p className="truncate text-[11px] text-[#6B7280]">{p.lat != null && p.lng != null ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}${p.gpsAccuracy != null ? ` ±${Math.round(p.gpsAccuracy)}m` : ""}` : "No GPS"}</p>
          {rej.map((r, i) => <p key={i} className="rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] text-[#991B1B]">V{r.version} {r.stage}: {r.reason}</p>)}
        </figcaption>
      </figure>
    );
  };
  return (
    <div className="space-y-4">
      {!current.length && !missing.length ? <EmptyState icon={ImageIcon} title="No photos in this version" /> : (
        <div className={grid}>
          {current.map((p) => tile(p, catLabel(w, p.category)))}
          {missing.map((c) => (
            <div key={c} className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-[#FECACA] bg-[#FFF7F7] p-2 text-center text-xs font-semibold text-[#B91C1C]">
              <span><ImageIcon className="mx-auto mb-1 size-5" aria-hidden />{catLabel(w, c)}<br /><span className="font-normal">Missing</span></span>
            </div>
          ))}
        </div>
      )}
      {previous.length > 0 && (
        <div className="rounded-xl border border-[#EEF0F3]">
          <button type="button" onClick={() => setOld((x) => !x)} aria-expanded={old} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-[#374151]">
            Older photos of this unit ({previous.length})<ChevronDown className={cn("size-4 transition-transform", old && "rotate-180")} aria-hidden />
          </button>
          {old && <div className={cn(grid, "border-t border-[#EEF0F3] p-3")}>{previous.map((p) => tile(p, `${catLabel(w, p.category)} (old)`))}</div>}
        </div>
      )}
    </div>
  );
}

function Measure({ unit }: { unit: ReviewUnit }) {
  const v = unit.versions.at(-1);
  const prev = unit.versions.at(-2);
  const m = v?.measurement ?? unit.measurement;
  const rejected = unit.versions.flatMap((x) => x.reviews.flatMap((r) => r.items.filter((i) => i.kind === "MEASUREMENT").map((i) => ({ ...i, stage: r.stage, version: x.version }))));
  const answers = v?.answers ?? unit.answers;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {(["width", "height"] as const).map((k) => {
          const changed = v?.changed.measurement.includes(k);
          return (
            <div key={k} className={cn("rounded-lg p-3", changed ? "bg-[#F0FDF4]" : "bg-[#F9FAFB]")}>
              <dt className="text-xs capitalize text-[#6B7280]">{k}</dt>
              <dd className="text-lg font-semibold text-[#111827]">
                {m?.[k] ?? "-"} <span className="text-sm font-normal">{m?.unit ?? "FT"}</span>
                {changed && prev?.measurement && <span className="ml-1.5 text-xs font-normal text-[#9CA3AF] line-through">{prev.measurement[k] ?? "-"}</span>}
              </dd>
            </div>
          );
        })}
        <div className="rounded-lg bg-[#F9FAFB] p-3"><dt className="text-xs text-[#6B7280]">Area</dt><dd className="text-lg font-semibold text-[#111827]">{m?.width && m?.height ? +(m.width * m.height).toFixed(2) : "-"} <span className="text-sm font-normal">sq {m?.unit?.toLowerCase() ?? "ft"}</span></dd></div>
      </dl>
      {rejected.length > 0 && <ul className="space-y-1">{rejected.map((r, i) => <li key={i} className="rounded-md bg-[#FEF2F2] px-2.5 py-1.5 text-xs text-[#991B1B]">V{r.version} {r.stage} rejected {r.field === "both" ? "width & height" : r.field}: {r.reason}{r.fixedInVersion ? ` · corrected in V${r.fixedInVersion}` : ""}</li>)}</ul>}
      <div>
        <h4 className="mb-1.5 text-sm font-semibold text-[#111827]">Questions &amp; Answers</h4>
        {answers.length ? (
          <ul className="divide-y divide-[#F3F4F6] rounded-lg border border-[#F3F4F6]">
            {answers.map((a) => <li key={a.key} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm"><span className="text-[#6B7280]">{a.question || a.key}</span><span className="font-medium text-[#111827]">{a.answer || "-"}</span></li>)}
          </ul>
        ) : <p className="text-xs text-[#9CA3AF]">No answers recorded for this unit.</p>}
      </div>
    </div>
  );
}

const VERB: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", REVERTED: "Reverted" };
const MODE_LABEL: Record<string, string> = { PHOTO: "Photos", MEASUREMENT: "Measurement & Q&A", BOTH: "Photos and Measurement & Q&A" };

function Versions({ w, unit }: { w: UnitWs; unit: ReviewUnit }) {
  const [open, setOpen] = useState<number | null>(unit.currentVersion);
  const name = (id: string | null) => (id ? catLabel(w, unit.photos.find((p) => p.id === id)?.category ?? "Photo") : "Photo");
  return (
    <ol className="space-y-2">
      {[...unit.versions].reverse().map((v) => {
        // Every real decision of this version in order (approval, revert, rejection); the last one is the version's outcome.
        const decisions = decisionsOf(v.reviews);
        const last = decisions.at(-1);
        const rejected = last?.decision === "REJECTED" || last?.decision === "REVERTED";
        const approved = last?.decision === "APPROVED";
        const isOpen = open === v.version;
        return (
          <li key={v.version} className={cn("rounded-xl border", rejected ? "border-[#FECACA]" : approved ? "border-[#BBF7D0]" : "border-[#E5E7EB]")}>
            <button type="button" onClick={() => setOpen(isOpen ? null : v.version)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F3F4F6] text-xs font-bold">V{v.version}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#111827]">{v.version === unit.currentVersion ? "Current version" : `Version ${v.version}`}{last?.decision === "REVERTED" ? " · Approval reverted" : rejected ? " · Rejected" : approved ? " · Approved" : " · Yet to review"}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#6B7280]">
                  <span><span className="font-medium text-[#374151]">Submitted by:</span> {personName(v.submittedBy) ?? "Not recorded"}</span>
                  <span><span className="font-medium text-[#374151]">Submitted on:</span> {fmtIst(v.submittedAt)}</span>
                  {v.shopVersion ? <span><span className="font-medium text-[#374151]">Submission:</span> #{v.shopVersion}</span> : null}
                </span>
              </span>
              <ChevronDown className={cn("size-4 text-[#6B7280] transition-transform", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <div className="space-y-2 border-t border-[#F3F4F6] px-3 py-3 text-sm">
                <p className="text-[#374151]">{v.photos.length} photos · {v.measurement?.width ?? "-"} × {v.measurement?.height ?? "-"} {v.measurement?.unit ?? "FT"}{v.changed.photos.length && v.version > 1 ? ` · ${v.changed.photos.length} new photo(s)` : ""}{v.changed.measurement.length ? ` · changed ${v.changed.measurement.join(", ")}` : ""}</p>
                {decisions.map((r, n) => {
                  const verb = VERB[r.decision]!;
                  return (
                    <div key={`${r.stage}-${r.decision}-${n}`} className={cn("rounded-lg px-3 py-2", r.decision === "APPROVED" ? "bg-[#F0FDF4]" : r.decision === "REVERTED" ? "bg-[#FFF7ED]" : "bg-[#FEF2F2]")}>
                      <p className="flex flex-wrap items-center gap-2 font-medium text-[#111827]"><DecisionChip stage={r.stage} decision={r.decision} /></p>
                      <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-[#374151] sm:grid-cols-2">
                        <div><dt className="inline font-medium">{verb} by: </dt><dd className="inline">{personName(r.reviewer) ?? "Not recorded"} ({r.stageLabel})</dd></div>
                        <div><dt className="inline font-medium">{verb} on: </dt><dd className="inline">{fmtIst(r.decidedAt)}</dd></div>
                        {r.revertReason && <div className="sm:col-span-2"><dt className="inline font-medium">Reason: </dt><dd className="inline">{r.revertReason}</dd></div>}
                        {r.rejectMode && r.decision !== "APPROVED" && <div className="sm:col-span-2"><dt className="inline font-medium">Correction type: </dt><dd className="inline">{MODE_LABEL[r.rejectMode] ?? r.rejectMode}</dd></div>}
                      </dl>
                      {r.override && <p className="mt-1 text-xs text-[#B45309]">Admin override: {r.override.reason}</p>}
                      {r.comment && <p className="mt-1 text-xs text-[#374151]"><span className="font-medium">{r.decision === "APPROVED" ? "Remarks" : "Comment"}:</span> {r.comment}</p>}
                      {r.items.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs font-medium text-[#374151]">Selected corrections:</p>
                          <ul className="mt-1 space-y-1">{r.items.map((i, k) => <li key={k} className="rounded-md bg-white px-2 py-1 text-xs text-[#991B1B]"><b>{i.kind === "PHOTO" ? name(i.ref) : `Measurement (${i.field === "both" ? "width & height" : i.field})`}</b> – {i.reason}{i.fixedInVersion ? <span className="text-[#047857]"> · fixed in V{i.fixedInVersion}</span> : null}</li>)}</ul>
                        </div>
                      )}
                      {r.voiceNoteUrl && <audio controls src={r.voiceNoteUrl} className="mt-1 h-8 w-full max-w-xs" />}
                    </div>
                  );
                })}
                {!decisions.length && <p className="text-xs text-[#6B7280]">No review decision on this version yet.</p>}
                {last && v.version === unit.currentVersion && <p className="text-xs text-[#6B7280]"><span className="font-medium text-[#374151]">Current status:</span> {UNIT_LOOK[unit.status]?.label ?? unit.status}</p>}
              </div>
            )}
          </li>
        );
      })}
      {!unit.versions.length && <p className="text-sm text-[#6B7280]">Not submitted yet.</p>}
    </ol>
  );
}

function Lightbox({ w, unit, p, onClose }: { w: UnitWs; unit: ReviewUnit; p: WsPhoto; onClose: () => void }) {
  const src = p.editedUrl ?? p.url;
  const rej = photoRejections(unit, p.id);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} className="max-w-4xl" title={catLabel(w, p.category)} description={`${unit.unitId ?? `Unit ${unit.unitNo}`}${p.version ? ` · Version ${p.version}` : ""}${p.state === "SUPERSEDED" ? " · replaced later" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link */}
      {src ? <img src={src} alt={catLabel(w, p.category)} className="max-h-[60vh] w-full rounded-lg bg-[#111827] object-contain" /> : <p className="text-sm text-[#6B7280]">No preview</p>}
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-[#6B7280]">Captured by</dt><dd className="font-medium">{p.uploadedBy ?? "-"}</dd></div>
        <div><dt className="text-xs text-[#6B7280]">Captured at</dt><dd className="font-medium">{fmtAt(p.capturedAt)}</dd></div>
        <div><dt className="text-xs text-[#6B7280]">GPS</dt><dd className="font-medium">{p.lat != null && p.lng != null ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}${p.gpsAccuracy != null ? ` (±${Math.round(p.gpsAccuracy)} m)` : ""}` : "Not available"}</dd></div>
      </dl>
      {rej.map((r, i) => <p key={i} className="mt-2 rounded-lg bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">V{r.version} · {r.stage} rejected: {r.reason}</p>)}
      {src && <a href={src} target="_blank" rel="noreferrer" download className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:underline"><Download className="size-4" aria-hidden />Download original</a>}
    </Modal>
  );
}
