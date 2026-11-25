"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PhotoLightbox } from "@/components/preview/photo-lightbox";
import { AlertTriangle, Columns2, History, Images, Layers, MapPin, Maximize2, MessageSquare, Send, ShieldX, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import {
  useAssignReviewer, useMarks, useRestorePhoto, useReviewers, useSendShopMessage, useShopThread, useStartReview, useTimeline, useWorkspace,
  boardLabel, type WsPhoto, type Workspace,
} from "@/lib/api/recceReview";
import { BoardReview, myProblems } from "./board-review";
import { STAGE_LABEL, fmtDate } from "./common";
import { ReviewHeader } from "./review-header";
import { ReviewPanel } from "./review-panel";

type CenterTab = "boards" | "photos" | "compare" | "activity" | "chat";

/** Full-screen review workspace: the shop header on top, then the details (boards, photos, comparison, history, chat) beside the checklist and decisions. */
export function ReviewWorkspace() {
  const { id } = useParams<{ id: string }>();
  const q = useWorkspace(id);
  const start = useStartReview(id);
  const [ver, setVer] = useState<number | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [tab, setTab] = useState<CenterTab>("boards");
  const [full, setFull] = useState<number | null>(null);
  const [askFor, setAskFor] = useState<string | null>(null);
  const marker = useMarks(id);
  const toast = useToast();

  const w = q.data;
  const cur = ver ?? w?.currentVersion ?? 1;
  // Both reviewer logins may mark: the stage that still has to decide, and the stage that approved and now changes its mind. Only on the current version.
  const canMark = !!w && w.me.canMark && cur === w.currentVersion && !!w.me.stage;
  const canReject = canMark;
  const markHint = !w ? null : cur !== w.currentVersion ? "You are looking at an older version." : !w.me.stage ? "Only the review teams can mark photos." : w.status === "REWORK_REQUIRED" ? "Waiting for the recce person to resubmit." : "Nothing for you to mark right now.";
  // Photos my stage marked Rejected / Rework and has not sent yet (photo id -> reason). They are saved on the server, so they survive a reload and the other team sees them.
  const rejects = useMemo<Rejects>(() => Object.fromEntries((w ? myProblems(w, cur) : []).filter((m) => m.photo).map((m) => [m.photo as string, m.reason])), [w, cur]);
  const markPhoto = (photoId: string, decision: "APPROVED" | "REJECTED", reason: string) => {
    if (!w?.me.stage) return;
    marker.mutate({ stage: w.me.stage, versionNo: w.currentVersion, decision, reason, targets: [{ kind: "PHOTO", photo: photoId }] }, { onError: (e) => toast(errorMessage(e), "error") });
  };
  // Opening a submission that waits for my stage (either stage, in any order) marks the review as started (once).
  useEffect(() => {
    if (w && w.me.canDecide && w.status === "SUBMITTED") start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.id, w?.status, w?.me.canDecide]);

  const version = w?.versions.find((v) => v.version === cur);
  const photos = useMemo(() => {
    if (!w || !version) return [] as WsPhoto[];
    const inVersion = new Set(version.photoIds);
    return w.photos.filter((p) => inVersion.has(p.id) || (showRemoved && p.state !== "SUBMITTED"));
  }, [w, version, showRemoved]);
  const active = photos.find((p) => p.id === photoId) ?? photos[0] ?? null;
  const prevVersion = w?.versions.find((v) => v.version === cur - 1);

  if (q.isPending) return <div className="flex flex-col gap-4"><Skeleton className="h-40" /><div className="grid gap-4 lg:grid-cols-[1fr_24rem]"><Skeleton className="h-[60dvh]" /><Skeleton className="h-[60dvh]" /></div></div>;
  if (q.isError || !w) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not open this submission" />;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <ReviewHeader w={w} cur={cur} version={version} onVersion={(n) => { setVer(n); setPhotoId(null); setAskFor(null); }} onOpenPhoto={(pid) => setFull(photos.findIndex((p) => p.id === pid))} />

      {/* The shop and submission facts sit in the header above, so the page is two columns: the details with their tabs, and the decisions. */}
      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* LEFT: boards, photos, comparison, history, chat */}
        <section className="flex min-w-0 flex-col gap-3" aria-label="Submission details">
          <Card className="flex flex-wrap items-center gap-x-3 pr-3">
            <Tabs
              className="min-w-0 flex-1"
              label="Submission sections"
              value={tab}
              onChange={(k) => setTab(k as CenterTab)}
              tabs={[
                { key: "boards", label: "Boards", count: version?.mediaItems.length ?? 0, icon: Layers },
                { key: "photos", label: "All Photos", count: photos.length, icon: Images },
                { key: "compare", label: "Comparison", icon: Columns2 },
                { key: "activity", label: "Activity & History", count: w.reworks.filter((r) => r.status === "OPEN").length || undefined, icon: History },
                { key: "chat", label: "Chat", icon: MessageSquare },
              ]}
            />
            {(tab === "boards" || tab === "photos" || tab === "compare") && (
              <label className="ml-auto flex items-center gap-2 py-2 text-xs text-muted-foreground"><input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> Show removed / replaced photos</label>
            )}
          </Card>

          <TabPanel k={tab} className="flex min-w-0 flex-col gap-3">
            {tab === "boards" && (version ? <BoardReview w={w} version={version} photos={photos} canMark={canMark} hint={markHint} onOpenPhoto={(pid) => setFull(photos.findIndex((p) => p.id === pid))} /> : <Card><EmptyState title="This version was not found" /></Card>)}

            {tab === "photos" && (!active ? <Card><EmptyState title="No photos in this version" /></Card> : (
              <>
                <Viewer
                  key={active.id} photo={active} w={w} onOpen={() => setFull(photos.findIndex((p) => p.id === active.id))}
                  reject={{ enabled: canReject && active.state === "SUBMITTED", reason: rejects[active.id], asking: askFor === active.id, onAsk: () => setAskFor(active.id), onCancel: () => setAskFor(null), onSave: (r) => { markPhoto(active.id, "REJECTED", r); setAskFor(null); }, onUndo: () => markPhoto(active.id, "APPROVED", "") }}
                />
                <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Photos of this version">
                  {photos.map((p) => (
                    <button key={p.id} role="option" aria-selected={p.id === active.id} onClick={() => setPhotoId(p.id)} className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-ring ${p.id === active.id ? "border-primary" : "border-border"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.url ? <img src={p.editedUrl ?? p.url} alt={`${label(w, p.category)} photo`} loading="lazy" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-xs text-muted-foreground">No file</span>}
                      {version?.addedIds.includes(p.id) && <span className="absolute left-1 top-1 rounded bg-success px-1 text-[10px] font-medium text-white">NEW</span>}
                      {w.mediaItems.length > 1 && boardOf(w, p.mediaKey) && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">{boardOf(w, p.mediaKey)}</span>}
                      {p.state !== "SUBMITTED" && <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 text-[10px] text-white">{p.state === "REMOVED" ? "Removed" : "Replaced"}</span>}
                      {p.id in rejects && <span className="absolute inset-x-0 bottom-0 bg-danger px-1 text-[10px] font-medium text-white">Rejected</span>}
                      {p.flags.length > 0 && <AlertTriangle className="absolute right-1 top-1 size-4 text-warning" aria-label="Metadata warning" />}
                    </button>
                  ))}
                </div>
                <PhotoFacts photo={active} w={w} />
              </>
            ))}

            {tab === "compare" && (prevVersion
              ? <Compare w={w} cur={version?.photoIds ?? []} prev={prevVersion.photoIds} reject={{ enabled: canReject, rejects, onOpen: (pid) => { setPhotoId(pid); setTab("photos"); setAskFor(pid); } }} />
              : <Card><EmptyState title="Nothing to compare" description="This is the first version of the submission." /></Card>)}

            {tab === "activity" && (
              <div className="grid gap-4 xl:grid-cols-2">
                <section aria-label="Rework requests"><h2 className="mb-2 text-sm font-semibold">Rework requests</h2><ReworkList w={w} /></section>
                <section aria-label="Activity"><h2 className="mb-2 text-sm font-semibold">Activity</h2><Activity id={id} /></section>
              </div>
            )}

            {tab === "chat" && <Chat id={id} />}
          </TabPanel>

          <PhotoLightbox
            index={full} onIndexChange={setFull} onClose={() => setFull(null)}
            photos={photos.map((p) => ({
              ...lightboxItem(p, w),
              actions: canReject && p.state === "SUBMITTED" ? (
                p.id in rejects
                  ? <button className={LIGHTBOX_BTN} onClick={() => markPhoto(p.id, "APPROVED", "")}>Undo reject</button>
                  : <button className={`${LIGHTBOX_BTN} bg-danger hover:bg-danger/80`} onClick={() => { setFull(null); setPhotoId(p.id); setTab("photos"); setAskFor(p.id); }}><ShieldX className="size-4" aria-hidden /> Reject photo</button>
              ) : undefined,
            }))}
          />
        </section>

        {/* RIGHT: checklist and decisions */}
        <aside className="flex min-h-0 flex-col gap-3 lg:sticky lg:top-2 lg:max-h-[calc(100dvh-9rem)] lg:self-start lg:overflow-y-auto" aria-label="Review actions">
          {/* A new key per version: the checklist starts empty again when the recce person submits the next one. */}
          <ReviewPanel key={`${w.id}:${cur}:${w.currentVersion}`} w={w} cur={cur} />
          <ReviewerAssign w={w} />
        </aside>
      </div>
    </div>
  );
}

const label = (w: Workspace, key: string) => w.categories.find((c) => c.key === key)?.label ?? key;
/** The board number ("GSB-02") a photo belongs to; empty for a photo that belongs to no board. */
const boardOf = (w: Workspace, mediaKey: string) => { const b = w.mediaItems.find((m) => m.key === mediaKey); return b ? boardLabel(b) : ""; };

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

/** Photos rejected on this screen: photo id -> reason. */
type Rejects = Record<string, string>;
const LIGHTBOX_BTN = "inline-flex h-9 items-center justify-center gap-1 rounded-md bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white";

/** What the viewer needs to let a reviewer reject the photo on screen. */
interface RejectControl { enabled: boolean; reason: string | undefined; asking: boolean; onAsk: () => void; onCancel: () => void; onSave: (reason: string) => void; onUndo: () => void }

/** The reason for rejecting one photo. A real reason (3+ characters) is needed, so the recce person knows what to fix. */
function RejectForm({ onSave, onCancel }: { onSave: (reason: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-2 border-t border-border bg-danger-soft/40 px-3 py-3 text-sm">
      <label>
        <span className="font-medium">Why is this photo rejected? (required)</span>
        <Textarea className="mt-1" autoFocus value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="e.g. Board is cut off, retake it straight on." />
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" disabled={text.trim().length < 3} onClick={() => onSave(text.trim())}><ShieldX className="size-4" aria-hidden /> Reject photo</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function Viewer({ photo, w, onOpen, reject }: { photo: WsPhoto; w: Workspace; onOpen: () => void; reject: RejectControl }) {
  const [zoom, setZoom] = useState(1);
  const [marked, setMarked] = useState(true);
  const src = marked && photo.editedUrl ? photo.editedUrl : photo.url;
  const rejected = reject.reason !== undefined;
  return (
    <Card className={`overflow-hidden ${rejected ? "border-danger" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm">
        <span className="font-medium">{label(w, photo.category)}</span>
        {photo.caption && <span className="text-muted-foreground">· {photo.caption}</span>}
        {rejected && <Badge tone="danger">Rejected</Badge>}
        <div className="ml-auto flex items-center gap-1">
          {reject.enabled && (rejected
            ? <Button size="sm" variant="outline" onClick={reject.onUndo}>Undo reject</Button>
            : <Button size="sm" variant="destructive" disabled={reject.asking} onClick={reject.onAsk}><ShieldX className="size-4" aria-hidden /> Reject photo</Button>)}
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
      {reject.enabled && reject.asking && !rejected && <RejectForm onSave={reject.onSave} onCancel={reject.onCancel} />}
      {rejected && (
        <p className="flex items-start gap-2 border-t border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="status">
          <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span><span className="font-medium">Rejected.</span> The recce person will retake this photo.{reject.reason ? ` Reason: ${reject.reason}` : ""}</span>
        </p>
      )}
    </Card>
  );
}

function Compare({ w, cur, prev, reject }: { w: Workspace; cur: string[]; prev: string[]; reject: { enabled: boolean; rejects: Rejects; onOpen: (photoId: string) => void } }) {
  const byId = new Map(w.photos.map((p) => [p.id, p]));
  const col = (title: string, ids: string[], canAct = false) => (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-medium">{title}</p>
      <div className="grid max-h-[52dvh] grid-cols-2 gap-2 overflow-y-auto rounded-lg bg-muted p-2">
        {ids.map((i) => byId.get(i)).filter(Boolean).map((p) => (
          <figure key={p!.id} className="overflow-hidden rounded-md border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p!.url && <img src={p!.editedUrl ?? p!.url} alt={label(w, p!.category)} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
            <figcaption className="flex items-center gap-1 px-2 py-1 text-xs">
              <span className="min-w-0 truncate">{label(w, p!.category)}</span>
              {!prev.includes(p!.id) && cur.includes(p!.id) && <Badge tone="success">New</Badge>}
              {p!.id in reject.rejects && <Badge tone="danger">Rejected</Badge>}
              {canAct && reject.enabled && p!.state === "SUBMITTED" && (
                <button type="button" onClick={() => reject.onOpen(p!.id)} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-ring">
                  <ShieldX className="size-3.5" aria-hidden /> {p!.id in reject.rejects ? "Edit reject" : "Reject"}
                </button>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
  return <Card className="grid gap-3 p-3 md:grid-cols-2">{col("Previous version", prev)}{col("This version", cur, true)}</Card>;
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
                <li key={i.id} className="flex items-center gap-2 text-xs"><span className={`size-2 rounded-full ${i.resolved ? "bg-success" : "bg-warning"}`} aria-hidden />{i.label ? `${i.rejected ? "Rejected" : "Rework"} · ${i.label}${i.note ? `: ${i.note}` : ""}` : i.type === "ADDITIONAL_PHOTO" ? `Add: ${i.categoryLabel}` : i.type === "REPLACE_PHOTO" ? (i.rejected ? `Rejected photo${i.categoryLabel ? ` (${i.categoryLabel})` : ""}: ${i.note}` : i.note ? `Replace a photo: ${i.note}` : "Replace a photo") : i.type === "FIX_MEASUREMENT" ? "Correct measurements" : i.note || "Other"}{i.resolved ? ` (resolved in v${i.resolvedInVersion})` : " (open)"}</li>
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
