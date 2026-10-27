"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FilePlus2, FileSpreadsheet, History, MessageSquareText, PenLine, Plus, Send, Trash2, UserCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useCreateMessage, useMessages } from "@/lib/api/communications";
import { useProjectHistory, type AuditEntry } from "@/lib/api/projects";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const NOTE_MAX = 1000;

const KIND: Record<string, { label: string; icon: LucideIcon; chip: string }> = {
  CREATE: { label: "Project created", icon: Plus, chip: "bg-[#eef0f4] text-muted-foreground" },
  ASSIGN: { label: "Project assigned", icon: UserCheck, chip: "bg-[#f1e6ff] text-vendor" },
  UPDATE: { label: "Project details updated", icon: PenLine, chip: "bg-[#e8f0ff] text-royal" },
  STATUS_CHANGE: { label: "Status changed", icon: Send, chip: "bg-[#fff0e0] text-approval" },
  UPLOAD: { label: "Document uploaded", icon: FilePlus2, chip: "bg-[#e2f8ea] text-finance" },
  DELETE: { label: "Document removed", icon: Trash2, chip: "bg-[#ffe8e8] text-loss" },
  IMPORT_SITES: { label: "Shops imported", icon: FileSpreadsheet, chip: "bg-[#dcf7f3] text-recce" },
  APPROVAL: { label: "Approval updated", icon: CheckCircle2, chip: "bg-[#fff0e0] text-approval" },
};
const kindOf = (a: string) => KIND[a] ?? { label: a.toLowerCase().replace(/_/g, " "), icon: History, chip: "bg-[#eef0f4] text-muted-foreground" };

const detail = (a: AuditEntry) =>
  a.action === "STATUS_CHANGE" ? `${a.changes[0]?.oldValue ?? "-"} → ${a.changes[0]?.newValue ?? "-"}${a.reason ? ` (${a.reason})` : ""}` : (a.reason ?? "");

const initials = (name?: string) => (name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Every change on the project, newest first, with an icon per kind of action and a filter. */
export function ActivityTimeline({ projectId }: { projectId: string }) {
  const history = useProjectHistory(projectId);
  const [filter, setFilter] = useState("");
  const kinds = useMemo(() => [...new Set((history.data ?? []).map((h) => h.action))], [history.data]);
  const rows = (history.data ?? []).filter((h) => !filter || h.action === filter);

  return (
    <div>
      <div className="mb-3 max-w-48">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter activity">
          <option value="">All Activities</option>
          {kinds.map((k) => <option key={k} value={k}>{kindOf(k).label}</option>)}
        </Select>
      </div>
      {history.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ol className="max-h-[420px] divide-y divide-border overflow-y-auto pr-1">
          {rows.map((h) => {
            const k = kindOf(h.action);
            const d = detail(h);
            return (
              <li key={h._id} className="flex items-start gap-3 py-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", k.chip)}><k.icon className="size-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">{k.label}</p>
                  {d && <p className="text-xs text-muted-foreground">{d}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{h.user?.name ?? "System"}</p>
                  <p>{formatDateTime(h.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Internal remarks on the project (stored as project notes in the communication log), newest first. */
export function ProjectNotes({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const toast = useToast();
  const notes = useMessages({ projectId, type: "NOTE", sort: "-sentAt", limit: 20 });
  const create = useCreateMessage();
  const [text, setText] = useState("");
  const body = text.trim();

  function add() {
    if (!body) return;
    create.mutate(
      { type: "NOTE", direction: "INTERNAL", projectId, body },
      { onSuccess: () => { setText(""); toast("Note added"); }, onError: (e) => toast(errorMessage(e), "error") },
    );
  }

  return (
    <div className="space-y-3">
      {canWrite && (
        <div>
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))} rows={3} maxLength={NOTE_MAX} aria-label="New note" placeholder="Add internal remarks, notes or updates…" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{text.length} / {NOTE_MAX}</span>
            <Button size="sm" className="bg-royal hover:bg-royal/90" loading={create.isPending} disabled={!body} onClick={add}>
              <MessageSquareText className="size-4" aria-hidden /> Add Note
            </Button>
          </div>
        </div>
      )}
      {notes.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notes.isError ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : notes.data.data.length === 0 ? (
        <EmptyState title="No notes yet" />
      ) : (
        <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {notes.data.data.map((n) => (
            <li key={n._id} className="flex gap-3 rounded-lg border border-border p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0ff] text-xs font-bold text-royal">{initials(n.createdBy?.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-semibold text-navy">{n.createdBy?.name ?? "Unknown"}</span> <span className="text-xs text-muted-foreground">{formatDateTime(n.sentAt)}</span></p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
