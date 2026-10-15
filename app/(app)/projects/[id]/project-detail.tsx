"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, History as HistoryIcon, Lock, Pencil } from "lucide-react";
import { MessageCard } from "@/components/communication/message-card";
import { ProjectCommunication } from "@/components/communication/project-communication";
import { EditProjectDialog, StatusReasonDialog } from "@/components/projects/project-dialogs";
import { PriorityBadge, StatusBadge } from "@/components/projects/badges";
import { RequirementPanel } from "@/components/projects/requirement-panel";
import { SitesTab } from "@/components/sites/sites-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api";
import { useMessages } from "@/lib/api/communications";
import {
  PROJECT_STATUSES,
  useChangeStatus,
  useProject,
  useProjectHistory,
  type Project,
  type ProjectStatus,
} from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatNumber, label } from "@/lib/format";
import { cn } from "@/lib/utils";

const LATER_TABS = [
  "Recce Planning",
  "Assignment",
  "Field Activity",
  "Verification",
  "Reports",
  "Client Approval",
  "Vendor",
  "Expenses",
  "Payment",
  "PO",
  "Issues",
  "Operations Handover",
];

type TabKey = "overview" | "requirement" | "sites" | "communication" | "history";

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children || <span className="text-muted-foreground">-</span>}</dd>
    </div>
  );
}

function Overview({ project }: { project: Project }) {
  const { can } = useAuth();
  const recent = useMessages({ projectId: project._id, limit: 5, sort: "-sentAt" }, can("communications:read"));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-primary">Key facts</h2>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Fact k="Client">{project.client?.name}</Fact>
            <Fact k="Campaign">{project.campaign}</Fact>
            <Fact k="Target date">{project.targetDate ? formatDate(project.targetDate) : ""}</Fact>
            <Fact k="BD owner">{project.owner?.name}</Fact>
            <Fact k="Recce coordinator">{project.coordinator?.name}</Fact>
            <Fact k="Recce required">{project.recceRequired === undefined ? "" : project.recceRequired ? "Yes" : "No"}</Fact>
            <Fact k="Created">{formatDateTime(project.createdAt)}</Fact>
            <Fact k="Created by">{project.createdBy?.name}</Fact>
            <Fact k="Updated">{formatDateTime(project.updatedAt)}</Fact>
          </dl>
          {project.statusReason && (
            <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              <span className="font-medium">Status reason:</span> {project.statusReason}
            </p>
          )}
          {project.description && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{project.description}</p>}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{formatNumber(project.siteCount)}</p>
              <p className="text-xs text-muted-foreground">Sites</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {project.requirement?.expectedSites !== undefined ? formatNumber(project.requirement.expectedSites) : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Expected sites</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {can("communications:read") && (
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-primary">Recent activity</h2>
            {recent.isPending ? (
              <RowsSkeleton rows={3} className="p-0" />
            ) : recent.isError ? (
              <ErrorState error={recent.error} onRetry={() => recent.refetch()} className="py-6" />
            ) : recent.data.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-2">
                {recent.data.data.map((m) => (
                  <li key={m._id}>
                    <MessageCard message={m} projectId={project._id} showActions={false} />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function History({ id }: { id: string }) {
  const q = useProjectHistory(id);
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-primary">Audit history</h2>
        {q.isPending ? (
          <RowsSkeleton rows={4} className="p-0" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="No history yet" />
        ) : (
          <ol className="space-y-4">
            {q.data.map((e) => (
              <li key={e._id} className="border-l-2 border-border pl-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="primary">{label(e.action)}</Badge>
                  <span className="font-medium">{label(e.entity)}</span>
                  <span className="text-muted-foreground">by {e.user?.name ?? "System"}</span>
                  <time dateTime={e.at} className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(e.at)}
                  </time>
                </div>
                {e.reason && <p className="mt-1 text-sm">Reason: {e.reason}</p>}
                {e.changes?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {e.changes.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium text-foreground">{c.field}</span>:{" "}
                        <span className="line-through">{fmt(c.oldValue)}</span> {"->"} <span>{fmt(c.newValue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function StatusMenu({ project }: { project: Project }) {
  const toast = useToast();
  const change = useChangeStatus(project._id);
  const [reasonFor, setReasonFor] = useState<ProjectStatus | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" loading={change.isPending}>
            Change status <ChevronDown className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {PROJECT_STATUSES.filter((s) => s !== project.status).map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={async () => {
                if (s === "ON_HOLD" || s === "CANCELLED") return setReasonFor(s);
                try {
                  await change.mutateAsync({ status: s });
                  toast(`Status changed to ${label(s)}`);
                } catch (e) {
                  toast(errorMessage(e), "error");
                }
              }}
            >
              {label(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {reasonFor && <StatusReasonDialog project={project} status={reasonFor} onClose={() => setReasonFor(null)} />}
    </>
  );
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const { can } = useAuth();
  const q = useProject(id);
  const [editing, setEditing] = useState(false);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "requirement", label: "Requirement" },
    ...(can("sites:read") ? [{ key: "sites" as const, label: "Sites" }] : []),
    ...(can("communications:read") ? [{ key: "communication" as const, label: "Communication" }] : []),
    { key: "history", label: "History" },
  ];
  const requested = search.get("tab");
  const tab: TabKey = tabs.some((t) => t.key === requested) ? (requested as TabKey) : "overview";

  if (q.isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-4" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (q.isError) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="size-4" aria-hidden /> Projects
          </Link>
        </Button>
        <Card className="mt-2">
          <ErrorState title={notFound ? "Project not found" : "Could not load project"} error={q.error} onRetry={notFound ? undefined : () => q.refetch()} />
        </Card>
      </div>
    );
  }
  const p = q.data;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4">
      <header className="shrink-0 space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/projects">
            <ArrowLeft className="size-4" aria-hidden /> Projects
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-primary">{p.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.client?.name}
              {p.campaign ? ` - ${p.campaign}` : ""} &middot; Owner: {p.owner?.name ?? "Unassigned"} &middot; Coordinator:{" "}
              {p.coordinator?.name ?? "Unassigned"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <PriorityBadge priority={p.priority} />
            {can("projects:write") && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden /> Edit
                </Button>
                <StatusMenu project={p} />
              </>
            )}
          </div>
        </div>

        <div role="tablist" aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => router.replace(`/projects/${id}?tab=${t.key}`, { scroll: false })}
              className={cn(
                "relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {tab === t.key && <motion.span layoutId="project-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
            </button>
          ))}
          {LATER_TABS.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              disabled
              aria-disabled="true"
              title="Later phase"
              className="flex cursor-not-allowed items-center gap-1 whitespace-nowrap px-3 py-2 text-sm text-muted-foreground/50"
            >
              <Lock className="size-3" aria-hidden /> {t}
              <span className="sr-only"> (later phase)</span>
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            role="tabpanel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "overview" && <Overview project={p} />}
            {tab === "requirement" && <RequirementPanel project={p} />}
            {tab === "sites" && <SitesTab project={p} />}
            {tab === "communication" && <ProjectCommunication project={p} />}
            {tab === "history" && <History id={p._id} />}
          </motion.div>
        </AnimatePresence>
      </div>
      {editing && <EditProjectDialog project={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
