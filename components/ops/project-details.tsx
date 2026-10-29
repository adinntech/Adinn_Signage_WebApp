"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BarChart3, Ban, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, FileText, Files, Handshake, History, Mail, MapPin, MessageSquareText, Paperclip,
  Phone, PlusCircle, Route, Store, UsersRound, type LucideIcon,
} from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { KpiCard, type KpiColor } from "@/components/ui/kpi-card";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { SitesTab } from "@/components/sites/sites-tab";
import { Stepper } from "@/components/workflow/stepper";
import { errorMessage } from "@/lib/api";
import { useAdvanceStage, useApprovalSummary, useProjectFiles, useSurveyAreas } from "@/lib/api/pipeline";
import { useProject } from "@/lib/api/projects";
import { useProjectHandover } from "@/lib/api/recce";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { OPS_NEXT, OPS_STAGE_LABEL, PRIORITY_CLASS, PRIORITY_LABEL, STATUS_META, isOverdue, reqLabel, totalExpected } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { AsoSurvey } from "./aso-survey";
import { BdHandover } from "./bd-handover";
import { BoardOptions } from "./board-options";
import { MeasurementStage } from "./measurement-stage";
import { ActivityTimeline, ProjectNotes } from "./project-activity";
import { ProjectDocumentsPanel } from "./project-documents-panel";
import { RequirementPanel } from "./requirement-panel";
import { ShopDetailsStage } from "./shop-details-stage";

const STAGES = [
  { status: "RECCE_ASSIGNED", label: "Assigned" },
  { status: "PLANNING", label: "Planning" },
  { status: "IN_PROGRESS", label: "Recce" },
  { status: "CLIENT_APPROVAL", label: "Client Approval" },
  { status: "COMPLETED", label: "Completed" },
];

const WORKSPACE_TITLE = { ASO: "ASO Area Survey", SHOP_DETAILS: "Client Shop Details Only", SHOP_MEASUREMENT: "Shop Details with Measurements" } as const;

function QuickAction({ icon: Icon, label, hint, color, onClick }: { icon: LucideIcon; label: string; hint: string; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-shadow hover:border-royal/40 hover:shadow-card">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", color)}><Icon className="size-5" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-navy">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function Section({ id, icon: Icon, title, hint, children, className }: { id?: string; icon: LucideIcon; title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-4 rounded-xl border border-border bg-surface p-4 shadow-soft", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-royal" aria-hidden />
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * One workspace per project (no tabs to hunt through): summary and stage, key numbers, the requirement's own work area,
 * then documents, contacts, quick actions and recent activity.
 */
export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { can } = useAuth();
  const router = useRouter();
  const project = useProject(id);
  const advance = useAdvanceStage();
  const loaded = project.data?.assignedTo ? project.data : undefined;
  const aso = loaded?.requirementType === "ASO";
  const areas = useSurveyAreas(id, aso);
  const approvals = useApprovalSummary(id, !!loaded && !aso);
  const bdFiles = useProjectFiles(id, "BD_CLIENT_DETAILS");
  // Projects assigned from Lead Management > Assign to Recce Team carry the BD handover (null for the others).
  const handover = useProjectHandover(id);
  const proofFiles = useProjectFiles(id, "OPS_SURVEY_PROOF");
  const [asoPart, setAsoPart] = useState<"areas" | "shops" | "boards">("areas");
  // Notification links such as ?tab=documents jump to that section.
  const wanted = useSearchParams().get("tab");
  useEffect(() => {
    if (wanted && loaded) document.getElementById(wanted)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [wanted, loaded]);

  if (project.isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading project…</p>;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not load the project" />;
  const p = project.data;
  if (!p.assignedTo) return <ErrorState title="Not assigned to Operations yet" error={new Error("BD has not assigned this project to Operations.")} />;

  const measure = p.requirementType === "SHOP_MEASUREMENT";
  const next = OPS_NEXT[p.status];
  const overdue = isOverdue(p);
  const lost = p.status === "LOSS";
  const cancelled = p.status === "CANCELLED" || lost; // both close the project: read-only
  const canWork = can("sites:write") && !cancelled;
  const expected = totalExpected(p);
  const pct = expected ? Math.min(100, Math.round((p.siteCount / expected) * 100)) : 0;
  const stageIndex = Math.max(0, STAGES.findIndex((x) => x.status === p.status));
  const daysLeft = p.targetDate ? Math.ceil((new Date(p.targetDate.slice(0, 10)).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86_400_000) : null;
  const contact = p.contacts?.[0];

  const kpis: { label: string; value: string | number; icon: LucideIcon; color: KpiColor }[] = aso
    ? [
        { label: "Shops discovered (unknown at start)", value: p.siteCount, icon: Store, color: "blue" },
        { label: "Areas surveyed", value: areas.data?.length ?? "–", icon: MapPin, color: "green" },
        { label: "Proof files uploaded", value: proofFiles.data?.length ?? "–", icon: Paperclip, color: "orange" },
        { label: daysLeft === null ? "Expected completion" : daysLeft < 0 ? `Overdue by ${-daysLeft} day${daysLeft === -1 ? "" : "s"}` : `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, value: formatDate(p.targetDate), icon: CalendarClock, color: overdue ? "red" : "rose" },
      ]
    : [
        { label: `Shops imported / ${expected || "-"} expected`, value: p.siteCount, icon: Store, color: "blue" },
        { label: "Pending verification", value: approvals.data ? approvals.data.ops.pending : "–", icon: ClipboardList, color: "orange" },
        { label: "Additional shops found", value: p.additionalShops ?? 0, icon: PlusCircle, color: "purple" },
        { label: "Files from BD", value: bdFiles.data?.length ?? "–", icon: Files, color: "teal" },
      ];

  function advanceStage() {
    if (!next) return;
    advance.mutate(
      { id: p._id, stage: next.to },
      {
        onSuccess: () => toast(`${p.code}: ${OPS_STAGE_LABEL[next.to] ?? next.to}`),
        onError: (e) => toast(errorMessage(e), "error"), // e.g. "Import or add shops before starting the recce"
      },
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="overflow-hidden rounded-xl bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#0ea5e9] text-white shadow-soft">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg font-bold ring-1 ring-white/40">{p.client?.name?.[0] ?? "P"}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">Project Workspace – {p.requirementType ? WORKSPACE_TITLE[p.requirementType] : "Project"}</h1>
            <p className="truncate text-sm text-white/85">{p.client?.name} · {p.campaign} · Code {p.code} · {reqLabel(p.requirementType)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={cn("rounded-full px-3 py-1", PRIORITY_CLASS[p.priority])}>{PRIORITY_LABEL[p.priority]} priority</span>
            <span className="rounded-full bg-white/20 px-3 py-1 ring-1 ring-white/40">{OPS_STAGE_LABEL[p.status] ?? STATUS_META[p.status]?.label ?? p.status}</span>
            <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 ring-1 ring-white/40", overdue ? "bg-loss" : "bg-white/20")}>
              <CalendarDays className="size-3.5" aria-hidden /> Due {formatDate(p.targetDate)}
            </span>
          </div>
          {next && canWork && (
            <Button className="bg-approval text-white ring-2 ring-white/70 hover:bg-approval/90" loading={advance.isPending} onClick={advanceStage}>
              {next.label} <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white">
            <Link href="/operations/projects"><ArrowLeft className="size-4" aria-hidden /> Projects</Link>
          </Button>
        </div>
      </header>

      <section aria-label="Project summary" className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-soft lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ["Client", p.client?.name],
            ["Campaign", p.campaign || "-"],
            ["District", p.district || "-"],
            ["Requirement", reqLabel(p.requirementType)],
            ["Assigned to", p.assignedTo.name],
            ["Assigned by", `${p.owner?.name ?? p.createdBy?.name ?? "BD"} (BD)`],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate font-semibold text-navy" title={String(v)}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-3 text-sm lg:border-l lg:border-border lg:pl-4">
          <div>
            <p className="text-xs text-muted-foreground">Start → End</p>
            <p className={cn("font-semibold", overdue ? "text-loss" : "text-navy")}>{formatDate(p.startDate)} → {formatDate(p.targetDate)}{overdue && " · Overdue"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Client / SO contact</p>
            {contact ? <p className="font-semibold text-navy">{contact.name}<span className="block text-xs font-normal text-muted-foreground">{contact.phone} · {contact.email}</span></p> : <p className="text-muted-foreground">Not shared</p>}
          </div>
        </div>
        <div className="lg:border-l lg:border-border lg:pl-4">
          <p className="text-xs text-muted-foreground">{aso ? "Shops entered (count unknown)" : "Project progress"}</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-navy">{aso ? p.siteCount : `${pct}%`}<span className="text-sm font-normal text-muted-foreground">{aso ? "" : ` · ${p.siteCount} / ${expected || "-"} shops`}</span></p>
          {!aso && !!p.additionalShops && <p className="text-xs text-[#be185d]">{p.expectedShops} client + {p.additionalShops} additional</p>}
          {!aso && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Shops imported" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="h-full rounded-full bg-finance transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {!cancelled && (
          <div className="overflow-x-auto border-t border-border pt-3 lg:col-span-3">
            <Stepper steps={STAGES.map((x) => x.label)} current={stageIndex} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} color={k.color} delay={i * 0.04} />)}
      </div>

      {cancelled && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><strong>{lost ? "Marked as LOSS." : "Cancelled by BD."}</strong> {p.statusReason ?? "No reason recorded."} This project is read-only.</p>
        </div>
      )}

      {handover.data && (
        <Section id="handover" icon={Handshake} title="BD Handover" hint={`From Lead Management · order ${handover.data.orderNo}: codes, Client ID, client, contacts, communication and the shop list`}>
          <BdHandover projectId={p._id} h={handover.data} />
        </Section>
      )}

      {aso ? (
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
      ) : measure ? (
        <MeasurementStage project={p} canEdit={canWork} readOnly={cancelled} />
      ) : (
        <ShopDetailsStage project={p} canEdit={canWork} readOnly={cancelled} />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section id="documents" icon={FileText} title="Project Documents" hint="Files from BD and from Operations in one place">
          <ProjectDocumentsPanel projectId={p._id} canEdit={canWork} />
        </Section>

        <div className="space-y-5">
          <Section icon={CheckCircle2} title="Quick Actions">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <QuickAction icon={BarChart3} label="Cost Comparison" hint="Vendor vs in-house, bills" color="bg-[#fff0e0] text-approval" onClick={() => router.push(`/operations/cost/${p._id}`)} />
              <QuickAction icon={MapPin} label="Shop Allocation" hint="Vendors, in-house, map" color="bg-[#e8f0ff] text-royal" onClick={() => router.push(`/operations/allocation/${p._id}`)} />
              <QuickAction icon={Route} label="Movement" hint="Day-wise road routes" color="bg-[#ffe9ee] text-[#e11d48]" onClick={() => router.push(`/operations/movement/${p._id}`)} />
            </div>
          </Section>

          <Section icon={UsersRound} title="Client / SO Contacts">
            {!p.contacts?.length ? (
              <p className="text-sm text-muted-foreground">No contacts shared.</p>
            ) : (
              <ul className="space-y-2">
                {p.contacts.map((c) => (
                  <li key={c._id ?? c.phone} className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">{c.name}</p>
                    <p className="mt-1 flex items-center gap-2 text-muted-foreground"><Mail className="size-3.5" aria-hidden />{c.email}</p>
                    <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5" aria-hidden />{c.phone}</p>
                  </li>
                ))}
              </ul>
            )}
            {p.instructions && <p className="mt-3 rounded-lg bg-[#eef4ff] p-3 text-sm text-navy"><strong>Instructions:</strong> {p.instructions}</p>}
          </Section>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section id="history" icon={History} title="Activity Timeline" hint="Everything that changed on this project">
          <ActivityTimeline projectId={p._id} />
        </Section>
        <Section id="notes" icon={MessageSquareText} title="Remarks & Internal Notes">
          <ProjectNotes projectId={p._id} canWrite={can("communications:write") && !cancelled} />
        </Section>
      </div>
    </div>
  );
}
