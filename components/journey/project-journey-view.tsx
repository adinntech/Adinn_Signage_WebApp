"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Flag, ListOrdered, NotebookPen, Route, TriangleAlert, Waypoints } from "lucide-react";
import { JourneyPath } from "@/components/journey/journey-path";
import { StagePanel } from "@/components/journey/stage-panel";
import { MilestoneTimeline, StageNavigator } from "@/components/journey/stage-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useJourney, type StageKey } from "@/lib/api/journey";
import { STATUS_META } from "@/lib/pipeline";
import { formatDate } from "@/lib/format";

type View = "journey" | "timeline" | "navigator";

/** One project's journey for admins: the curved flow, a milestone timeline or a stage navigator, all driving the same stage panel. */
export function ProjectJourneyView() {
  const { id } = useParams<{ id: string }>();
  const q = useJourney(id);
  const [view, setView] = useState<View>("journey");
  const [picked, setPicked] = useState<StageKey | null>(null);

  if (q.isPending)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const j = q.data;
  const selected = picked ?? j.currentStage;
  const stage = j.stages.find((s) => s.key === selected) ?? j.stages[0]!;
  const meta = STATUS_META[j.project.status];
  const current = j.stages.find((s) => s.key === j.currentStage)!;
  const overdue = j.stages.filter((s) => s.overdue).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/projects">
          <ArrowLeft className="size-4" aria-hidden /> Back to Portfolio
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <GradientHeader
          title={`Project Journey – ${j.project.code}`}
          subtitle={`${j.project.client.name} · ${j.project.name}`}
          right={
            <span className="flex items-center gap-2">
              <Badge tone={meta?.tone ?? "neutral"}>{meta?.label ?? j.project.status}</Badge>
              <Button size="sm" variant="outline" asChild className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href={`/workspace/${j.project._id}`}>
                  <NotebookPen className="size-4" aria-hidden /> Activity &amp; Notes
                </Link>
              </Button>
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
          <KpiCard label="Journey Complete" value={`${j.progress}%`} icon={Route} color="blue" />
          <KpiCard label="Current Stage" value={current.label} icon={Flag} color="teal" delay={0.05} />
          <KpiCard label="Overdue Stages" value={overdue} icon={TriangleAlert} color={overdue ? "red" : "green"} delay={0.1} />
          <KpiCard label="Target Date" value={j.project.targetDate ? formatDate(j.project.targetDate) : "Not set"} icon={ListOrdered} color="purple" delay={0.15} hint={j.project.assignedTo ? `Recce: ${j.project.assignedTo}` : undefined} />
        </div>
      </Card>

      <Tabs
        idPrefix="journey-view"
        value={view}
        onChange={setView}
        items={[
          { key: "journey", label: "Curved Journey", icon: Waypoints },
          { key: "timeline", label: "Milestone Timeline", icon: ListOrdered },
          { key: "navigator", label: "Stage Navigator", icon: Route },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <Card className="p-5">
          {view === "journey" && (
            <>
              <div className="hidden pb-16 sm:block">
                <JourneyPath stages={j.stages} selected={selected} onSelect={setPicked} />
              </div>
              <div className="sm:hidden">
                <p className="mb-3 text-xs text-muted-foreground">The curved view needs a wider screen. Use the stage list.</p>
                <StageNavigator stages={j.stages} selected={selected} onSelect={setPicked} />
              </div>
            </>
          )}
          {view === "timeline" && <MilestoneTimeline stages={j.stages} selected={selected} onSelect={setPicked} />}
          {view === "navigator" && <StageNavigator stages={j.stages} selected={selected} onSelect={setPicked} />}
        </Card>
        <Card className="p-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
          <StagePanel stage={stage} />
        </Card>
      </div>
    </div>
  );
}
