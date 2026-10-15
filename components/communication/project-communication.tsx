"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, Plus, StickyNote } from "lucide-react";
import { GroupsPanel } from "@/components/communication/groups-panel";
import { ComposeDialog, type ComposeMode } from "@/components/communication/compose-dialog";
import { MessageCard } from "@/components/communication/message-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useMessagesInfinite } from "@/lib/api/communications";
import type { Project } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Segment = "timeline" | "mail" | "groups";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "mail", label: "Mail" },
  { key: "groups", label: "Groups" },
];
const TYPE_FILTERS = [
  { value: "", label: "All types" },
  { value: "EMAIL", label: "Emails" },
  { value: "NOTE", label: "Notes" },
  { value: "APPROVAL", label: "Approvals" },
  { value: "SYSTEM", label: "System events" },
  { value: "WHATSAPP_REF", label: "WhatsApp refs" },
  { value: "FILE", label: "Files" },
];

function Feed({ projectId, fixedType, onCompose }: { projectId: string; fixedType?: string; onCompose: (m: ComposeMode) => void }) {
  const { can } = useAuth();
  const [type, setType] = useState("");
  const effective = fixedType ?? type;
  const q = useMessagesInfinite({ projectId, type: effective, limit: 20, sort: "-sentAt" });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const write = can("communications:write");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!fixedType && (
          <div className="w-44">
            <Select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_FILTERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        {write && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onCompose("note")}>
              <StickyNote className="size-4" aria-hidden /> Add note
            </Button>
            <Button size="sm" onClick={() => onCompose("log")}>
              <Mail className="size-4" aria-hidden /> Log email
            </Button>
          </div>
        )}
      </div>

      {q.isPending ? (
        <RowsSkeleton rows={5} className="p-0" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={effective ? "Nothing of this type yet" : "No activity yet"}
          description={write ? "Add a note or log an email to start the conversation record." : undefined}
          action={
            write ? (
              <Button size="sm" onClick={() => onCompose("note")}>
                <Plus className="size-4" aria-hidden /> Add note
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ol className="space-y-3">
            {items.map((m, i) => (
              <motion.li
                key={m._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.02 }}
              >
                <MessageCard message={m} projectId={projectId} />
              </motion.li>
            ))}
          </ol>
          {q.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ProjectCommunication({ project }: { project: Project }) {
  const [segment, setSegment] = useState<Segment>("timeline");
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Communication sections" className="inline-flex rounded-lg bg-muted p-1">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            role="tab"
            type="button"
            aria-selected={segment === s.key}
            onClick={() => setSegment(s.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              segment === s.key ? "bg-surface text-primary shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {segment === "timeline" && <Feed projectId={project._id} onCompose={setCompose} />}
      {segment === "mail" && <Feed projectId={project._id} fixedType="EMAIL" onCompose={setCompose} />}
      {segment === "groups" && <GroupsPanel project={project} />}
      {compose && <ComposeDialog mode={compose} projectId={project._id} onClose={() => setCompose(null)} />}
    </div>
  );
}
