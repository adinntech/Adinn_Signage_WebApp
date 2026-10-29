"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, History, MessagesSquare, Mic, StickyNote } from "lucide-react";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { NotesPanel } from "@/components/workspace/notes-panel";
import { VoiceList, VoiceRecorderCard } from "@/components/workspace/voice-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useWsOverview, type ActivityCategory } from "@/lib/api/workspace";
import { STATUS_META } from "@/lib/pipeline";

type Tab = "activity" | "notes" | "voice";

/** Project workspace (reference screen 12): Activity, Notes and Voice Notes, with the voice recorder beside them. */
export function WorkspaceView() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const o = useWsOverview(projectId);
  const [tab, setTab] = useState<Tab>("activity");
  const [category, setCategory] = useState<ActivityCategory | undefined>(undefined);

  if (o.isPending)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-96" />
      </div>
    );
  if (o.isError) return <ErrorState error={o.error} onRetry={() => o.refetch()} title="Could not open this workspace" />;
  const { project, counts } = o.data;
  const status = STATUS_META[project.status];
  const me = { id: user?.id ?? "", name: user?.name ?? "" };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.back()}>
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Button>
      <Card className="overflow-hidden">
        <GradientHeader
          title={`Activity, Notes & Voice Notes – ${project.code}`}
          subtitle={`${project.client.name} · ${project.name}`}
          right={
            <span className="flex items-center gap-2">
              {status && <Badge tone={status.tone}>{status.label}</Badge>}
              <Button size="sm" variant="outline" asChild className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href={`/connect?p=${projectId}`}>
                  <MessagesSquare className="size-4" aria-hidden /> Team chat
                </Link>
              </Button>
            </span>
          }
        />
        <div className="p-4 pb-0">
          <Tabs
            idPrefix="workspace"
            value={tab}
            onChange={setTab}
            items={[
              { key: "activity", label: "Activity", icon: History },
              { key: "notes", label: "Notes", icon: StickyNote, badge: counts.notes },
              { key: "voice", label: "Voice Notes", icon: Mic, badge: counts.voiceNotes },
            ]}
          />
        </div>
        <div className="grid items-start gap-5 p-4 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0" role="tabpanel">
            {tab === "activity" && <ActivityFeed pid={projectId} category={category} onCategory={setCategory} />}
            {tab === "notes" && <NotesPanel pid={projectId} me={me} />}
            {tab === "voice" && <VoiceList pid={projectId} />}
          </div>
          <div className="space-y-4">
            <VoiceRecorderCard pid={projectId} />
            {tab !== "voice" && (
              <Card className="p-4">
                <h2 className="mb-1 text-sm font-semibold text-primary">Saved Voice Notes</h2>
                <VoiceList pid={projectId} limit={3} onViewAll={() => setTab("voice")} />
              </Card>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
