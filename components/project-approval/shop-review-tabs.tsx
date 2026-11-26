"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Box, CheckCircle2, Send, XCircle } from "lucide-react";
import { PhotoLightbox } from "@/components/preview/photo-lightbox";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useVersionCompare, type ApprovalWorkspace, type Board, type ItemReview } from "@/lib/api/projectApproval";
import { useSendShopMessage, useShopThread, useTimeline, type ReviewStage, type WsPhoto } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";
import { DECISION_LOOK, fmtDateTime, fmtGps, Pill, Section, STAGE_NAME } from "./common";
import { GpsLine, ItemActions, ItemDecisions } from "./review-parts";

type Version = ApprovalWorkspace["versions"][number];
export interface ReviewCtx {
  w: ApprovalWorkspace;
  cur: Version;
  prev: Version | null;
  stage: ReviewStage | null;
  canAct: boolean;
  photos: WsPhoto[];
  curItems: ItemReview[];
  itemsOf: (kind: ItemReview["kind"], ref: string) => ItemReview[];
  catLabel: (k: string) => string;
  boardLabel: (key: string) => string;
  busy: boolean;
  approveItem: (kind: ItemReview["kind"], ref: string) => void;
  rejectItem: (kind: ItemReview["kind"], ref: string, title: string) => void;
  clearItem: (kind: ItemReview["kind"], ref: string) => void;
  checks: Record<string, boolean>;
  setChecks: Dispatch<SetStateAction<Record<string, boolean>>>;
  openCompare: () => void;
}

const num = (v?: number | null) => (v == null ? "-" : String(Math.round(v * 100) / 100));
const MEASURE_FIELDS = ["name", "width", "height", "unit", "quantity"] as const;
const changedFields = (a: Board | undefined, b: Board) => (a ? MEASURE_FIELDS.filter((f) => (a[f] ?? null) !== (b[f] ?? null)) : []);
const rejectedCount = (list: ItemReview[], stage: ReviewStage) => list.filter((i) => i.stage === stage && i.decision === "REJECTED").length;

/* ------------------------------------------------ overview ------------------------------------------------ */

export function OverviewTab({ c, goTo }: { c: ReviewCtx; goTo: (k: string) => void }) {
  const { w, cur, prev, curItems, catLabel, boardLabel, photos } = c;
  const photoById = new Map(w.photos.map((p) => [p.id, p]));
  const title = (i: ItemReview) => (i.kind === "PHOTO" ? catLabel(photoById.get(i.ref)?.category ?? "Photo") : boardLabel(i.ref));
  const rejectedNow = curItems.filter((i) => i.decision === "REJECTED");
  // Earlier feedback: item rejections and rework items of the previous version, with what changed in this version.
  const prevRejected = prev ? w.itemReviews.filter((i) => i.versionNo === prev.version && i.decision === "REJECTED") : [];
  const prevRework = prev ? w.reworks.filter((r) => r.versionNo === prev.version) : [];
  const fixState = (i: ItemReview) => {
    if (i.kind === "PHOTO") return cur.photoIds.includes(i.ref) ? "Not replaced" : "Replaced";
    const a = prev?.mediaItems.find((m) => m.key === i.ref);
    const b = cur.mediaItems.find((m) => m.key === i.ref);
    return !b ? "Removed" : changedFields(a, b).length ? "Updated" : "Unchanged";
  };
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Section title="Approval Summary">
        <div className="space-y-3">
          {cur.stages.map((st) => {
            const r = cur.reviews.find((x) => x.stage === st);
            return (
              <div key={st} className="rounded-lg border border-[#EEF2F7] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#172B4D]">{STAGE_NAME[st]} Review</p>
                  <Pill look={DECISION_LOOK[r?.decision ?? "PENDING"]} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-[#64748B]">Reviewer</dt><dd className="text-[#172B4D]">{r?.reviewer ?? (w.reviewers[st]?.name ? `${w.reviewers[st]!.name} (assigned)` : "-")}</dd>
                  <dt className="text-[#64748B]">Reviewed</dt><dd className="text-[#172B4D]">{fmtDateTime(r?.decidedAt)}</dd>
                  <dt className="text-[#64748B]">Rejected items</dt><dd className={cn("font-semibold", rejectedCount(curItems, st) ? "text-[#B91C1C]" : "text-[#172B4D]")}>{rejectedCount(curItems, st)}</dd>
                </dl>
                {r?.comment && <p className="mt-2 rounded-md bg-[#F8FAFC] px-2 py-1.5 text-xs text-[#334155]">{r.comment}</p>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Rejection Reasons" extra={`(V${cur.version})`}>
        {rejectedNow.length === 0 ? <p className="text-sm text-muted-foreground">No photo or measurement is rejected in this version.</p> : (
          <ul className="space-y-2">
            {rejectedNow.map((i) => (
              <li key={i.id} className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs">
                <p className="font-semibold text-[#991B1B]">{title(i)} <span className="font-normal">· Rejected by {STAGE_NAME[i.stage]}</span></p>
                <p className="mt-0.5 text-[#7F1D1D]">{i.reason}</p>
                <p className="mt-0.5 text-[#991B1B]/80">{i.reviewer ?? "-"} · {fmtDateTime(i.decidedAt)}</p>
              </li>
            ))}
          </ul>
        )}
        {prev && (prevRejected.length > 0 || prevRework.length > 0) && (
          <div className="mt-4 border-t border-[#EEF2F7] pt-3">
            <p className="mb-2 text-xs font-semibold text-[#172B4D]">Previous feedback (V{prev.version}) → this version</p>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-[#EEF2F7]">
                {prevRejected.map((i) => {
                  const s = fixState(i);
                  return (
                    <tr key={i.id}>
                      <td className="py-1.5 pr-2"><p className="font-medium text-[#172B4D]">{title(i)}</p><p className="text-[#64748B]">{STAGE_NAME[i.stage]}: {i.reason}</p></td>
                      <td className="py-1.5 text-right"><span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 font-medium", s === "Replaced" || s === "Updated" ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFFBEB] text-[#B45309]")}>{s}</span></td>
                    </tr>
                  );
                })}
                {prevRework.flatMap((r) => r.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-1.5 pr-2"><p className="font-medium text-[#172B4D]">{it.categoryLabel ?? (it.mediaKey ? boardLabel(it.mediaKey) : it.type.replace(/_/g, " ").toLowerCase())}</p><p className="text-[#64748B]">{r.stageLabel}: {it.note || r.instructions}</p></td>
                    <td className="py-1.5 text-right"><span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 font-medium", it.resolved ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFFBEB] text-[#B45309]")}>{it.resolved ? "Corrected" : "Open"}</span></td>
                  </tr>
                )))}
              </tbody>
            </table>
            <Button variant="outline" size="sm" className="mt-3" onClick={c.openCompare}>Compare V{prev.version} vs V{cur.version}</Button>
          </div>
        )}
      </Section>

      <Section title="Site Photos" extra={`(${photos.length})`} action={<button type="button" className="text-xs font-medium text-loss hover:underline" onClick={() => goTo("photos")}>Review all</button>}>
        {photos.length === 0 ? <p className="text-sm text-muted-foreground">No photos in this version.</p> : (
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 6).map((p) => {
              const its = c.itemsOf("PHOTO", p.id);
              return (
                <button key={p.id} type="button" onClick={() => goTo("photos")} className="group relative overflow-hidden rounded-lg border border-[#E2E8F0] text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link */}
                  {p.url ? <img src={p.editedUrl ?? p.url} alt={catLabel(p.category)} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-[#F1F5F9]" />}
                  <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#172B4D]">{catLabel(p.category)}</span>
                  {its.some((i) => i.decision === "REJECTED") ? <XCircle className="absolute right-1 top-1 size-4 rounded-full bg-white text-loss" aria-label="Rejected" /> : its.length ? <CheckCircle2 className="absolute right-1 top-1 size-4 rounded-full bg-white text-finance" aria-label="Approved" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Measurements & Media Summary" className="xl:col-span-2" action={<button type="button" className="text-xs font-medium text-loss hover:underline" onClick={() => goTo("measurements")}>Review</button>}>
        <BoardTable c={c} compact />
      </Section>

      <Section title="Key Visit Information">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[#64748B]">Captured by</dt><dd className="font-medium text-[#172B4D]">{w.assignee ?? "-"}{w.channel ? ` (${w.channel === "VENDOR" ? "Vendor" : "Inhouse"})` : ""}</dd>
          <dt className="text-[#64748B]">Submitted</dt><dd className="font-medium text-[#172B4D]">{fmtDateTime(cur.submittedAt)}</dd>
          <dt className="text-[#64748B]">Submitted by</dt><dd className="font-medium text-[#172B4D]">{cur.submittedBy ?? "-"}</dd>
          <dt className="text-[#64748B]">Attempts</dt><dd className="font-medium text-[#172B4D]">{w.attempts}</dd>
          <dt className="text-[#64748B]">Review due</dt><dd className={cn("font-medium", w.overdue ? "text-[#B91C1C]" : "text-[#172B4D]")}>{fmtDateTime(w.dueAt)}{w.overdue ? " (overdue)" : ""}</dd>
          {cur.notes && <><dt className="text-[#64748B]">Notes</dt><dd className="text-[#172B4D]">{cur.notes}</dd></>}
        </dl>
      </Section>
    </div>
  );
}

/* ------------------------------------------------ photos ------------------------------------------------ */

export function PhotosTab({ c }: { c: ReviewCtx }) {
  const { photos, cur, catLabel, canAct, stage, busy } = c;
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return <EmptyState title="No photos" description="This version has no photos." />;
  const lb = photos.map((p) => ({ id: p.id, src: p.editedUrl ?? p.url, title: catLabel(p.category), subtitle: p.caption || undefined, facts: [`Uploaded by ${p.uploadedBy ?? "-"}`, `Captured ${fmtDateTime(p.capturedAt)}`, `GPS ${fmtGps(p.lat, p.lng)}`, `Version V${p.version ?? cur.version}`] }));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {photos.map((p, idx) => {
          const its = c.itemsOf("PHOTO", p.id);
          const mine = its.find((i) => i.stage === stage);
          const rejected = its.some((i) => i.decision === "REJECTED");
          const isNew = cur.version > 1 && cur.addedIds.includes(p.id);
          return (
            <article key={p.id} className={cn("flex flex-col overflow-hidden rounded-xl border bg-white", rejected ? "border-[#FCA5A5]" : "border-[#E2E8F0]")}>
              <button type="button" onClick={() => setOpen(idx)} className="relative block" aria-label={`Open ${catLabel(p.category)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link */}
                {p.url ? <img src={p.editedUrl ?? p.url} alt={catLabel(p.category)} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-[#F1F5F9]" />}
                <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-xs font-semibold text-[#172B4D]">{catLabel(p.category)}</span>
                {isNew && <span className="absolute right-2 top-2 rounded-md bg-[#2563EB] px-2 py-0.5 text-[11px] font-semibold text-white">{p.replaces ? "Retaken" : "New"} in V{cur.version}</span>}
              </button>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="text-xs text-[#475569]">
                  <p>Uploaded by <b className="text-[#172B4D]">{p.uploadedBy ?? "-"}</b> · V{p.version ?? cur.version}</p>
                  <GpsLine lat={p.lat} lng={p.lng} at={p.capturedAt} />
                  {p.flags.length > 0 && <p className="mt-0.5 text-[#B45309]">{p.flags.map((f) => f.message).join(" · ")}</p>}
                </div>
                <ItemDecisions list={its} />
                {canAct && <div className="mt-auto"><ItemActions mine={mine} busy={busy} onApprove={() => c.approveItem("PHOTO", p.id)} onReject={() => c.rejectItem("PHOTO", p.id, catLabel(p.category))} onClear={() => c.clearItem("PHOTO", p.id)} /></div>}
              </div>
            </article>
          );
        })}
      </div>
      <PhotoLightbox photos={lb} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}

/* ------------------------------------------------ measurements ------------------------------------------------ */

function BoardTable({ c, compact }: { c: ReviewCtx; compact?: boolean }) {
  const { cur, prev, photos, canAct, stage, busy } = c;
  if (!cur.mediaItems.length) return <p className="text-sm text-muted-foreground">No boards recorded in this version.</p>;
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", compact ? "min-w-[640px]" : "min-w-[1000px]")}>
        <thead className="bg-[#F8FAFC] text-left text-xs font-semibold text-[#475569]">
          <tr>
            <th className="px-3 py-2">Board</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Width</th><th className="px-3 py-2 text-right">Height</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2 text-right">Qty</th>
            {!compact && <><th className="px-3 py-2">Installation</th><th className="px-3 py-2">Evidence</th></>}
            <th className="px-3 py-2">Review</th>
            {!compact && canAct && <th className="px-3 py-2">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEF2F7] align-top">
          {cur.mediaItems.map((m, idx) => {
            const old = prev?.mediaItems.find((x) => x.key === m.key);
            const diff = changedFields(old, m);
            const was = (f: (typeof MEASURE_FIELDS)[number]) => (diff.includes(f) && old ? <span className="block text-[11px] text-[#B45309] line-through" title={`V${prev!.version}`}>{f === "width" || f === "height" || f === "quantity" ? num(old[f] as number) : String(old[f] ?? "-")}</span> : null);
            const its = c.itemsOf("MEASUREMENT", m.key);
            const evidence = photos.filter((p) => p.mediaKey === m.key);
            return (
              <tr key={m.key} className={cn(its.some((i) => i.decision === "REJECTED") && "bg-[#FFF7F7]")}>
                <td className="px-3 py-2 font-medium text-[#172B4D]">Board {idx + 1}{prev && !old && <span className="ml-1 rounded bg-[#EFF6FF] px-1 text-[10px] text-[#1D4ED8]">New</span>}{diff.length > 0 && <span className="ml-1 rounded bg-[#FFFBEB] px-1 text-[10px] text-[#B45309]">Updated</span>}</td>
                <td className="px-3 py-2"><span className="rounded-md bg-[#FEF2F2] px-1.5 py-0.5 text-xs font-medium text-[#B91C1C]">{m.name}</span>{was("name")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(m.width)}{was("width")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(m.height)}{was("height")}</td>
                <td className="px-3 py-2">{m.unit ?? "FT"}{was("unit")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.quantity ?? 1}{was("quantity")}</td>
                {!compact && (
                  <>
                    <td className="max-w-48 px-3 py-2 text-xs text-[#475569]">{[m.sided && `${m.sided.toLowerCase()} sided`, m.condition?.toLowerCase(), m.position, m.installationNotes].filter(Boolean).join(" · ") || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {evidence.slice(0, 3).map((p) =>
                          // eslint-disable-next-line @next/next/no-img-element -- signed storage link
                          p.url ? <img key={p.id} src={p.editedUrl ?? p.url} alt={c.catLabel(p.category)} title={c.catLabel(p.category)} loading="lazy" className="size-10 rounded border border-[#E2E8F0] object-cover" /> : null,
                        )}
                        {!evidence.length && <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                    </td>
                  </>
                )}
                <td className="min-w-48 px-3 py-2">{its.length ? <ItemDecisions list={its} /> : <span className="text-xs text-muted-foreground">Not reviewed</span>}</td>
                {!compact && canAct && <td className="px-3 py-2"><ItemActions mine={its.find((i) => i.stage === stage)} busy={busy} onApprove={() => c.approveItem("MEASUREMENT", m.key)} onReject={() => c.rejectItem("MEASUREMENT", m.key, `Board ${idx + 1} – ${m.name}`)} onClear={() => c.clearItem("MEASUREMENT", m.key)} /></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MeasurementsTab({ c }: { c: ReviewCtx }) {
  return (
    <div className="space-y-3">
      {c.prev && <p className="text-xs text-[#64748B]">Struck-through values are from V{c.prev.version}; the current V{c.cur.version} value is shown above them.</p>}
      <BoardTable c={c} />
    </div>
  );
}

/* ------------------------------------------------ 2D / 3D, boards, installation ------------------------------------------------ */

export function DrawingsTab({ c }: { c: ReviewCtx }) {
  const marked = c.photos.filter((p) => p.hasEdited && p.editedUrl);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-[#F8FAFC] p-3 text-xs text-[#475569]"><Box className="mr-1 inline size-3.5" aria-hidden />2D view shows the marked-up (annotated) photos from the recce. A 3D model is not generated for recce submissions, so none is shown.</p>
      {marked.length === 0 ? <EmptyState title="No 2D drawings" description="No photo of this version was marked up." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {marked.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setOpen(i)} className="overflow-hidden rounded-xl border border-[#E2E8F0] text-left">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link */}
              <img src={p.editedUrl!} alt={`${c.catLabel(p.category)} marked up`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <p className="px-3 py-2 text-sm font-medium text-[#172B4D]">{c.catLabel(p.category)}</p>
            </button>
          ))}
        </div>
      )}
      <PhotoLightbox photos={marked.map((p) => ({ id: p.id, src: p.editedUrl, title: c.catLabel(p.category) }))} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />
    </div>
  );
}

export function BoardsTab({ c }: { c: ReviewCtx }) {
  const { cur, w } = c;
  if (!cur.mediaItems.length) return <EmptyState title="No boards" description="No board details in this version." />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cur.mediaItems.map((m, i) => (
        <div key={m.key} className="rounded-xl border border-[#E2E8F0] p-4">
          <p className="flex items-center justify-between text-sm font-semibold text-[#172B4D]">Board {i + 1}<span className="rounded-md bg-[#FEF2F2] px-1.5 py-0.5 text-xs text-[#B91C1C]">{m.name}</span></p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {([["Size", `${num(m.width)} × ${num(m.height)} ${m.unit ?? "FT"}`], ["Quantity", String(m.quantity ?? 1)], ["Sided", m.sided ? m.sided.toLowerCase() : "-"], ["Condition", m.condition ? m.condition.toLowerCase() : "-"], ["Position", m.position || "-"], ["Installation notes", m.installationNotes || "-"], ["Notes", m.notes || "-"]] as const).map(([l, v]) => (
              <div key={l} className="contents"><dt className="text-[#64748B]">{l}</dt><dd className="break-words text-[#172B4D]">{v}</dd></div>
            ))}
          </dl>
        </div>
      ))}
      {w.shop.boardType && <p className="text-xs text-[#64748B] md:col-span-2 xl:col-span-3">Board type on the shop list: {w.shop.boardType}</p>}
    </div>
  );
}

const INSTALL_LABEL: Record<string, string> = {
  ladderRequired: "Ladder required", scaffoldingRequired: "Scaffolding required", craneRequired: "Crane required", hydraRequired: "Hydra required", manualInstallationPossible: "Manual installation possible",
  electricalAccess: "Electrical point", installationHeightFt: "Installation height (ft)", accessRestrictions: "Access restrictions", obstruction: "Obstruction", roadsideConstraints: "Roadside constraints",
  safetyNotes: "Safety notes", additionalEquipment: "Additional equipment", notes: "Notes",
};
const triLook = (v: string) => (v === "YES" || v === "AVAILABLE" ? "bg-[#ECFDF5] text-[#047857]" : v === "NO" || v === "NOT_AVAILABLE" ? "bg-[#FEF2F2] text-[#B91C1C]" : "bg-[#F1F5F9] text-[#475569]");

export function InstallationTab({ c }: { c: ReviewCtx }) {
  const { cur } = c;
  if (!cur.installationRecorded) return <EmptyState title="Not recorded" description="This version was submitted before installation details were captured." />;
  const ins = cur.installation;
  return (
    <div className="overflow-x-auto">
      <table className="w-full max-w-3xl text-sm">
        <tbody className="divide-y divide-[#EEF2F7]">
          {Object.keys(INSTALL_LABEL).map((k) => {
            const v = ins[k];
            const text = Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "-" : String(v);
            const tri = typeof v === "string" && /^(YES|NO|NOT_ASSESSED|AVAILABLE|NOT_AVAILABLE)$/.test(v);
            return (
              <tr key={k}>
                <th scope="row" className="w-64 py-2 pr-4 text-left font-medium text-[#475569]">{INSTALL_LABEL[k]}</th>
                <td className="py-2">{tri ? <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", triLook(v as string))}>{(v as string).replace(/_/g, " ").toLowerCase()}</span> : <span className="text-[#172B4D]">{text || "-"}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------ checklist ------------------------------------------------ */

export function ChecklistTab({ c }: { c: ReviewCtx }) {
  const { w, cur, stage, canAct, checks, setChecks } = c;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {stage && (
        <Section title={`${STAGE_NAME[stage]} checklist`} extra={canAct ? "(ticked items are used when you approve)" : undefined}>
          <div className="space-y-1.5">
            {w.checklist.map((i) => (
              <label key={i.key} className={cn("flex items-center gap-2 rounded-md border border-[#EEF2F7] px-3 py-2 text-sm", !canAct && "opacity-70")}>
                <input type="checkbox" className="size-4 accent-[#059669]" disabled={!canAct} checked={!!checks[i.key]} onChange={(e) => setChecks((s) => ({ ...s, [i.key]: e.target.checked }))} />
                {i.label}{i.required === false && <span className="text-xs text-muted-foreground">(optional)</span>}
              </label>
            ))}
          </div>
        </Section>
      )}
      <Section title="Submitted checklists" extra={`(V${cur.version})`}>
        {cur.reviews.filter((r) => r.checklist.length).length === 0 ? <p className="text-sm text-muted-foreground">No stage has submitted its checklist yet.</p> : (
          <div className="space-y-3">
            {cur.reviews.filter((r) => r.checklist.length).map((r) => (
              <div key={r.stage}>
                <p className="mb-1 text-xs font-semibold text-[#172B4D]">{STAGE_NAME[r.stage as ReviewStage]} · {r.reviewer ?? "-"} · {fmtDateTime(r.decidedAt)}</p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {r.checklist.map((x) => <li key={x.key} className="flex items-center gap-1.5 text-xs text-[#334155]">{x.passed ? <CheckCircle2 className="size-3.5 text-finance" aria-hidden /> : <XCircle className="size-3.5 text-loss" aria-hidden />}{x.label}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------ comments, audit ------------------------------------------------ */

export function CommentsTab({ c }: { c: ReviewCtx }) {
  const toast = useToast();
  const thread = useShopThread(c.w.id);
  const send = useSendShopMessage(c.w.id);
  const [text, setText] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="max-h-[60dvh] min-h-48 overflow-y-auto rounded-xl border border-[#EEF2F7] p-3">
        {thread.isPending ? <RowsSkeleton rows={4} /> : thread.isError ? <ErrorState error={thread.error} onRetry={() => thread.refetch()} /> : !thread.data?.length ? <EmptyState title="No comments yet" /> : (
          <ul className="space-y-3">
            {thread.data.map((m) => (
              <li key={m.id} className="flex gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#FEF2F2] text-xs font-bold text-loss">{m.author.name.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs"><b className="text-[#172B4D]">{m.author.name}</b> <span className="text-[#64748B]">· {m.author.role.replace(/_/g, " ").toLowerCase()} · {fmtDateTime(m.createdAt)}</span></p>
                  {m.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#334155]">{m.body}</p>}
                  {m.card && (
                    <div className="mt-1 rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] p-2 text-xs">
                      <p className="font-semibold text-[#172B4D]">{m.card.title}</p>
                      {m.card.lines.map((l) => <p key={l.label} className="text-[#475569]"><span className="text-[#64748B]">{l.label}:</span> {l.value}</p>)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => { e.preventDefault(); const b = text.trim(); if (!b) return; send.mutate(b, { onSuccess: () => setText(""), onError: (er) => toast(errorMessage(er), "error") }); }}
      >
        <label className="block text-sm font-medium">Add a comment<Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} className="mt-1.5" placeholder="Visible to reviewers and the recce team" /></label>
        <Button type="submit" loading={send.isPending} disabled={!text.trim()}><Send className="size-4" aria-hidden /> Send</Button>
      </form>
    </div>
  );
}

export function AuditTab({ c }: { c: ReviewCtx }) {
  const t = useTimeline(c.w.id, {});
  if (t.isPending) return <RowsSkeleton rows={6} />;
  if (t.isError) return <ErrorState error={t.error} onRetry={() => t.refetch()} />;
  if (!t.data?.length) return <EmptyState title="No activity yet" />;
  return (
    <ol className="relative ml-2 space-y-3 border-l border-[#E2E8F0] pl-5">
      {t.data.map((e) => {
        const bad = /REJECT|REWORK/.test(e.type);
        const good = /APPROV/.test(e.type);
        return (
          <li key={e.id} className="relative">
            <span className={cn("absolute -left-[27px] top-1 size-3 rounded-full ring-4 ring-white", bad ? "bg-loss" : good ? "bg-finance" : "bg-royal")} aria-hidden />
            <p className="text-sm font-medium text-[#172B4D]">{e.label}{e.version ? <span className="ml-1 text-xs font-normal text-[#64748B]">V{e.version}</span> : null}</p>
            <p className="text-xs text-[#64748B]">{e.actor}{e.role ? ` (${e.role.replace(/_/g, " ").toLowerCase()})` : ""} · {fmtDateTime(e.at)}</p>
            {e.reason && <p className="mt-0.5 break-words text-xs text-[#334155]">{e.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------ version comparison ------------------------------------------------ */

const show = (v: unknown) => (v == null || v === "" ? "-" : Array.isArray(v) ? v.join(", ") || "-" : String(v));

export function CompareModal({ open, onClose, c }: { open: boolean; onClose: () => void; c: ReviewCtx }) {
  const { w, cur, catLabel } = c;
  const [from, setFrom] = useState((c.prev?.version ?? 1));
  const q = useVersionCompare(w.id, from, cur.version, open);
  const d = q.data;
  const older = w.versions.find((v) => v.version === from);
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={`Version Comparison – V${from} vs V${cur.version}`} className="sm:max-w-3xl">
      {w.versions.length > 2 && (
        <label className="mb-3 flex items-center gap-2 text-sm">Compare from
          <select value={from} onChange={(e) => setFrom(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-sm">
            {w.versions.filter((v) => v.version < cur.version).map((v) => <option key={v.version} value={v.version}>V{v.version}</option>)}
          </select>
        </label>
      )}
      {q.isPending ? <Skeleton className="h-48" /> : q.isError || !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !d.changed ? <p className="text-sm text-muted-foreground">No change between these versions.</p> : (
        <div className="space-y-4 text-sm">
          {older && older.reviews.some((r) => r.comment) && (
            <div>
              <p className="mb-1 font-semibold text-[#172B4D]">V{from} reviewer comments</p>
              {older.reviews.filter((r) => r.comment).map((r) => <p key={r.stage} className="rounded-md bg-[#FEF2F2] px-2.5 py-1.5 text-xs text-[#991B1B]"><b>{STAGE_NAME[r.stage as ReviewStage]}:</b> {r.comment}</p>)}
            </div>
          )}
          {(d.photos.replaced.length > 0 || d.photos.added.length > 0 || d.photos.removed.length > 0) && (
            <div>
              <p className="mb-1 font-semibold text-[#172B4D]">Photos</p>
              <ul className="space-y-1 text-xs">
                {d.photos.replaced.map((r) => <li key={r.to.id} className="rounded-md bg-[#ECFDF5] px-2.5 py-1.5 text-[#065F46]">Retaken: {catLabel(r.to.category)}</li>)}
                {d.photos.added.map((p) => <li key={p.id} className="rounded-md bg-[#EFF6FF] px-2.5 py-1.5 text-[#1E40AF]">Added: {catLabel(p.category)}</li>)}
                {d.photos.removed.map((p) => <li key={p.id} className="rounded-md bg-[#F1F5F9] px-2.5 py-1.5 text-[#475569]">Removed: {catLabel(p.category)}</li>)}
              </ul>
            </div>
          )}
          {(d.mediaItems.changed.length > 0 || d.mediaItems.added.length > 0 || d.mediaItems.removed.length > 0) && (
            <div>
              <p className="mb-1 font-semibold text-[#172B4D]">Measurements / boards</p>
              <table className="w-full text-xs">
                <thead className="text-left text-[#64748B]"><tr><th className="py-1">Board</th><th className="py-1">Field</th><th className="py-1">V{from}</th><th className="py-1">V{cur.version}</th></tr></thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {d.mediaItems.changed.flatMap((ch) => ch.fields.map((f) => <tr key={`${ch.key}-${f.field}`}><td className="py-1">{c.boardLabel(ch.key)}</td><td className="py-1">{f.field}</td><td className="py-1 text-[#B91C1C]">{show(f.from)}</td><td className="py-1 font-medium text-[#047857]">{show(f.to)}</td></tr>))}
                  {d.mediaItems.added.map((b) => <tr key={`a-${b.key}`}><td className="py-1">{b.name}</td><td className="py-1" colSpan={3}>Added ({show(b.width)} × {show(b.height)} {b.unit ?? ""})</td></tr>)}
                  {d.mediaItems.removed.map((b) => <tr key={`r-${b.key}`}><td className="py-1">{b.name}</td><td className="py-1" colSpan={3}>Removed</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          {d.installation.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-[#172B4D]">Installation & access</p>
              <ul className="space-y-0.5 text-xs">{d.installation.map((f) => <li key={f.field}>{INSTALL_LABEL[f.field] ?? f.field}: <span className="text-[#B91C1C]">{show(f.from)}</span> → <span className="font-medium text-[#047857]">{show(f.to)}</span></li>)}</ul>
            </div>
          )}
          {d.notes && <p className="text-xs">Notes: <span className="text-[#B91C1C]">{d.notes.from || "-"}</span> → <span className="text-[#047857]">{d.notes.to || "-"}</span></p>}
        </div>
      )}
    </Modal>
  );
}
