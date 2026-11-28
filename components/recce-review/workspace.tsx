"use client";
import { UnitReview } from "@/components/unit-review/unit-review";
import { showMobile } from "@/lib/input-format";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PhotoLightbox } from "@/components/preview/photo-lightbox";
import { AlertTriangle, ArrowLeft, Check, Columns2, MapPin, Maximize2, RotateCcw, Send, ShieldX, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import {
  useAssignReviewer, useDecide, useOverride, useReopen, useRestorePhoto, useReviewers, useSendShopMessage, useShopThread, useStartReview, useTimeline, useWorkspace,
  type DecisionInput, type WsPhoto, type Workspace,
} from "@/lib/api/recceReview";
import { DecisionBadge, OverdueBadge, STAGE_LABEL, StatusBadge, fmtDate } from "./common";

type RightTab = "review" | "rework" | "activity" | "chat";

/** Full-screen photo review workspace: shop and versions on the left, photo viewer in the centre, decisions and history on the right. */
export function ReviewWorkspace() {
  const { id } = useParams<{ id: string }>();
  const q = useWorkspace(id);
  const start = useStartReview(id);
  const [ver, setVer] = useState<number | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [tab, setTab] = useState<RightTab>("review");
  const [full, setFull] = useState<number | null>(null);

  const w = q.data;
  const cur = ver ?? w?.currentVersion ?? 1;
  // Opening a submission that waits for my stage marks the review as started (once).
  useEffect(() => {
    if (w && w.me.openStage && w.me.openStage === w.me.stage && w.status === "SUBMITTED") start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.id, w?.status, w?.me.openStage]);

  const version = w?.versions.find((v) => v.version === cur);
  const photos = useMemo(() => {
    if (!w || !version) return [] as WsPhoto[];
    const inVersion = new Set(version.photoIds);
    return w.photos.filter((p) => inVersion.has(p.id) || (showRemoved && p.state !== "SUBMITTED"));
  }, [w, version, showRemoved]);
  const active = photos.find((p) => p.id === photoId) ?? photos[0] ?? null;
  const prevVersion = w?.versions.find((v) => v.version === cur - 1);

  if (q.isPending) return <div className="grid gap-4 lg:grid-cols-[18rem_1fr_24rem]"><Skeleton className="h-[70dvh]" /><Skeleton className="h-[70dvh]" /><Skeleton className="h-[70dvh]" /></div>;
  if (q.isError || !w) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not open this submission" />;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link href="/recce-review"><ArrowLeft className="size-4" aria-hidden /> Inbox</Link></Button>
        <h1 className="text-lg font-semibold text-primary">{w.shop.name ?? w.shop.code}</h1>
        <span className="text-sm text-muted-foreground">{w.project.code} · {w.project.client ?? ""}</span>
        <StatusBadge status={w.status} />
        {w.overdue && <OverdueBadge />}
        {w.project.closed && <Badge tone="neutral">Project closed</Badge>}
      </header>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        {/* LEFT: project, shop, media types, versions */}
        <aside className="flex flex-col gap-3 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto" aria-label="Project and shop information">
          <Card className="p-4 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shop</p>
            <p className="mt-1 font-medium">{w.shop.name ?? "-"} <span className="text-muted-foreground">({w.shop.code})</span></p>
            <p className="text-muted-foreground">{w.shop.address || "-"}</p>
            <p className="mt-1">{w.shop.district ?? ""}</p>
            {w.shop.contactPerson && <p>{w.shop.contactPerson}{w.shop.mobile ? ` · ${showMobile(w.shop.mobile)}` : ""}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Recce by {w.assignee ?? "-"} ({w.channel === "VENDOR" ? "vendor" : "in-house"})</p>
            <p className="text-xs text-muted-foreground">{w.project.name}</p>
          </Card>
          <Card className="p-4 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Media types</p>
            <ul className="mt-2 flex flex-col gap-2">
              {w.mediaItems.map((m) => (
                <li key={m.key} className="rounded-lg border border-border px-3 py-2">
                  <p className="font-medium">{m.name} × {m.quantity ?? 1}</p>
                  <p className="text-xs text-muted-foreground">{m.width && m.height ? `${m.width} × ${m.height} ${m.unit ?? ""}` : "No measurement"}</p>
                  {m.notes && <p className="text-xs">{m.notes}</p>}
                </li>
              ))}
            </ul>
            {w.notes && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs"><span className="font-medium">Recce notes:</span> {w.notes}</p>}
          </Card>
          <Card className="p-4 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submission versions</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {[...w.versions].reverse().map((v) => (
                <li key={v.id}>
                  <button onClick={() => { setVer(v.version); setPhotoId(null); }} aria-current={v.version === cur} className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${v.version === cur ? "border-primary bg-secondary" : "border-border hover:bg-muted"}`}>
                    <span className="flex items-center justify-between"><span className="font-medium">Version {v.version}</span>{v.version === w.currentVersion && <Badge tone="info">Current</Badge>}</span>
                    <span className="block text-xs text-muted-foreground">{fmtDate(v.submittedAt)} · {v.photoIds.length} photos{v.addedIds.length ? ` · +${v.addedIds.length} new` : ""}</span>
                    <span className="mt-1 flex flex-wrap gap-1">{v.reviews.map((r) => <span key={r.stage} className="text-[11px]">{r.stage}: <DecisionBadge decision={r.decision} /></span>)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <ReviewerAssign w={w} />
        </aside>

        {/* CENTER: viewer */}
        <section className="flex min-w-0 flex-col gap-3" aria-label="Photo viewer">
          <Card className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
            <Button size="sm" variant={compare ? "default" : "outline"} disabled={!prevVersion} onClick={() => setCompare((c) => !c)} aria-pressed={compare}><Columns2 className="size-4" aria-hidden /> Compare with v{cur - 1}</Button>
            <label className="ml-auto flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> Show removed / replaced photos</label>
          </Card>
          {!active ? <Card><EmptyState title="No photos in this version" /></Card> : compare && prevVersion ? (
            <Compare w={w} cur={version?.photoIds ?? []} prev={prevVersion.photoIds} />
          ) : (
            <Viewer key={active.id} photo={active} w={w} onOpen={() => setFull(photos.findIndex((p) => p.id === active.id))} />
          )}
          <PhotoLightbox index={full} onIndexChange={setFull} onClose={() => setFull(null)} photos={photos.map((p) => lightboxItem(p, w))} />
          <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Photos of this version">
            {photos.map((p) => (
              <button key={p.id} role="option" aria-selected={p.id === active?.id} onClick={() => { setPhotoId(p.id); setCompare(false); }} className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-ring ${p.id === active?.id ? "border-primary" : "border-border"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url ? <img src={p.editedUrl ?? p.url} alt={`${label(w, p.category)} photo`} loading="lazy" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-xs text-muted-foreground">No file</span>}
                {version?.addedIds.includes(p.id) && <span className="absolute left-1 top-1 rounded bg-success px-1 text-[10px] font-medium text-white">NEW</span>}
                {p.state !== "SUBMITTED" && <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 text-[10px] text-white">{p.state === "REMOVED" ? "Removed" : "Replaced"}</span>}
                {p.flags.length > 0 && <AlertTriangle className="absolute right-1 top-1 size-4 text-warning" aria-label="Metadata warning" />}
              </button>
            ))}
          </div>
          {active && <PhotoFacts photo={active} w={w} />}
        </section>

        {/* RIGHT: checklist, decisions, history */}
        <aside className="flex min-h-0 flex-col gap-3 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto" aria-label="Review actions">
          <Tabs tabs={[{ key: "review", label: "Review" }, { key: "rework", label: "Rework", count: w.reworks.filter((r) => r.status === "OPEN").length || undefined }, { key: "activity", label: "Activity" }, { key: "chat", label: "Chat" }]} value={tab} onChange={(k) => setTab(k as RightTab)} label="Review sections" />
          {tab === "review" && <ReviewPanel w={w} cur={cur} photos={photos} />}
          {tab === "rework" && <ReworkList w={w} />}
          {tab === "activity" && <Activity id={id} />}
          {tab === "chat" && <Chat id={id} />}
        </aside>
      </div>
    </div>
  );
}

const label = (w: Workspace, key: string) => w.categories.find((c) => c.key === key)?.label ?? key;

const lightboxItem = (p: WsPhoto, w: Workspace) => ({
  id: p.id,
  src: p.editedUrl ?? p.url,
  title: `${label(w, p.category)} · ${w.shop.name ?? w.shop.code}`,
  subtitle: p.caption || undefined,
  facts: [
    `Captured: ${fmtDate(p.capturedAt)}`,
    `Uploaded: ${fmtDate(p.uploadedAt)} by ${p.uploadedBy ?? "-"}`,
    p.width && p.height ? `${p.width}×${p.height}px${p.size ? ` · ${(p.size / 1024).toFixed(0)} KB` : ""}` : "Size unknown",
    p.lat != null ? `GPS ${p.lat.toFixed(5)}, ${p.lng?.toFixed(5)}` : "No GPS",
    ...p.flags.map((f) => `⚠ ${f.message}`),
  ],
});

function Viewer({ photo, w, onOpen }: { photo: WsPhoto; w: Workspace; onOpen: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [marked, setMarked] = useState(true);
  const src = marked && photo.editedUrl ? photo.editedUrl : photo.url;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm">
        <span className="font-medium">{label(w, photo.category)}</span>
        {photo.caption && <span className="text-muted-foreground">· {photo.caption}</span>}
        <div className="ml-auto flex items-center gap-1">
          {photo.hasEdited && <Button size="sm" variant="outline" onClick={() => setMarked((m) => !m)}>{marked ? "Show original" : "Show marked copy"}</Button>}
          <Button size="icon" variant="outline" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}><ZoomOut className="size-4" /></Button>
          <span className="w-10 text-center tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="outline" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.5))}><ZoomIn className="size-4" /></Button>
          <Button size="icon" variant="outline" aria-label="Full screen" onClick={onOpen}><Maximize2 className="size-4" /></Button>
        </div>
      </div>
      <div className="h-[48dvh] overflow-auto bg-black/90" tabIndex={0} aria-label="Photo, scroll to pan when zoomed">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} onClick={onOpen} alt={`${label(w, photo.category)} of ${w.shop.name ?? w.shop.code}`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto block h-auto min-h-full cursor-zoom-in object-contain transition-[width] duration-150 motion-reduce:transition-none" />
        ) : <p className="p-8 text-center text-sm text-white">This file is not available.</p>}
      </div>
    </Card>
  );
}

function Compare({ w, cur, prev }: { w: Workspace; cur: string[]; prev: string[] }) {
  const byId = new Map(w.photos.map((p) => [p.id, p]));
  const col = (title: string, ids: string[]) => (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-medium">{title}</p>
      <div className="grid max-h-[52dvh] grid-cols-2 gap-2 overflow-y-auto rounded-lg bg-muted p-2">
        {ids.map((i) => byId.get(i)).filter(Boolean).map((p) => (
          <figure key={p!.id} className="overflow-hidden rounded-md border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p!.url && <img src={p!.editedUrl ?? p!.url} alt={label(w, p!.category)} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
            <figcaption className="px-2 py-1 text-xs">{label(w, p!.category)}{!prev.includes(p!.id) && cur.includes(p!.id) && <Badge tone="success" className="ml-1">New</Badge>}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
  return <Card className="grid gap-3 p-3 md:grid-cols-2">{col("Previous version", prev)}{col("This version", cur)}</Card>;
}

function PhotoFacts({ photo, w }: { photo: WsPhoto; w: Workspace }) {
  return (
    <Card className="grid gap-x-4 gap-y-1 p-3 text-xs text-muted-foreground sm:grid-cols-2">
      <p>Captured: {fmtDate(photo.capturedAt)} · Uploaded: {fmtDate(photo.uploadedAt)} by {photo.uploadedBy ?? "-"}</p>
      <p>{photo.width && photo.height ? `${photo.width}×${photo.height}px` : "Size unknown"}{photo.size ? ` · ${(photo.size / 1024).toFixed(0)} KB` : ""}</p>
      <p className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{photo.lat != null ? `${photo.lat.toFixed(5)}, ${photo.lng?.toFixed(5)}${photo.gpsAccuracy ? ` (±${Math.round(photo.gpsAccuracy)} m)` : ""}` : "No GPS"}</p>
      <p>Category: {label(w, photo.category)}</p>
      {photo.flags.map((f) => <p key={f.code} className="flex items-center gap-1 text-warning sm:col-span-2"><AlertTriangle className="size-3.5" aria-hidden />{f.message}</p>)}
      {photo.state === "REMOVED" && <p className="text-danger sm:col-span-2">Removed {fmtDate(photo.removedAt)} by {photo.removedBy ?? "-"}: {photo.removeReason}</p>}
      {photo.state === "REMOVED" && w.me.isAdmin && <RestoreButton id={w.id} photoId={photo.id} />}
    </Card>
  );
}
function RestoreButton({ id, photoId }: { id: string; photoId: string }) {
  const m = useRestorePhoto(id);
  const toast = useToast();
  return <Button size="sm" variant="outline" className="w-fit" disabled={m.isPending} onClick={() => m.mutate(photoId, { onSuccess: () => toast("Photo restored"), onError: (e) => toast(errorMessage(e), "error") })}>Restore photo</Button>;
}

function ReviewerAssign({ w }: { w: Workspace }) {
  const list = useReviewers();
  const assign = useAssignReviewer(w.id);
  const toast = useToast();
  if (w.me.stage !== "OPS" && !w.me.isAdmin) return null;
  return (
    <Card className="p-4 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned reviewers</p>
      {(["OPS", "CS"] as const).map((s) => (
        <label key={s} className="mt-2 block">
          <span className="text-xs">{STAGE_LABEL[s]}</span>
          <Select value={w.reviewers[s]?.id ?? ""} onChange={(e) => assign.mutate({ stage: s, userId: e.target.value || null }, { onSuccess: () => toast("Reviewer updated"), onError: (er) => toast(errorMessage(er), "error") })}>
            <option value="">Anyone in the team</option>
            {(list.data ?? []).filter((u) => u.stage === s).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </label>
      ))}
    </Card>
  );
}

type Mode = null | "APPROVE" | "REJECT" | "REWORK" | "ADDITIONAL";

function ReviewPanel({ w, cur, photos }: { w: Workspace; cur: number; photos: WsPhoto[] }) {
  const decide = useDecide(w.id);
  const override = useOverride(w.id);
  const reopen = useReopen(w.id);
  const toast = useToast();
  const stage = w.me.stage;
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>(null);
  const [comment, setComment] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [replace, setReplace] = useState<string[]>([]);
  const [fixMeasure, setFixMeasure] = useState(false);
  const [reason, setReason] = useState("");
  const version = w.versions.find((v) => v.version === cur);
  const readOnly = cur !== w.currentVersion;
  // Unit-wise shops: each unit is approved / rejected on its own (OPS and CS), so the shop-level decision is not used.
  const unitMode = !!w.boards?.length;
  const can = !unitMode && w.me.canDecide && !readOnly && !!stage;

  const send = () => {
    if (!stage || !mode) return;
    const items: DecisionInput["items"] = [
      ...cats.map((c) => ({ type: "ADDITIONAL_PHOTO", category: c, mediaKey: w.mediaItems[0]?.key })),
      ...replace.map((p) => ({ type: "REPLACE_PHOTO", photo: p })),
      ...(fixMeasure ? [{ type: "FIX_MEASUREMENT" }] : []),
    ];
    decide.mutate(
      { stage, decision: mode, versionNo: w.currentVersion, comment, ...(mode === "REJECT" ? { reason: comment } : {}), checklist: w.checklist.map((c) => ({ key: c.key, passed: !!checks[c.key] })), items },
      { onSuccess: () => { toast("Decision saved"); setMode(null); setComment(""); setCats([]); setReplace([]); }, onError: (e) => toast(errorMessage(e), "error") },
    );
  };
  const needsText = mode === "REJECT" || mode === "REWORK" || mode === "ADDITIONAL";
  const valid = mode === "APPROVE" ? w.checklist.filter((c) => !(c.gps && false)).every((c) => checks[c.key]) : mode === "REJECT" ? comment.trim().length >= 3 : mode === "REWORK" ? comment.trim().length >= 5 : mode === "ADDITIONAL" ? cats.length > 0 : false;

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review status · version {cur}</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {(version?.reviews ?? []).map((r) => (
            <li key={r.stage} className="rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between"><span className="font-medium">{r.stageLabel}</span><DecisionBadge decision={r.decision} /></div>
              {r.reviewer && <p className="text-xs text-muted-foreground">{r.reviewer} · {fmtDate(r.decidedAt)}</p>}
              {r.comment && <p className="mt-1 text-xs">{r.comment}</p>}
              {r.override && <p className="mt-1 text-xs text-warning">Admin override: {r.override.reason}</p>}
            </li>
          ))}
        </ul>
        {w.status === "APPROVED" && <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-success">Final approved. This version is locked.</p>}
      </Card>

      {unitMode && (
        <Card className="p-4 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Units{w.summary ? ` · ${w.summary.approved} of ${w.summary.units} approved` : ""}</p>
          <UnitReview w={w} compact />
        </Card>
      )}

      {can && (
        <Card className="p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{STAGE_LABEL[stage!]} checklist</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {w.checklist.map((c) => (
              <li key={c.key}><label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={!!checks[c.key]} onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))} /><span>{c.label}</span></label></li>
            ))}
          </ul>
        </Card>
      )}

      {can && mode && needsText && (
        <Card className="flex flex-col gap-3 p-4 text-sm">
          <label>
            <span className="font-medium">{mode === "REJECT" ? "Rejection reason (required)" : mode === "REWORK" ? "Rework instructions (required)" : "Note for the recce person"}</span>
            <Textarea className="mt-1" value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} placeholder={mode === "REWORK" ? "e.g. Need a clearer right-side view of the board mounting area." : ""} />
          </label>
          {(mode === "REWORK" || mode === "ADDITIONAL") && (
            <fieldset>
              <legend className="font-medium">Photos needed</legend>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {w.categories.map((c) => (
                  <label key={c.key} className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${cats.includes(c.key) ? "border-primary bg-secondary" : "border-border"}`}>
                    <input type="checkbox" className="sr-only" checked={cats.includes(c.key)} onChange={() => setCats((s) => (s.includes(c.key) ? s.filter((x) => x !== c.key) : [...s, c.key]))} />{c.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {mode === "REWORK" && (
            <>
              <fieldset>
                <legend className="font-medium">Replace these photos</legend>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {photos.filter((p) => p.state === "SUBMITTED").map((p) => (
                    <label key={p.id} className={`cursor-pointer rounded-lg border px-2 py-1 text-xs ${replace.includes(p.id) ? "border-primary bg-secondary" : "border-border"}`}>
                      <input type="checkbox" className="sr-only" checked={replace.includes(p.id)} onChange={() => setReplace((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} />{label(w, p.category)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2"><input type="checkbox" checked={fixMeasure} onChange={(e) => setFixMeasure(e.target.checked)} /> Measurements need correction</label>
            </>
          )}
        </Card>
      )}

      {can ? (
        <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
          {mode ? (
            <>
              <Button disabled={!valid || decide.isPending} loading={decide.isPending} onClick={send} variant={mode === "REJECT" ? "destructive" : "default"}><Send className="size-4" aria-hidden /> Confirm {mode === "APPROVE" ? "approval" : mode === "REJECT" ? "rejection" : mode === "REWORK" ? "rework request" : "request"}</Button>
              <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setMode("APPROVE")}><Check className="size-4" aria-hidden /> Approve</Button>
              <Button variant="outline" onClick={() => setMode("REWORK")}><RotateCcw className="size-4" aria-hidden /> Rework</Button>
              <Button variant="outline" onClick={() => setMode("ADDITIONAL")}>More photos</Button>
              <Button variant="destructive" onClick={() => setMode("REJECT")}><ShieldX className="size-4" aria-hidden /> Reject</Button>
            </>
          )}
        </div>
      ) : unitMode ? null : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {readOnly ? "You are looking at an older version. Switch to the current version to decide." : w.me.stage && w.me.openStage && w.me.openStage !== w.me.stage ? `Waiting for ${STAGE_LABEL[w.me.openStage]} to decide first.` : w.status === "REWORK_REQUIRED" ? "Waiting for the recce person to resubmit." : w.me.stage ? "Nothing for you to decide right now." : "You can view this submission. Decisions are made by the review teams."}
        </p>
      )}

      {w.me.isAdmin && ["SUBMITTED", "UNDER_REVIEW"].includes(w.status) && (
        <Card className="flex flex-col gap-2 p-4 text-sm">
          <p className="font-medium">Admin override</p>
          <Input aria-label="Override reason" placeholder="Reason (kept in the audit trail)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            {(["APPROVE", "REJECT"] as const).map((a) => (
              <Button key={a} size="sm" variant="outline" disabled={reason.trim().length < 5 || override.isPending} onClick={() => override.mutate({ action: a, reason }, { onSuccess: () => { toast(`Override: ${a.toLowerCase()}`); setReason(""); }, onError: (e) => toast(errorMessage(e), "error") })}>{a === "APPROVE" ? "Approve anyway" : "Reject anyway"}</Button>
            ))}
          </div>
        </Card>
      )}
      {w.me.canReopen && (
        <Card className="flex flex-col gap-2 p-4 text-sm">
          <p className="font-medium">Reopen for a new attempt</p>
          <Input aria-label="Reopen reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" variant="outline" disabled={reason.trim().length < 5 || reopen.isPending} onClick={() => reopen.mutate({ reason }, { onSuccess: () => { toast("Shop reopened"); setReason(""); }, onError: (e) => toast(errorMessage(e), "error") })}>Reopen</Button>
        </Card>
      )}
    </div>
  );
}

function ReworkList({ w }: { w: Workspace }) {
  if (!w.reworks.length) return <Card><EmptyState title="No rework requests" description="Rework and additional-photo requests appear here with their resolved state." /></Card>;
  return (
    <ul className="flex flex-col gap-3">
      {[...w.reworks].reverse().map((r) => (
        <li key={r.id}>
          <Card className="p-4 text-sm">
            <div className="flex items-center justify-between"><span className="font-medium">{r.kind === "ADDITIONAL" ? "Additional photos" : "Rework"} · v{r.versionNo}</span><Badge tone={r.status === "OPEN" ? "warning" : "success"}>{r.status === "OPEN" ? "Unresolved" : r.status === "RESOLVED" ? "Resolved" : "Closed"}</Badge></div>
            <p className="text-xs text-muted-foreground">{r.stageLabel} · {r.requestedBy} · {fmtDate(r.requestedAt)}</p>
            <p className="mt-2">{r.instructions}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {r.items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-xs"><span className={`size-2 rounded-full ${i.resolved ? "bg-success" : "bg-warning"}`} aria-hidden />{i.type === "ADDITIONAL_PHOTO" ? `Add: ${i.categoryLabel}` : i.type === "REPLACE_PHOTO" ? "Replace a photo" : i.type === "FIX_MEASUREMENT" ? "Correct measurements" : i.note || "Other"}{i.resolved ? ` (resolved in v${i.resolvedInVersion})` : " (open)"}</li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Activity({ id }: { id: string }) {
  const [type, setType] = useState("");
  const q = useTimeline(id, { type });
  const types = ["PHOTO_CAPTURED", "SUBMISSION_CREATED", "REVIEW_APPROVED", "REVIEW_REJECTED", "REWORK_REQUESTED", "ADDITIONAL_PHOTOS_REQUESTED", "PHOTO_REMOVED", "FINAL_APPROVAL", "ADMIN_OVERRIDE"];
  return (
    <div className="flex flex-col gap-3">
      <Select aria-label="Filter by activity type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All activity</option>
        {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>)}
      </Select>
      {q.isPending ? <Skeleton className="h-40" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.length === 0 ? <Card><EmptyState title="No activity yet" /></Card> : (
        <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
          {q.data.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
              <p className="font-medium">{e.label}{e.version ? ` · v${e.version}` : ""}</p>
              <p className="text-xs text-muted-foreground">{e.actor} ({e.role.replace(/_/g, " ").toLowerCase()}) · {fmtDate(e.at)}</p>
              {e.reason && <p className="mt-0.5 text-xs">{e.reason}</p>}
              {e.changes.filter((c) => c.field === "status").map((c) => <p key={c.field} className="text-xs text-muted-foreground">{String(c.oldValue)} → {String(c.newValue)}</p>)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Chat({ id }: { id: string }) {
  const q = useShopThread(id);
  const send = useSendShopMessage(id);
  const toast = useToast();
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[46dvh] flex-col gap-2 overflow-y-auto" aria-live="polite">
        {q.isPending ? <Skeleton className="h-32" /> : (q.data ?? []).length === 0 ? <Card><EmptyState title="No messages for this shop" description="Updates and replies of this shop appear here and in the project channel." /></Card> : q.data!.map((m) => (
          <div key={m.id} className={m.card ? "rounded-lg border border-primary/30 bg-secondary p-3 text-sm" : "rounded-lg bg-muted px-3 py-2 text-sm"}>
            {m.card ? (
              <>
                <p className="font-semibold">{m.card.title}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs">{m.card.lines.map((l) => <div key={l.label} className="contents"><dt className="text-muted-foreground">{l.label}</dt><dd>{l.value}</dd></div>)}</dl>
              </>
            ) : <><p className="text-xs font-medium">{m.author.name}</p><p className="whitespace-pre-wrap">{m.body}</p></>}
            <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(m.createdAt)}</p>
          </div>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; send.mutate(text.trim(), { onSuccess: () => setText(""), onError: (er) => toast(errorMessage(er), "error") }); }}>
        <Input aria-label="Message" placeholder="Message about this shop" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={!text.trim() || send.isPending} aria-label="Send message"><Send className="size-4" /></Button>
      </form>
    </div>
  );
}
