"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, Ban, CalendarDays, ClipboardList, FileSpreadsheet, FileText, Handshake, History, Mail, MapPin, Phone, Route, ShieldCheck, Store, Truck, type LucideIcon } from "lucide-react";
import { ProjectStatusBadge } from "@/components/bd/status-badge";
import { ShopApprovals } from "@/components/approvals/shop-approvals";
import { SitesTab } from "@/components/sites/sites-tab";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradientHeader } from "@/components/ui/gradient-header";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ProjectDocuments } from "@/components/upload/project-documents";
import { errorMessage } from "@/lib/api";
import { useAdvanceStage } from "@/lib/api/pipeline";
import { useProject, useProjectHistory, type AuditEntry } from "@/lib/api/projects";
import { useProjectHandover } from "@/lib/api/recce";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { OPS_NEXT, OPS_STAGE_LABEL, PRIORITY_CLASS, PRIORITY_LABEL, STATUS_META, isOverdue, reqLabel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { AsoSurvey } from "./aso-survey";
import { BdHandover } from "./bd-handover";

type TabKey = "overview" | "handover" | "work" | "approvals" | "documents" | "history";
const TAB_KEYS: TabKey[] = ["overview", "handover", "work", "approvals", "documents", "history"];

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-foreground">{children}</dd>
    </div>
  );
}

function QuickAction({ icon: Icon, label, hint, color, onClick, soon }: { icon: LucideIcon; label: string; hint: string; color: string; onClick?: () => void; soon?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soon}
      className={cn("flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-3 text-left transition-shadow", soon ? "opacity-60" : "hover:border-royal/40 hover:shadow-card")}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl", color)}><Icon className="size-5" aria-hidden /></span>
      <span className="text-sm font-semibold text-navy">{label}</span>
      <span className="text-xs text-muted-foreground">{soon ? "Coming in the next phase" : hint}</span>
    </button>
  );
}

const auditText = (a: AuditEntry) =>
  a.action === "CREATE" ? "Project created"
  : a.action === "ASSIGN" ? (a.reason ?? "Assigned to Operations")
  : a.action === "STATUS_CHANGE" ? `Status: ${a.changes[0]?.oldValue ?? "-"} → ${a.changes[0]?.newValue ?? "-"}`
  : a.action === "UPLOAD" ? "Client document uploaded"
  : a.action === "IMPORT_SITES" ? (a.reason ?? "Shops imported")
  : a.action === "APPROVAL" ? (a.reason ?? "Approval updated")
  : a.action === "UPDATE" ? "Project details updated"
  : a.action.toLowerCase();

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { can } = useAuth();
  const project = useProject(id);
  const history = useProjectHistory(id);
  // Projects created from Lead Management > Assign to Recce Team carry the BD handover (null for the others).
  const handover = useProjectHandover(id);
  const advance = useAdvanceStage();
  // The selected tab lives in the address (?tab=documents), so a notification link opens the right tab even when this project is already on screen.
  const router = useRouter();
  const wanted = useSearchParams().get("tab");
  const tab: TabKey = TAB_KEYS.includes(wanted as TabKey) ? (wanted as TabKey) : "overview";
  const setTab = (k: TabKey) => router.replace(`?tab=${k}`, { scroll: false });

  if (project.isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading project…</p>;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not load the project" />;
  const p = project.data;
  if (!p.assignedTo) {
    return <ErrorState title="Not assigned to Operations yet" error={new Error("BD has not assigned this project to Operations.")} />;
  }

  const aso = p.requirementType === "ASO";
  const measure = p.requirementType === "SHOP_MEASUREMENT";
  const next = OPS_NEXT[p.status];
  const overdue = isOverdue(p);
  const cancelled = p.status === "CANCELLED";
  const canWork = can("sites:write") && !cancelled;
  const workLabel = aso ? "Area Survey" : measure ? "Shops & Measurements" : "Shop List";

  const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: "overview", label: "Overview", icon: ClipboardList },
    ...(handover.data ? [{ key: "handover" as const, label: "BD Handover", icon: Handshake }] : []),
    { key: "work", label: workLabel, icon: aso ? MapPin : Store },
    ...(measure ? [{ key: "approvals" as const, label: "Approvals", icon: ShieldCheck }] : []),
    { key: "documents", label: "Documents", icon: FileText },
    { key: "history", label: "History", icon: History },
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
    <div className="mx-auto max-w-[1300px] space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader
          code="B3"
          title={`Project Details – ${p.client?.name} · ${p.campaign}`}
          subtitle={`${p.code} · ${reqLabel(p.requirementType)}`}
          right={
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_META[p.status]?.tone ?? "neutral"}>{OPS_STAGE_LABEL[p.status] ?? STATUS_META[p.status]?.label ?? p.status}</Badge>
              <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white">
                <Link href="/operations/dashboard"><ArrowLeft className="size-4" aria-hidden /> Dashboard</Link>
              </Button>
            </div>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", PRIORITY_CLASS[p.priority])}>{PRIORITY_LABEL[p.priority]} priority</span>
            <span className={cn("flex items-center gap-1", overdue ? "font-semibold text-loss" : "text-muted-foreground")}>
              <CalendarDays className="size-4" aria-hidden /> Due {formatDate(p.targetDate)}{overdue && " · Overdue"}
            </span>
            <span className="text-muted-foreground">BD status:</span>
            <ProjectStatusBadge status={p.status} />
          </div>
          {next && canWork && !cancelled && (
            <Button className="bg-approval hover:bg-approval/90" loading={advance.isPending} onClick={advanceStage}>
              {next.label} <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
        <Tabs label="Project sections" value={tab} onChange={(k) => setTab(k as TabKey)} tabs={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))} />
      </div>

      {cancelled && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><strong>Cancelled by BD.</strong> {p.statusReason ?? "No reason recorded."} This project is read-only.</p>
        </div>
      )}

      <TabPanel k={tab} className="space-y-5">
      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="space-y-5">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-soft">
              <h2 className="mb-1 text-sm font-semibold text-navy">Project Information</h2>
              <dl className="divide-y divide-border">
                <Info label="Project Code">{p.code}</Info>
                <Info label="Client">{p.client?.name}</Info>
                <Info label="Campaign">{p.campaign}</Info>
                <Info label="District">{p.district || "-"}</Info>
                <Info label="Start Date">{formatDate(p.startDate)}</Info>
                <Info label="End Date">{formatDate(p.targetDate)}</Info>
                <Info label="Total Shops">{aso ? "Unknown (ASO survey)" : `${p.siteCount} imported of ${p.expectedShops ?? "-"} expected`}</Info>
                <Info label="Requirement">{reqLabel(p.requirementType)}</Info>
                <Info label="Assigned By">{p.owner?.name ?? p.createdBy?.name ?? "BD"} (BD)</Info>
                <Info label="Assigned To">{p.assignedTo.name}</Info>
              </dl>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-soft">
              <h2 className="mb-2 text-sm font-semibold text-navy">Client / SO contacts</h2>
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
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 shadow-soft">
            <h2 className="mb-3 text-sm font-semibold text-navy">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {!aso && (
                <QuickAction icon={FileSpreadsheet} label="Import Shop List" hint={p.siteCount === 0 ? "Excel / CSV · pending" : "Add more shops"} color="bg-[#e8f0ff] text-royal" onClick={() => setTab("work")} />
              )}
              <QuickAction icon={aso ? MapPin : Store} label={aso ? "Record Survey Areas" : "View Shops"} hint={aso ? "Areas, shops found, proof" : `${p.siteCount} shops`} color="bg-[#dcf7f3] text-recce" onClick={() => setTab("work")} />
              <QuickAction icon={FileText} label="Requirements & Instructions" hint="Files from BD" color="bg-[#f1e6ff] text-vendor" onClick={() => setTab("documents")} />
              <QuickAction icon={BarChart3} label="Cost Comparison" hint="" color="bg-[#fff0e0] text-approval" soon />
              <QuickAction icon={Route} label="Shop Allocation & Routes" hint="" color="bg-[#e8f0ff] text-royal" soon />
              <QuickAction icon={Truck} label="Field Monitoring" hint="" color="bg-[#ffe9ee] text-[#e11d48]" soon />
            </div>
          </section>
        </div>
      )}

      {tab === "handover" && handover.data && <BdHandover projectId={p._id} h={handover.data} />}
      {tab === "work" && (aso ? <AsoSurvey projectId={p._id} canEdit={canWork} /> : <SitesTab project={p} readOnly={cancelled} />)}

      {tab === "approvals" && (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-soft">
          <div>
            <h2 className="text-sm font-semibold text-navy">Shop measurement approvals</h2>
            <p className="text-xs text-muted-foreground">Operations and BD approve independently. Every shop needs both before the recce can start. Changing a shop&apos;s size or board type sends it back to pending.</p>
          </div>
          <ShopApprovals projectId={p._id} readOnly={cancelled} />
        </section>
      )}

      {tab === "documents" && (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold text-navy">Documents from BD</h2>
          <ProjectDocuments projectId={p._id} category="BD_CLIENT_DETAILS" canEdit={false} emptyText="BD has not attached any files." />
        </section>
      )}

      {tab === "history" && (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold text-navy">Activity history</h2>
          {history.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          ) : (
            <ol className="space-y-4 border-l-2 border-border pl-4">
              {history.data.map((h) => (
                <li key={h._id} className="relative text-sm">
                  <span aria-hidden className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-royal ring-4 ring-white" />
                  <p className="font-medium">{auditText(h)}</p>
                  <p className="text-xs text-muted-foreground">{h.user?.name ?? "System"} · {formatDateTime(h.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      </TabPanel>
    </div>
  );
}
