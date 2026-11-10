"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Ban, ChevronRight, FileText, History, MapPin, MessageSquareText, Store, Users, ClipboardList, CalendarRange, Megaphone, UserCheck, type LucideIcon } from "lucide-react";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { SitesTab } from "@/components/sites/sites-tab";
import { Stepper } from "@/components/workflow/stepper";
import { errorMessage } from "@/lib/api";
import { useCost, useReadiness } from "@/lib/api/costing";
import { useAdvanceStage, useSurveyAreas } from "@/lib/api/pipeline";
import { useProject } from "@/lib/api/projects";
import { useProjectHandover } from "@/lib/api/recce";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { OPS_NEXT, OPS_STAGE_LABEL, PRIORITY_CLASS, PRIORITY_LABEL, reqLabel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { AsoSurvey } from "./aso-survey";
import { BdAttachments } from "./bd-attachments";
import { BdHandover } from "./bd-handover";
import { BoardOptions } from "./board-options";
import { MeasurementStage } from "./measurement-stage";
import { PlanReview } from "./plan/plan-review";
import { PreSetup } from "./plan/pre-setup";
import { ActivityTimeline, ProjectNotes } from "./project-activity";
import { ProjectDocumentsPanel } from "./project-documents-panel";
import { RequirementPanel } from "./requirement-panel";
import { ShopDetailsStage } from "./shop-details-stage";

/** How "Handover details" opens. true: a panel sliding in from the right. false: a centred popup with tabs. Change this one value to switch. */
const HANDOVER_IN_DRAWER = true;

const STEPS = [
  { title: "Extract shops", hint: "Open the Excel BD attached, check the column mapping and import the shops." },
  { title: "Validate shops", hint: "Check each shop (address, area, size) and verify it. Only verified shops are planned." },
  { title: "Pre-setup", hint: "Vendors (cost, district, skills) and the in-house team are compared; the suggestion can be edited." },
  { title: "Allocate shops", hint: "Confirm the plan and give each area to its team or vendor." },
];

const Row = ({ icon: Icon, k, v }: { icon: LucideIcon; k: string; v?: React.ReactNode }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-royal/10 text-royal"><Icon className="size-4" aria-hidden /></span>
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="truncate text-sm font-medium text-navy">{v || "-"}</dd>
    </div>
  </div>
);

/**
 * One workspace per project. Top: project and client details on the left, the client's contact (POC) on the right, and
 * "Assigned by" opening the BD handover in a side drawer. Start Planning then shows two steps: import and verify the
 * shops from the BD Excel, and the pre-setup (smart suggestion of vendors / in-house, with editing and history).
 */
export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { can } = useAuth();
  const project = useProject(id);
  const advance = useAdvanceStage();
  const loaded = project.data?.assignedTo ? project.data : undefined;
  const aso = loaded?.requirementType === "ASO";
  const areas = useSurveyAreas(id, aso);
  // Projects assigned from Lead Management carry the BD handover (null for the others).
  const handover = useProjectHandover(id);
  const [asoPart, setAsoPart] = useState<"areas" | "shops" | "boards">("areas");
  // The planning step is remembered per project, so a refresh does not send the user back to step 1.
  const stepKey = `ops.plan.step.${id}`;
  const [step, setStepState] = useState(() => {
    try { const v = Number(window.localStorage.getItem(stepKey)); return Number.isInteger(v) && v >= 0 && v <= 3 ? v : 0; } catch { return 0; } // storage unavailable: start at step 1
  });
  const setStep = (n: number) => {
    setStepState(n);
    try { localStorage.setItem(stepKey, String(n)); } catch { /* ignore */ }
  };
  const ready = useReadiness(id).data;
  const cost = useCost(id);
  const [drawer, setDrawer] = useState(false);
  // Notification links such as ?tab=documents jump to that section.
  const wanted = useSearchParams().get("tab");
  const [lowerTab, setLowerTab] = useState<"documents" | "history" | "notes">(wanted === "history" || wanted === "notes" ? wanted : "documents");
  useEffect(() => {
    if (!wanted || !loaded) return;
    const inTabs = wanted === "documents" || wanted === "history" || wanted === "notes";
    document.getElementById(inTabs ? "project-tabs" : wanted)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [wanted, loaded]);

  if (project.isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading project…</p>;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not load the project" />;
  const p = project.data;
  if (!p.assignedTo) return <ErrorState title="Not assigned to Operations yet" error={new Error("BD has not assigned this project to Operations.")} />;

  const measure = p.requirementType === "SHOP_MEASUREMENT";
  const next = OPS_NEXT[p.status];
  const lost = p.status === "LOSS";
  const cancelled = p.status === "CANCELLED" || lost;
  const canWork = can("sites:write") && !cancelled;
  const planning = p.status !== "RECCE_ASSIGNED"; // the work area opens once planning has started
  const h = handover.data;
  const hasPoc = !!p.contacts?.length || !!p.instructions;
  const assignedBy = h?.assignedBy ?? p.owner?.name ?? p.createdBy?.name ?? "BD";
  const assignedAt = h?.assignedAt ?? p.assignedAt;

  const canNext = step === 0 ? p.siteCount > 0 : step === 1 ? (ready?.verified ?? 0) > 0 : step === 2 ? (cost.data?.plan.legs.length ?? 0) > 0 : false;
  const blocked = ["Extract at least one shop to go on.", "Verify at least one shop to go on.", "Press Use this plan to go on.", ""];

  function advanceStage() {
    if (!next) return;
    advance.mutate(
      { id: p._id, stage: next.to },
      { onSuccess: () => toast(`${p.code}: ${OPS_STAGE_LABEL[next.to] ?? next.to}`), onError: (e) => toast(errorMessage(e), "error") },
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/95 px-5 py-1 shadow-soft backdrop-blur">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-navy">{p.client?.name} · {p.code}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded px-2.5 py-1 font-medium", PRIORITY_CLASS[p.priority])}>{PRIORITY_LABEL[p.priority]} priority</span>
        </div>
        {next && canWork && (
          <Button className="bg-navy hover:bg-navy/90" loading={advance.isPending} onClick={advanceStage}>{next.label} <ArrowRight className="size-4" aria-hidden /></Button>
        )}
        <Button asChild variant="ghost" size="sm"><Link href="/operations/projects"><ArrowLeft className="size-4" aria-hidden /> Projects</Link></Button>
      </header>

      <section aria-label="Project details" className={cn("grid gap-4", hasPoc && "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="h-1 bg-gradient-to-r from-navy via-royal to-recce" aria-hidden />
          <div className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-navy">Project Details</h2>
            <dl className={cn("grid gap-3 sm:grid-cols-2", !hasPoc && "2xl:grid-cols-4")}>
              <Row icon={ClipboardList} k="Requirement" v={reqLabel(p.requirementType)} />
              <Row icon={Megaphone} k="Order / campaign" v={p.campaign} />
              <Row icon={CalendarRange} k="Start → End" v={`${formatDate(p.startDate)} → ${formatDate(p.targetDate)}`} />
              <Row icon={UserCheck} k="Assigned to" v={p.assignedTo.name} />
            </dl>
            <button type="button" onClick={() => setDrawer(true)} className="group mt-4 flex w-full items-center justify-between rounded-lg border border-royal/20 bg-royal/5 px-4 py-3 text-left text-sm transition-colors hover:border-royal/40 hover:bg-royal/10" aria-haspopup="dialog">
              <span><span className="text-xs text-muted-foreground">Assigned by</span><span className="block font-medium text-navy">{assignedBy} (BD){assignedAt ? ` · ${formatDateTime(assignedAt)}` : ""}</span></span>
              <span className="flex items-center gap-1 text-xs font-medium text-royal">Handover details <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
            </button>
          </div>
        </div>
        {hasPoc && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><Users className="size-4" aria-hidden /> POC Details</h2>
            {!!p.contacts?.length && (
              <ul className="space-y-2">
                {p.contacts.map((c) => (
                  <li key={c._id ?? c.phone} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-white">{(c.name || "?").slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-navy">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ") || "-"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {p.instructions && <p className={cn("text-sm text-muted-foreground", !!p.contacts?.length && "mt-3 border-t border-border pt-3")}><span className="font-medium text-navy">Additional: </span>{p.instructions}</p>}
          </div>
        )}
      </section>

      {cancelled && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><strong>{lost ? "Marked as LOSS." : "Cancelled by BD."}</strong> {p.statusReason ?? "No reason recorded."} This project is read-only.</p>
        </div>
      )}

      {!planning && !cancelled && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Press <strong className="text-navy">Start Planning</strong> to import the shops and set up vendors and the in-house team.</p>
      )}

      {(planning || cancelled) && (aso ? (
        <RequirementPanel n={1} tone="blue" title="ASO Area Survey" tag="Area Based Survey" description="Visit each area, note the shops found and the conversation, then enter shop details and board options. Shop count is unknown at the start.">
          <Tabs
            label="ASO sections"
            value={asoPart}
            onChange={(k) => setAsoPart(k as "areas" | "shops" | "boards")}
            tabs={[
              { key: "areas", label: "Survey areas & proof", icon: MapPin, count: areas.data?.length },
              { key: "shops", label: "Shop details (Excel / manual)", icon: Store, count: p.siteCount },
              { key: "boards", label: "Board options & client decision", icon: ClipboardList },
            ]}
          />
          {asoPart === "areas" ? <AsoSurvey projectId={p._id} canEdit={canWork} /> : asoPart === "shops" ? <SitesTab project={p} readOnly={cancelled} /> : <BoardOptions projectId={p._id} canEdit={canWork} />}
        </RequirementPanel>
      ) : (
        <section aria-label="Planning" className="rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto border-b border-border bg-muted/30 px-5 py-4"><Stepper fill steps={STEPS.map((x) => x.title)} current={step} onStep={(i) => setStep(i)} /></div>
          <div className="p-4">
            <h2 className="text-base font-semibold text-navy">{step + 1}. {STEPS[step]!.title}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{STEPS[step]!.hint}</p>
            {step === 0 && (
              <div className="space-y-3">
                <BdAttachments project={p} canEdit={canWork} readOnly={cancelled} />
                <p className="text-sm text-muted-foreground"><strong className="text-navy">{p.siteCount}</strong> shop(s) extracted so far.</p>
              </div>
            )}
            {step === 1 && ready && (
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {([["Shops", ready.total], ["Verified", ready.verified], ["Needs verification", ready.unverified], ["No address", ready.noAddress]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-surface p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k}</p><p className="text-xl font-semibold tabular-nums text-navy">{v}</p></div>
                ))}
              </div>
            )}
            {step === 1 && (measure ? <MeasurementStage project={p} canEdit={canWork} readOnly={cancelled} hideAttachments /> : <ShopDetailsStage project={p} canEdit={canWork} readOnly={cancelled} hideAttachments />)}
            {step === 2 && <PreSetup projectId={p._id} canEdit={canWork} />}
            {step === 3 && (cost.data ? <PlanReview projectId={p._id} view={cost.data} dirty={false} closed={cancelled} /> : <p className="text-sm text-muted-foreground">Loading the plan…</p>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" aria-hidden /> Back</Button>
            <span className="text-xs text-muted-foreground">{step < 3 && !canNext ? blocked[step] : ""}</span>
            {step < 3 ? <Button className="bg-navy hover:bg-navy/90" disabled={!canNext} onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]!.title} <ArrowRight className="size-4" aria-hidden /></Button> : <span />}
          </div>
        </section>
      ))}

      <section id="project-tabs" className="scroll-mt-4 overflow-hidden rounded-lg border border-border bg-surface">
        <Tabs
          label="Project sections"
          className="border-b border-border bg-muted/30 px-4 pt-2"
          value={lowerTab}
          onChange={(k) => setLowerTab(k as typeof lowerTab)}
          tabs={[
            { key: "documents", label: "Documents", icon: FileText },
            { key: "history", label: "Activity Timeline", icon: History },
            { key: "notes", label: "Remarks & Notes", icon: MessageSquareText },
          ]}
        />
        <TabPanel k={lowerTab} className="p-4">
          {lowerTab === "documents" && <ProjectDocumentsPanel projectId={p._id} canEdit={canWork} />}
          {lowerTab === "history" && <ActivityTimeline projectId={p._id} />}
          {lowerTab === "notes" && <ProjectNotes projectId={p._id} canWrite={can("communications:write") && !cancelled} />}
        </TabPanel>
      </section>

      <Modal open={drawer} onOpenChange={setDrawer} variant={HANDOVER_IN_DRAWER ? "drawer" : "dialog"} title="BD handover" description={h ? `From Lead Management · order ${h.orderNo}` : "Details shared by BD"} className={HANDOVER_IN_DRAWER ? "max-w-3xl" : "h-[88dvh] max-w-5xl rounded-xl border border-border"}>
        {h ? <BdHandover projectId={p._id} h={h} tabbed={!HANDOVER_IN_DRAWER} /> : <p className="text-sm text-muted-foreground">This project was not assigned from Lead Management, so there are no handover details beyond the ones shown on the page.</p>}
      </Modal>
    </div>
  );
}
