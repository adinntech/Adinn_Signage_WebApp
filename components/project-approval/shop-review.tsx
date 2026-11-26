"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Box, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, GitCompare, History, Home, Image as ImageIcon, LayoutGrid, MapPin, MessageSquare, Ruler, Store, User, Wrench, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useApprovalWorkspace, useDecideItem, useShopRef, type ApprovalWorkspace, type ItemReview } from "@/lib/api/projectApproval";
import { useDecide, useStartReview, type DecisionInput, type ReviewStage, type WsPhoto } from "@/lib/api/recceReview";
import { cn } from "@/lib/utils";
import { DECISION_LOOK, fmtDateTime, fmtGps, Pill, STAGE_NAME, STATUS_LOOK } from "./common";
import { RejectItemModal } from "./review-parts";
import { AuditTab, BoardsTab, ChecklistTab, CommentsTab, CompareModal, DrawingsTab, InstallationTab, MeasurementsTab, OverviewTab, PhotosTab, type ReviewCtx } from "./shop-review-tabs";

type TabKey = "overview" | "photos" | "measurements" | "drawings" | "boards" | "installation" | "checklist" | "comments" | "audit";
const REVIEWABLE = ["SUBMITTED", "UNDER_REVIEW"];

/** Project Approval > shop: resolves the shop's submission, then the review screen. */
export function ShopApprovalDetail({ projectId, siteId }: { projectId: string; siteId: string }) {
  const ref = useShopRef(siteId);
  const ws = useApprovalWorkspace(ref.data?.currentVersion ? ref.data.submissionId : null);
  const back = (
    <Link href={`/project-approval/${projectId}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]">
      <ArrowLeft className="size-4" aria-hidden /> Back to shops
    </Link>
  );
  if (ref.isPending || (ref.data?.currentVersion && ws.isPending)) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-12" /><Skeleton className="h-96" /></div>;
  if (ref.isError) return <ErrorState error={ref.error} onRetry={() => ref.refetch()} title="Could not open this shop" />;
  if (!ref.data?.currentVersion) return <EmptyState icon={Store} title="Recce not submitted yet" description={`${ref.data?.shopName ?? ref.data?.siteCode ?? "This shop"} has no submitted recce to review.`} action={back} />;
  if (ws.isError || !ws.data) return <ErrorState error={ws.error} onRetry={() => ws.refetch()} title="Could not load the submission" />;
  return <ShopReview w={ws.data} projectId={projectId} />;
}

function ShopReview({ w, projectId }: { w: ApprovalWorkspace; projectId: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("overview");
  const [compare, setCompare] = useState(false);
  const [rejectItem, setRejectItem] = useState<{ kind: "PHOTO" | "MEASUREMENT"; ref: string; title: string; reason?: string } | null>(null);
  const [finalMode, setFinalMode] = useState<"approve" | "reject" | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const decideItem = useDecideItem(w.id);
  const decide = useDecide(w.id);
  const start = useStartReview(w.id);

  const stage = w.me.stage;
  const cur = w.versions.at(-1)!;
  const prev = w.versions.length > 1 ? w.versions.at(-2)! : null;
  const myReview = stage ? cur.reviews.find((r) => r.stage === stage) : undefined;
  const canAct = !!stage && REVIEWABLE.includes(w.status) && !w.project.closed && myReview?.decision === "PENDING" && (cur.sequential === false || w.me.openStage === stage);
  const waitNote = !stage
    ? "View only"
    : w.project.closed
      ? "Project is closed"
      : !REVIEWABLE.includes(w.status)
        ? "Not waiting for review"
        : myReview && myReview.decision !== "PENDING"
          ? `${STAGE_NAME[stage]} has decided this version`
          : !myReview
            ? `${STAGE_NAME[stage]} is not part of this review`
            : "Waiting for the earlier review stage";

  // Opening a submission that waits for my stage marks the review as started (same rule as Recce Review).
  useEffect(() => {
    if (w.me.openStage && w.me.openStage === stage && w.status === "SUBMITTED") start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.id, w.status, w.me.openStage]);

  const photos = useMemo(() => { const ids = new Set(cur.photoIds); return w.photos.filter((p) => ids.has(p.id)); }, [w.photos, cur.photoIds]);
  const curItems = useMemo(() => w.itemReviews.filter((i) => i.versionNo === cur.version), [w.itemReviews, cur.version]);
  const itemsOf = (kind: ItemReview["kind"], ref: string) => curItems.filter((i) => i.kind === kind && i.ref === ref);
  const myRejected = curItems.filter((i) => i.stage === stage && i.decision === "REJECTED");
  const catLabel = (k: string) => w.categories.find((c) => c.key === k)?.label ?? k;
  const boardLabel = (key: string) => { const i = cur.mediaItems.findIndex((m) => m.key === key); return i >= 0 ? `Board ${i + 1} – ${cur.mediaItems[i]!.name}` : key; };
  const front = photos.find((p) => p.category === "SHOP_FRONT") ?? photos[0];
  const gpsPhoto = photos.find((p) => p.lat != null && p.lng != null);

  const actItem = (kind: ItemReview["kind"], ref: string, decision: "APPROVE" | "REJECT" | "CLEAR", reason?: string) =>
    decideItem.mutate(
      { versionNo: cur.version, kind, ref, decision, reason },
      { onSuccess: () => { toast(decision === "APPROVE" ? "Marked approved" : decision === "REJECT" ? "Rejection saved" : "Decision cleared"); setRejectItem(null); }, onError: (e) => toast(errorMessage(e), "error") },
    );

  const ctx: ReviewCtx = {
    w, cur, prev, stage, canAct, photos, curItems, itemsOf, catLabel, boardLabel, busy: decideItem.isPending,
    approveItem: (kind, ref) => actItem(kind, ref, "APPROVE"),
    rejectItem: (kind, ref, title) => setRejectItem({ kind, ref, title, reason: itemsOf(kind, ref).find((i) => i.stage === stage && i.decision === "REJECTED")?.reason }),
    clearItem: (kind, ref) => actItem(kind, ref, "CLEAR"),
    checks, setChecks, openCompare: () => setCompare(true),
  };

  const tabs: TabItem<TabKey>[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "photos", label: `Photos (${photos.length})`, icon: ImageIcon },
    { key: "measurements", label: "Measurements", icon: Ruler },
    { key: "drawings", label: "2D / 3D View", icon: Box },
    { key: "boards", label: "Board Details", icon: Store },
    { key: "installation", label: "Installation & Access", icon: Wrench },
    { key: "checklist", label: "Checklist", icon: ClipboardCheck },
    { key: "comments", label: "Comments", icon: MessageSquare },
    { key: "audit", label: "Audit Log", icon: History },
  ];

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
        <Home className="size-3.5" aria-hidden /><ChevronRight className="size-3" aria-hidden />
        <Link href="/project-approval" className="hover:text-royal">Project Approval</Link><ChevronRight className="size-3" aria-hidden />
        <Link href={`/project-approval/${projectId}`} className="hover:text-royal">{w.project.code}</Link><ChevronRight className="size-3" aria-hidden />
        <span className="font-medium text-[#172B4D]">{w.shop.code}</span>
      </nav>

      {/* Title, status and the final decision of my stage */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-stretch gap-3">
          <span className="w-1.5 rounded-full bg-loss" aria-hidden />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-[#172B4D] sm:text-2xl">Shop Recce Detail – {w.shop.code}</h1>
              <Pill look={STATUS_LOOK[w.status]} />
              <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-semibold text-[#1D4ED8]">V{cur.version}{cur.version > 1 ? " · Resubmitted" : ""}</span>
            </div>
            <p className="text-sm text-[#475569]">{w.shop.name ?? "-"} · Project {w.project.code}{w.project.client ? ` · ${w.project.client}` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stage && (
            <>
              <Button variant="outline" className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]" disabled={!canAct} title={canAct ? undefined : waitNote} onClick={() => setFinalMode("reject")}>
                <XCircle className="size-4" aria-hidden /> Reject Submission
              </Button>
              <Button className="bg-finance text-white hover:bg-[#047857]" disabled={!canAct} title={canAct ? undefined : waitNote} onClick={() => setFinalMode("approve")}>
                <CheckCircle2 className="size-4" aria-hidden /> Approve Submission
              </Button>
            </>
          )}
          {(!canAct || !stage) && <span className="text-xs text-[#64748B]">{waitNote}</span>}
        </div>
      </div>

      {/* Shop facts */}
      <div className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 md:grid-cols-[9rem_1fr]">
        {front?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage link
          <img src={front.editedUrl ?? front.url} alt={`${w.shop.name ?? "Shop"} front`} className="h-28 w-full rounded-lg border border-[#E2E8F0] object-cover md:w-36" />
        ) : (
          <div className="grid h-28 place-items-center rounded-lg bg-[#F1F5F9] text-[#94A3B8]"><Store className="size-8" aria-hidden /></div>
        )}
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          <Fact icon={MapPin} label="Location" value={w.shop.address || w.shop.district || "-"} sub={w.shop.district ?? undefined} />
          <Fact icon={Store} label="Shop / Dealer" value={w.shop.dealer || w.shop.name || "-"} sub={`Shop ID ${w.shop.code}`} />
          <Fact icon={User} label="Assigned To" value={w.assignee ?? "-"} sub={w.channel === "VENDOR" ? "Vendor" : w.channel === "IN_HOUSE" ? "Inhouse team" : undefined} />
          <Fact icon={CalendarClock} label="Visit / Submitted" value={fmtDateTime(cur.submittedAt)} sub={front?.capturedAt ? `Captured ${fmtDateTime(front.capturedAt)}` : undefined} />
          <Fact icon={MapPin} label="GPS Coordinates" value={gpsPhoto ? fmtGps(gpsPhoto.lat, gpsPhoto.lng) : fmtGps(w.shop.lat, w.shop.lng)} sub={gpsPhoto ? "From the submitted photos" : w.shop.lat != null ? "Shop location" : undefined} />
          <div className="min-w-0">
            <dt className="text-xs font-medium text-[#64748B]">Review status</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {cur.reviews.map((r) => <span key={r.stage} className="flex items-center gap-1 text-xs text-[#334155]">{STAGE_NAME[r.stage as ReviewStage]}: <Pill look={DECISION_LOOK[r.decision]} /></span>)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Version history */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#172B4D]"><History className="size-4 text-loss" aria-hidden /> Version History</span>
        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {w.versions.map((v) => {
            const rejected = v.reviews.filter((r) => r.decision === "REJECTED" || r.decision === "REWORK");
            const current = v.version === cur.version;
            return (
              <li key={v.id} className={cn("rounded-lg border px-2.5 py-1.5 text-xs", current ? "border-[#BFDBFE] bg-[#EFF6FF]" : rejected.length ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#E2E8F0]")}>
                <span className="font-semibold text-[#172B4D]">V{v.version}</span> · {fmtDateTime(v.submittedAt)}
                {rejected.length > 0 && <span className="text-[#B91C1C]"> · Rejected by {rejected.map((r) => STAGE_NAME[r.stage as ReviewStage]).join(", ")}</span>}
                {current && <span className="text-[#1D4ED8]"> · Current</span>}
              </li>
            );
          })}
        </ol>
        {prev && (
          <Button variant="outline" size="sm" onClick={() => setCompare(true)}>
            <GitCompare className="size-4" aria-hidden /> View Version Comparison
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <Tabs items={tabs} value={tab} onChange={setTab} idPrefix="pa" className="px-2" />
        <div id="pa-panel" role="tabpanel" aria-labelledby={`pa-tab-${tab}`} className="p-4">
          {tab === "overview" && <OverviewTab c={ctx} goTo={(k) => setTab(k as TabKey)} />}
          {tab === "photos" && <PhotosTab c={ctx} />}
          {tab === "measurements" && <MeasurementsTab c={ctx} />}
          {tab === "drawings" && <DrawingsTab c={ctx} />}
          {tab === "boards" && <BoardsTab c={ctx} />}
          {tab === "installation" && <InstallationTab c={ctx} />}
          {tab === "checklist" && <ChecklistTab c={ctx} />}
          {tab === "comments" && <CommentsTab c={ctx} />}
          {tab === "audit" && <AuditTab c={ctx} />}
        </div>
      </div>

      <RejectItemModal
        target={rejectItem}
        stage={stage}
        busy={decideItem.isPending}
        onClose={() => setRejectItem(null)}
        onSubmit={(reason) => rejectItem && actItem(rejectItem.kind, rejectItem.ref, "REJECT", reason)}
      />
      {prev && <CompareModal open={compare} onClose={() => setCompare(false)} c={ctx} />}
      <FinalDecision
        mode={finalMode}
        onClose={() => setFinalMode(null)}
        ctx={ctx}
        myRejected={myRejected}
        photosById={new Map(photos.map((p) => [p.id, p]))}
        busy={decide.isPending}
        onSubmit={(input, done) =>
          decide.mutate(input, {
            onSuccess: () => { toast(input.decision === "APPROVE" ? "Submission approved" : input.decision === "REWORK" ? "Sent back for correction" : "Submission rejected"); done(); },
            onError: (e) => toast(errorMessage(e), "error"),
          })
        }
      />
    </div>
  );
}

function Fact({ icon: Icon, label, value, sub }: { icon: typeof MapPin; label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-loss" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-[#64748B]">{label}</dt>
        <dd className="break-words text-sm font-medium text-[#172B4D]">{value}</dd>
        {sub && <dd className="text-xs text-[#64748B]">{sub}</dd>}
      </div>
    </div>
  );
}

type DecideInput = DecisionInput;

/** Approve (checklist + no rejected items of my stage) or reject / send back (reason; my rejected items become rework items). */
function FinalDecision({ mode, onClose, ctx, myRejected, photosById, busy, onSubmit }: { mode: "approve" | "reject" | null; onClose: () => void; ctx: ReviewCtx; myRejected: ItemReview[]; photosById: Map<string, WsPhoto>; busy: boolean; onSubmit: (i: DecideInput, done: () => void) => void }) {
  const { w, cur, stage, checks, setChecks, catLabel, boardLabel } = ctx;
  const [kind, setKind] = useState<"REWORK" | "REJECT">("REWORK");
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  if (!stage) return null;
  const close = () => { setText(""); setTouched(false); onClose(); };
  const itemTitle = (i: ItemReview) => (i.kind === "PHOTO" ? catLabel(photosById.get(i.ref)?.category ?? "Photo") : boardLabel(i.ref));
  const required = w.checklist.filter((c) => c.required !== false);
  const missing = required.filter((c) => !checks[c.key]);
  const checklist = w.checklist.map((c) => ({ key: c.key, passed: !!checks[c.key] }));

  if (mode === "approve") {
    const blocked = myRejected.length > 0;
    return (
      <Modal
        open
        onOpenChange={(o) => !o && close()}
        title="Approve submission"
        description={`${STAGE_NAME[stage]} approval of version ${cur.version}. The shop is approved only when every review stage approves this version.`}
        footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button className="bg-finance text-white hover:bg-[#047857]" loading={busy} disabled={blocked} onClick={() => { setTouched(true); if (!missing.length) onSubmit({ stage, decision: "APPROVE", versionNo: cur.version, comment: text.trim(), checklist, items: [] }, close); }}>Approve</Button></>}
      >
        {blocked && <p className="mb-3 rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#991B1B]" role="alert">{myRejected.length} item{myRejected.length > 1 ? "s are" : " is"} rejected by you. Clear the rejection or send the submission back for correction.</p>}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Checklist <span className="text-danger">*</span></legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {w.checklist.map((c) => (
              <label key={c.key} className="flex items-center gap-2 rounded-md border border-[#EEF2F7] px-2.5 py-2 text-sm">
                <input type="checkbox" className="size-4 accent-[#059669]" checked={!!checks[c.key]} onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))} />
                {c.label}{c.required === false && <span className="text-xs text-muted-foreground">(optional)</span>}
              </label>
            ))}
          </div>
          {touched && missing.length > 0 && <p className="mt-1 text-xs font-medium text-danger" role="alert">Tick: {missing.map((m) => m.label).join(", ")}</p>}
        </fieldset>
        <label className="mt-4 block text-sm font-medium">Comment (optional)<Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} className="mt-1.5" /></label>
      </Modal>
    );
  }
  if (mode !== "reject") return null;
  const reason = text.trim();
  const summary = myRejected.length ? `\nRejected items: ${myRejected.map((i) => `${itemTitle(i)} (${i.reason})`).join("; ")}` : "";
  const error = reason.length < 5 ? "Give a reason (at least 5 characters)" : "";
  const items = myRejected.map((i) => i.kind === "PHOTO" ? { type: "REPLACE_PHOTO", photo: i.ref, category: photosById.get(i.ref)?.category, note: i.reason.slice(0, 500) } : { type: "FIX_MEASUREMENT", mediaKey: i.ref, note: i.reason.slice(0, 500) });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && close()}
      title="Reject submission"
      description={`${STAGE_NAME[stage]} decision on version ${cur.version}.`}
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button variant="destructive" loading={busy} onClick={() => { setTouched(true); if (!error) onSubmit({ stage, decision: kind, versionNo: cur.version, comment: (reason + summary).slice(0, 2000), reason: kind === "REJECT" ? (reason + summary).slice(0, 2000) : undefined, checklist, items: kind === "REWORK" ? items : [] }, close); }}>{kind === "REWORK" ? "Send back for correction" : "Reject permanently"}</Button></>}
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Rejection type</legend>
        {([["REWORK", "Send back for correction", "The vendor / inhouse team corrects it and submits a new version."], ["REJECT", "Reject permanently", "Closes this shop's recce. Only an Admin can reopen it."]] as const).map(([k, l, d]) => (
          <label key={k} className={cn("cursor-pointer rounded-lg border p-3 text-sm", kind === k ? "border-loss bg-[#FEF2F2]" : "border-[#E2E8F0]")}>
            <span className="flex items-center gap-2 font-semibold text-[#172B4D]"><input type="radio" name="reject-kind" className="accent-[#DC2626]" checked={kind === k} onChange={() => setKind(k)} />{l}</span>
            <span className="mt-1 block text-xs text-[#64748B]">{d}</span>
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block text-sm font-medium">Reason <span className="text-danger">*</span><Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} className="mt-1.5" placeholder="What must be corrected" /></label>
      {touched && error && <p className="mt-1 text-xs font-medium text-danger" role="alert">{error}</p>}
      <div className="mt-4">
        <p className="text-sm font-medium">Rejected items included ({myRejected.length})</p>
        {myRejected.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No photo or measurement is rejected individually. Only the reason above is sent.</p> : (
          <ul className="mt-1.5 space-y-1">
            {myRejected.map((i) => <li key={i.id} className="rounded-md bg-[#FEF2F2] px-2.5 py-1.5 text-xs text-[#991B1B]"><b>{itemTitle(i)}</b> – {i.reason}</li>)}
          </ul>
        )}
      </div>
    </Modal>
  );
}
