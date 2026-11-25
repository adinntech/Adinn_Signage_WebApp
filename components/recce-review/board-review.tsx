"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Camera, Check, ChevronDown, Hash, Layers, MessageSquare, RefreshCcw, Ruler, RotateCcw, ShieldX, Wrench } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TabPanel, Tabs, type TabDef } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { boardLabel, useMarks, type BoardField, type BoardItem, type MarkDecision, type MarkTarget, type ReviewStage, type Workspace, type WsMark, type WsPhoto, type WsVersion } from "@/lib/api/recceReview";
import { BoardFacts, InstallationPanel, RemarksPanel, type RemarkRow } from "./board-details";
import { STAGE_LABEL, fmtDate } from "./common";
import { resubmittedByField, resubmittedByPhoto, resubmittedItems } from "./resubmitted";

/**
 * Boards view of the review workspace. A row of board tabs (Board 1 GSB-01, Board 2 ...) picks ONE board; its card has a header (media type,
 * quantity, size, status) and four tabs: Angle Photos, Details & Measurements, Installation, Remarks.
 *
 * The reviewer ticks photos and / or board details (on any tab) and marks them Approved, Rejected or Rework with the action bar under the tabs.
 * A remark is mandatory for Rejected and Rework, and EACH selected item has its own remark (not one overall remark). Each tile shows what BOTH
 * stages said (the other team's answer is visible too), and the Remarks tab keeps the version-by-version history of every change.
 * Every board card stays mounted (the others are hidden), so a selection and the remarks typed for it survive a switch to another board.
 */

type Shown = MarkDecision | "PENDING";
const SHOWN: Record<Shown, { label: string; tone: Tone }> = {
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REWORK: { label: "Rework", tone: "warning" },
  PENDING: { label: "Pending", tone: "neutral" },
};
const SHORT: Record<ReviewStage, string> = { OPS: "Ops", CS: "CS" };
const FIELD_LABEL: Record<BoardField, string> = { MEDIA_TYPE: "Media type", QUANTITY: "Quantity", SIZE: "Size" };
const FIELDS = ["MEDIA_TYPE", "QUANTITY", "SIZE"] as const satisfies readonly BoardField[];
const MAX_REASON = 500;
const LOOSE = "__other__";

const keyOf = (t: MarkTarget) => (t.kind === "PHOTO" ? `p:${t.photo}` : t.kind === "CHECK" ? `c:${t.key}` : `b:${t.mediaKey}:${t.field}`);
const matches = (m: WsMark, t: MarkTarget) => (t.kind === "PHOTO" ? m.photo === t.photo : t.kind === "CHECK" ? m.check === t.key : !m.photo && !m.check && m.mediaKey === t.mediaKey && m.field === t.field);

/** What one stage says about one thing in one version: its own mark, else Approved when the stage approved the whole version, else Pending. */
export function stageAnswer(w: Workspace, version: WsVersion, stage: ReviewStage, t: MarkTarget): { decision: Shown; reason: string; sent: boolean } {
  const m = w.marks.find((x) => x.versionNo === version.version && x.stage === stage && matches(x, t));
  if (m) return { decision: m.decision, reason: m.reason, sent: m.sent };
  const approved = version.reviews.find((r) => r.stage === stage)?.decision === "APPROVED";
  return { decision: approved ? "APPROVED" : "PENDING", reason: "", sent: false };
}

/** This stage's Rejected / Rework marks of one version that were not sent to the recce person yet. */
export const myProblems = (w: Workspace, version: number) => w.marks.filter((m) => m.stage === w.me.stage && m.versionNo === version && !m.sent && m.decision !== "APPROVED");

const photoLabel = (w: Workspace, key: string) => w.categories.find((c) => c.key === key)?.label ?? key;

/** A mark in words: "Left Side View of GSB-01" or "GSB-01 quantity". */
export function markName(w: Workspace, m: WsMark): string {
  if (m.kind === "CHECK") return m.label ?? "Checklist item";
  const photo = m.photo ? w.photos.find((p) => p.id === m.photo) : null;
  const board = w.mediaItems.find((b) => b.key === (photo ? photo.mediaKey : m.mediaKey));
  if (m.kind === "PHOTO") return `${photoLabel(w, photo?.category ?? "")}${board ? ` of ${boardLabel(board)}` : ""}`;
  return `${board ? boardLabel(board) : "Board"} ${FIELD_LABEL[m.field as BoardField].toLowerCase()}`;
}
const sizeText = (b: BoardItem) => (b.width && b.height ? `${b.width} × ${b.height} ${b.unit ?? ""}`.trim() : "Not measured");

/** Everything that can be marked on one board: its live photos and, for a real board, its media type, quantity and size. */
const targetsOf = (board: BoardItem | null, live: WsPhoto[]): MarkTarget[] => [
  ...live.map((p): MarkTarget => ({ kind: "PHOTO", photo: p.id })),
  ...(board ? FIELDS.map((field): MarkTarget => ({ kind: "BOARD", mediaKey: board.key, field })) : []),
];
const isBad = (d: Shown) => d === "REJECTED" || d === "REWORK";

/** How many things on this board either stage sent back (Rejected or Rework) in this version. */
export const flaggedIn = (w: Workspace, version: WsVersion, board: BoardItem | null, live: WsPhoto[]) =>
  targetsOf(board, live).filter((t) => version.stages.some((s) => isBad(stageAnswer(w, version, s, t).decision))).length;

/** The one status a board shows in its header: Rejected / Rework (with the count), Approved when every review approved, else Pending. */
function boardStatus(w: Workspace, version: WsVersion, board: BoardItem | null, live: WsPhoto[]): { label: string; tone: Tone } {
  const bad = targetsOf(board, live).filter((t) => version.stages.some((s) => isBad(stageAnswer(w, version, s, t).decision)));
  if (bad.length > 0) {
    const rejected = bad.some((t) => version.stages.some((s) => stageAnswer(w, version, s, t).decision === "REJECTED"));
    return { label: `${rejected ? "Rejected" : "Rework"} · ${bad.length} to fix`, tone: rejected ? "danger" : "warning" };
  }
  const reviews = version.reviews.filter((r) => r.decision !== "VOID");
  return reviews.length > 0 && reviews.every((r) => r.decision === "APPROVED") ? { label: "Approved", tone: "success" } : { label: "Pending", tone: "neutral" };
}

function Chip({ stage, a, mine }: { stage: ReviewStage; a: { decision: Shown; reason: string; sent?: boolean }; mine: boolean }) {
  const s = SHOWN[a.decision];
  // A Rework / Rejected mark is saved at once, but the recce person sees it only after the stage sends it back: say so on the chip.
  const unsent = (a.decision === "REWORK" || a.decision === "REJECTED") && a.sent === false;
  const title = [a.reason ? `${STAGE_LABEL[stage]}: ${a.reason}` : STAGE_LABEL[stage], unsent ? "Not sent to the recce person yet" : ""].filter(Boolean).join(". ");
  return (
    <Badge tone={s.tone} className={cn("text-[11px]", mine && "ring-1 ring-current")} title={title}>
      {SHORT[stage]}: {s.label}{unsent ? " · not sent" : ""}
    </Badge>
  );
}

interface Common {
  w: Workspace;
  version: WsVersion;
  canMark: boolean;
  hint: string | null;
  /** Each target carries its own remark (`reason`) for Rejected / Rework. */
  run: (decision: MarkDecision, targets: MarkTarget[], done: () => void) => void;
  busy: boolean;
  onOpenPhoto: (photoId: string) => void;
}

interface BoardTab { key: string; board: BoardItem | null; index: number; photos: WsPhoto[] }

export function BoardReview({ w, version, photos, canMark, hint, onOpenPhoto }: { w: Workspace; version: WsVersion; photos: WsPhoto[]; canMark: boolean; hint: string | null; onOpenPhoto: (photoId: string) => void }) {
  const mark = useMarks(w.id);
  const toast = useToast();
  const stage = w.me.stage;
  const [picked, setPicked] = useState<string | null>(null);
  const run: Common["run"] = (decision, targets, done) => {
    if (!stage) return;
    mark.mutate({ stage, versionNo: version.version, decision, reason: "", targets }, {
      onSuccess: () => { toast(decision === "APPROVED" ? "Marked approved" : `Marked ${decision === "REJECTED" ? "rejected" : "for rework"}. The recce person sees it after you press Send back.`); done(); },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  };
  const common: Common = { w, version, canMark, hint, run, busy: mark.isPending, onOpenPhoto };
  const boards = version.mediaItems ?? [];
  const known = new Set(boards.map((b) => b.key));
  const loose = photos.filter((p) => !known.has(p.mediaKey));
  const tabs: BoardTab[] = [
    ...boards.map((b, index) => ({ key: b.key, board: b, index, photos: photos.filter((p) => p.mediaKey === b.key) })),
    ...(loose.length > 0 ? [{ key: LOOSE, board: null, index: boards.length, photos: loose }] : []),
  ];
  if (tabs.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">No boards or photos in this version.</Card>;
  // Opens on the board that has something this stage marked and has not sent yet, else on the first board.
  const mine = myProblems(w, version.version);
  const firstKey = tabs.find((t) => mine.some((m) => m.mediaKey === t.key))?.key ?? tabs[0]!.key;
  const active = tabs.find((t) => t.key === picked) ?? tabs.find((t) => t.key === firstKey)!;

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Boards of this shop" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const on = t.key === active.key;
          const flagged = flaggedIn(w, version, t.board, t.photos.filter((p) => p.state === "SUBMITTED"));
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setPicked(t.key)}
              className={cn("relative flex min-w-36 shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring", on ? "border-primary bg-secondary" : "border-border bg-surface hover:bg-muted")}
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", flagged > 0 ? "bg-danger-soft text-danger" : "bg-primary/10 text-primary")}><Layers className="size-4" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t.board ? `Board ${t.index + 1}` : "Other photos"}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.board ? boardLabel(t.board) : "No board"}</span>
              </span>
              {flagged > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-danger" role="img" aria-label={`${flagged} to fix`} />}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={t.key !== active.key}>
          <BoardCard {...common} board={t.board} index={t.index} photos={t.photos} />
        </div>
      ))}
    </div>
  );
}

type InnerTab = "photos" | "details" | "install" | "remarks";

function BoardCard({ w, version, canMark, hint, run, busy, onOpenPhoto, board, index, photos }: Common & { board: BoardItem | null; index: number; photos: WsPhoto[] }) {
  const [open, setOpen] = useState(true);
  const [inner, setInner] = useState<InnerTab>("photos");
  const [picked, setPicked] = useState<Record<string, MarkTarget>>({});
  /** The remark of each selected item, by the item's key. */
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const stages = version.stages;
  const mine = w.me.stage;
  const live = photos.filter((p) => p.state === "SUBMITTED");
  const targets = Object.values(picked);
  const toggle = (t: MarkTarget) => setPicked((s) => { const n = { ...s }; if (keyOf(t) in n) delete n[keyOf(t)]; else n[keyOf(t)] = t; return n; });
  const pickedPhotos = live.filter((p) => `p:${p.id}` in picked).length;
  const allPhotos = live.length > 0 && pickedPhotos === live.length;
  const toggleAll = () => setPicked((s) => { const n = { ...s }; for (const p of live) { if (allPhotos) delete n[`p:${p.id}`]; else n[`p:${p.id}`] = { kind: "PHOTO", photo: p.id }; } return n; });

  const nameOf = (t: MarkTarget) => (t.kind === "PHOTO" ? photoLabel(w, photos.find((p) => p.id === t.photo)?.category ?? "") : t.kind === "BOARD" ? FIELD_LABEL[t.field] : "Checklist item");
  const act = (decision: MarkDecision) => {
    if (decision !== "APPROVED") {
      const missing = targets.find((t) => (reasons[keyOf(t)] ?? "").trim().length < 3);
      if (missing) { setError(`Write the remark for ${nameOf(missing)}. Every selected item needs its own remark to reject or ask for rework.`); return; }
    }
    setError(null);
    run(decision, decision === "APPROVED" ? targets : targets.map((t) => ({ ...t, reason: (reasons[keyOf(t)] ?? "").trim() })), () => { setPicked({}); setReasons({}); });
  };

  // Everything marked on this board in any version, with the earlier answers of each mark, newest first.
  const rows = useMemo<RemarkRow[]>(() => {
    const ids = new Set(w.photos.filter((p) => (board ? p.mediaKey === board.key : !w.mediaItems.some((b) => b.key === p.mediaKey))).map((p) => p.id));
    const out: { row: RemarkRow; at: string | null }[] = [];
    const say = (d: string | null) => (SHOWN[(d ?? "PENDING") as Shown] ?? SHOWN.PENDING).label;
    for (const m of w.marks) {
      const inBoard = m.kind === "PHOTO" ? !!m.photo && ids.has(m.photo) : !!board && m.mediaKey === board.key;
      if (!inBoard) continue;
      const what = m.kind === "PHOTO" ? photoLabel(w, w.photos.find((p) => p.id === m.photo)?.category ?? "") : FIELD_LABEL[m.field as BoardField];
      for (const [i, h] of m.history.entries()) out.push({ at: h.at, row: { key: `${m.id}:h${i}`, title: `v${m.versionNo} · ${SHORT[m.stage]} · ${what}: ${say(h.decision)}`, meta: `${h.reviewer ?? "-"} · ${fmtDate(h.at)}`, reason: h.reason } });
      out.push({ at: m.at, row: { key: m.id, title: `v${m.versionNo} · ${SHORT[m.stage]} · ${what}: ${say(m.decision)}`, meta: `${m.reviewer ?? "-"} · ${fmtDate(m.at)}`, reason: m.reason } });
    }
    return out.sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime()).map((o) => o.row);
  }, [w, board]);

  // What the recce person resubmitted in this version (answers to a rework): marked on the photo tiles and the board details.
  const resubmitted = useMemo(() => resubmittedItems(w, version.version), [w, version.version]);
  const newPhotos = useMemo(() => resubmittedByPhoto(resubmitted), [resubmitted]);
  const rechecked = useMemo(() => resubmittedByField(resubmitted), [resubmitted]);

  const status = boardStatus(w, version, board, live);
  const tabs: TabDef[] = [
    { key: "photos", label: "Angle Photos", count: photos.length, icon: Camera },
    ...(board ? [{ key: "details", label: "Details & Measurements", icon: Ruler }, { key: "install", label: "Installation", icon: Wrench }] : []),
    { key: "remarks", label: "Remarks", count: rows.length || undefined, icon: MessageSquare },
  ];

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Layers className="size-5" aria-hidden /></span>
        <span className="min-w-40 flex-1">
          <span className="block truncate font-semibold">{board ? `Board ${index + 1} – ${boardLabel(board)}` : "Other photos of this shop"}</span>
          <span className="block truncate text-xs text-muted-foreground">{board ? board.name : "Not linked to a board"} · {live.length} photo{live.length === 1 ? "" : "s"}</span>
        </span>
        {board && (
          <dl className="grid grid-cols-3 gap-4 text-center text-sm" aria-label="Board size">
            <div><dt className="text-xs text-muted-foreground">Qty</dt><dd className="font-semibold">{board.quantity ?? 1}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Width</dt><dd className="font-semibold">{board.width ? `${board.width} ${(board.unit ?? "").toLowerCase()}` : "-"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Height</dt><dd className="font-semibold">{board.height ? `${board.height} ${(board.unit ?? "").toLowerCase()}` : "-"}</dd></div>
          </dl>
        )}
        <Badge tone={status.tone}>{status.tone !== "neutral" && status.tone !== "success" && <AlertTriangle className="size-3" aria-hidden />}{status.label}</Badge>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border pb-4">
          <Tabs tabs={tabs} value={inner} onChange={(k) => setInner(k as InnerTab)} label={`Sections of ${board ? boardLabel(board) : "other photos"}`} className="border-b border-border" />
          <TabPanel k={inner} className="flex flex-col gap-4 px-4">
            {inner === "photos" && (
              <section aria-label="Angle photos">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Angle Photos</h3>
                    <p className="text-xs text-muted-foreground">{canMark ? "Select photo(s) to change the approval." : (hint ?? "You can view these photos.")}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {canMark && live.length > 1 && <button type="button" className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={toggleAll}>{allPhotos ? "Clear selection" : "Select all photos"}</button>}
                    {canMark && live.length > 0 && <span aria-live="polite">Selected: {pickedPhotos} of {live.length}</span>}
                    <span>{photos.length} Photo{photos.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                {photos.length === 0 ? <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">No photos for this board.</p> : (
                  <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                    {photos.map((p) => {
                      const t: MarkTarget = { kind: "PHOTO", photo: p.id };
                      const answers = stages.map((s) => [s, stageAnswer(w, version, s, t)] as const);
                      const bad = p.state === "SUBMITTED" && answers.some(([, a]) => isBad(a.decision));
                      const why = answers.find(([, a]) => isBad(a.decision) && a.reason);
                      const on = keyOf(t) in picked;
                      return (
                        <li key={p.id} className={cn("flex min-w-0 flex-col overflow-hidden rounded-lg border bg-surface", bad ? "border-danger bg-danger-soft/40" : on ? "border-primary" : "border-border", p.state !== "SUBMITTED" && "opacity-70")}>
                          <label className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium">
                            <input type="checkbox" disabled={!canMark || p.state !== "SUBMITTED"} checked={on} onChange={() => toggle(t)} aria-label={`Select ${photoLabel(w, p.category)}`} />
                            <span className="truncate" title={photoLabel(w, p.category)}>{photoLabel(w, p.category)}</span>
                          </label>
                          <button type="button" onClick={() => onOpenPhoto(p.id)} className="block bg-black/90 focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Open ${photoLabel(w, p.category)} full size`}>
                            {p.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.editedUrl ?? p.url} alt={`${photoLabel(w, p.category)} photo`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                            ) : <span className="flex aspect-[4/3] items-center justify-center text-xs text-white">No file</span>}
                          </button>
                          <div className="flex flex-col gap-1 p-2">
                            {newPhotos.has(p.id) && <Badge tone="info" className="w-fit" title={`Resubmitted. ${STAGE_LABEL[newPhotos.get(p.id)!.stage]} asked: ${newPhotos.get(p.id)!.asked}`}><RefreshCcw className="size-3" aria-hidden /> Resubmitted</Badge>}
                            {p.state !== "SUBMITTED" ? <Badge tone="neutral">{p.state === "REMOVED" ? "Removed" : "Replaced"}</Badge> : <div className="flex flex-wrap gap-1">{answers.map(([s, a]) => <Chip key={s} stage={s} mine={s === mine} a={a} />)}</div>}
                            {why && <p className="line-clamp-2 text-[11px] text-danger" title={why[1].reason}>{SHORT[why[0]]}: {why[1].reason}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {inner === "details" && board && (
              <section aria-label="Details and measurements" className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Details &amp; Measurements</h3>
                  <p className="text-xs text-muted-foreground">{canMark ? "Tick a detail that is wrong to ask the recce person to correct it." : (hint ?? "You can view these details.")}</p>
                </div>
                <ul className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
                  {([["MEDIA_TYPE", Hash, board.name], ["QUANTITY", Hash, `${board.quantity ?? 1}`], ["SIZE", Ruler, sizeText(board)]] as const).map(([field, Icon, value]) => {
                    const t: MarkTarget = { kind: "BOARD", mediaKey: board.key, field };
                    const bad = stages.some((s) => isBad(stageAnswer(w, version, s, t).decision));
                    return (
                      <li key={field} className={cn("rounded-lg border px-3 py-2", bad ? "border-danger bg-danger-soft/40" : keyOf(t) in picked ? "border-primary" : "border-border")}>
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" className="mt-1" disabled={!canMark} checked={keyOf(t) in picked} onChange={() => toggle(t)} aria-label={`Select ${FIELD_LABEL[field]} of ${boardLabel(board)}`} />
                          <span className="min-w-0"><span className="flex items-center gap-1 font-medium"><Icon className="size-3.5" aria-hidden />{FIELD_LABEL[field]}</span><span className="block truncate text-muted-foreground">{value}</span></span>
                        </label>
                        {rechecked.has(`${board.key}:${field}`) && <Badge tone="info" className="mt-1.5 w-fit" title={`Rechecked. ${STAGE_LABEL[rechecked.get(`${board.key}:${field}`)!.stage]} asked: ${rechecked.get(`${board.key}:${field}`)!.asked}`}><RefreshCcw className="size-3" aria-hidden /> Rechecked</Badge>}
                        <div className="mt-1.5 flex flex-wrap gap-1">{stages.map((s) => <Chip key={s} stage={s} mine={s === mine} a={stageAnswer(w, version, s, t)} />)}</div>
                      </li>
                    );
                  })}
                </ul>
                <BoardFacts board={board} />
              </section>
            )}

            {inner === "install" && board && (
              <section aria-label="Installation">
                <InstallationPanel board={board} shop={version.installation ?? w.installation} />
              </section>
            )}

            {inner === "remarks" && <RemarksPanel recceNotes={version.notes ?? ""} board={board} rows={rows} />}
          </TabPanel>

          {canMark && (
            <section className="mx-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3" aria-label="Action for selected">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-sm font-semibold">Action for Selected ({targets.length})</span>
                <Button size="sm" variant="outline" className="border-success text-success hover:bg-success-soft" disabled={targets.length === 0 || busy} onClick={() => act("APPROVED")}><Check className="size-4" aria-hidden /> Approve</Button>
                <Button size="sm" variant="destructive" disabled={targets.length === 0 || busy} onClick={() => act("REJECTED")}><ShieldX className="size-4" aria-hidden /> Reject</Button>
                <Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger-soft" disabled={targets.length === 0 || busy} onClick={() => act("REWORK")}><RotateCcw className="size-4" aria-hidden /> Request Rework</Button>
              </div>
              {targets.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select photos or board details above, then write a remark for each one to reject it or ask for rework.</p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Remark for each selected item">
                  {targets.map((t) => {
                    const k = keyOf(t);
                    const text = reasons[k] ?? "";
                    return (
                      <li key={k} className="rounded-lg border border-border bg-surface p-2">
                        <label className="block text-sm">
                          <span className="font-medium">{nameOf(t)} <span className="text-danger" aria-hidden>*</span></span>
                          <Textarea className="mt-1" rows={2} maxLength={MAX_REASON} value={text} onChange={(e) => { setReasons((r) => ({ ...r, [k]: e.target.value })); setError(null); }} placeholder="Remark for this item, e.g. Not clear, retake with the full board in view." aria-invalid={!!error && text.trim().length < 3} />
                          <span className="mt-0.5 flex justify-between text-xs text-muted-foreground"><span>Needed to reject or ask for rework. Optional when approving.</span><span>{text.length} / {MAX_REASON}</span></span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
