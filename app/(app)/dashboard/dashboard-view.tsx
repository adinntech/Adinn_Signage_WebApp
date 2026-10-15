"use client";

import { motion } from "framer-motion";
import { CheckCircle2, FileInput, FolderKanban, Loader, MapPin, UserX, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "@/components/ui/role-badge";
import { useProjectSummary } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { WORKFLOW } from "@/lib/nav";

const STATS: { label: string; icon: LucideIcon; tone: string }[] = [
  { label: "New Requests", icon: FileInput, tone: "bg-secondary text-primary" },
  { label: "Projects", icon: FolderKanban, tone: "bg-secondary text-primary" },
  { label: "Total Sites", icon: MapPin, tone: "bg-secondary text-primary" },
  { label: "Unassigned", icon: UserX, tone: "bg-warning-soft text-warning" },
  { label: "In Progress", icon: Loader, tone: "bg-secondary text-accent" },
  { label: "Completed", icon: CheckCircle2, tone: "bg-success-soft text-success" },
];

export function DashboardView() {
  const { user, can } = useAuth();
  const canProjects = can("projects:read");
  const summary = useProjectSummary(canProjects);
  const live: Record<string, number | undefined> = {
    "New Requests": summary.data?.newRequests,
    Projects: summary.data?.total,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Welcome back, {user?.name}</h1>
        {user && <RoleBadge role={user.role} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              whileHover={{ y: -2 }}
            >
              <Card className="transition-shadow hover:shadow-card">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{s.label}</CardTitle>
                  <span className={`flex size-8 items-center justify-center rounded-lg ${s.tone}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                </CardHeader>
                <CardContent>
                  {s.label in live && canProjects ? (
                    summary.isPending ? (
                      <Skeleton className="h-9 w-16" />
                    ) : summary.isError ? (
                      <>
                        <p className="text-3xl font-semibold text-foreground">&mdash;</p>
                        <button type="button" onClick={() => summary.refetch()} className="mt-1 text-xs text-danger underline">
                          Could not load. Retry
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-semibold tabular-nums text-foreground">{formatNumber(live[s.label])}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.label === "New Requests" ? "Projects awaiting recce pickup." : "Total projects."}
                        </p>
                      </>
                    )
                  ) : (
                    <>
                      <p className="text-3xl font-semibold text-foreground">&mdash;</p>
                      <p className="mt-1 text-xs text-muted-foreground">Data arrives with later phases.</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-wrap gap-y-3 pt-2">
            {WORKFLOW.map((step, i) => (
              <li key={step} className="flex items-center">
                <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </span>
                {i < WORKFLOW.length - 1 && <span aria-hidden className="mx-2 h-px w-4 bg-border" />}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
