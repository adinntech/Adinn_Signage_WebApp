"use client";

import { useState } from "react";
import { Camera, CheckCircle2, ClipboardList, FileUp, History, Mic, PlayCircle, RotateCcw, Ruler, Send, UserPlus, XCircle, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useTrackingActivity, type ActivityEvent, type TrackingOverview } from "@/lib/api/projectTracking";
import { cn } from "@/lib/utils";
import { fmtWhen, RED } from "./ui";

const SEG = [
  { key: "completed", label: "Completed", color: "#16A34A" },
  { key: "pending", label: "Yet to Complete", color: "#F59E0B" },
  { key: "rejected", label: "Rejected", color: "#DC2626" },
] as const;

/** Donut of completed / yet to complete / rejected shops with counts and percentages. */
export function OverallProgress({ data }: { data: TrackingOverview }) {
  const { counts } = data;
  const total = counts.total || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="pt-progress">
      <h2 id="pt-progress" className="text-base font-semibold" style={{ color: RED }}>Overall Progress</h2>
      <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 128 128" className="size-full -rotate-90" role="img" aria-label={`${counts.percent.completed}% completed`}>
            <circle cx="64" cy="64" r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
            {SEG.map((s) => {
              const v = counts[s.key];
              const len = (v / total) * c;
              const el = v ? <circle key={s.key} cx="64" cy="64" r={r} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} /> : null;
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <span><span className="block text-2xl font-bold text-[#111827]">{counts.percent.completed}%</span><span className="text-xs text-[#6B7280]">Completed</span></span>
          </div>
        </div>
        <ul className="w-full space-y-2.5">
          {SEG.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 text-sm">
              <span className="size-3 rounded-sm" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 text-[#374151]">{s.label}</span>
              <span className="font-semibold tabular-nums text-[#111827]">{counts[s.key]}</span>
              <span className="w-12 text-right tabular-nums text-[#6B7280]">({counts.percent[s.key]}%)</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  SHOP_ALLOCATED: { Icon: UserPlus, color: "#7C3AED" },
  SHOP_VISIT_STARTED: { Icon: PlayCircle, color: "#2563EB" },
  PHOTO_CAPTURED: { Icon: Camera, color: "#0EA5E9" },
  PHOTO_REPLACED: { Icon: Camera, color: "#0EA5E9" },
  MEASUREMENT_UPDATED: { Icon: Ruler, color: "#0D9488" },
  SUBMISSION_CREATED: { Icon: Send, color: "#2563EB" },
  REWORK_SUBMITTED: { Icon: RotateCcw, color: "#F59E0B" },
  REVIEW_APPROVED: { Icon: CheckCircle2, color: "#16A34A" },
  FINAL_APPROVAL: { Icon: CheckCircle2, color: "#16A34A" },
  ITEM_APPROVED: { Icon: CheckCircle2, color: "#16A34A" },
  REVIEW_REJECTED: { Icon: XCircle, color: "#DC2626" },
  REWORK_REQUESTED: { Icon: XCircle, color: "#DC2626" },
  ITEM_REJECTED: { Icon: XCircle, color: "#DC2626" },
  VOICE_NOTE_ADDED: { Icon: Mic, color: "#7C3AED" },
  DOCUMENT_UPLOADED: { Icon: FileUp, color: "#64748B" },
};

export function ActivityRow({ e, onOpen, compact }: { e: ActivityEvent; onOpen?: (e: ActivityEvent) => void; compact?: boolean }) {
  const look = ICON[e.type] ?? { Icon: ClipboardList, color: "#64748B" };
  const shop = e.siteCode ? `#${e.siteCode}` : e.shopName ?? "";
  const body = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: `${look.color}14`, color: look.color }}><look.Icon className="size-4" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-[#1F2937]">
          <span className="font-semibold">{e.label}</span>{shop && <> · Shop {shop}</>}{e.version ? <span className="text-[#6B7280]"> · V{e.version}</span> : null}
        </span>
        {e.reason && !compact && <span className="block truncate text-xs text-[#B91C1C]">Reason: {e.reason}</span>}
        <span className="block text-xs text-[#6B7280]">{e.actor} · {fmtWhen(e.at)}</span>
      </span>
    </>
  );
  return onOpen && e.siteId ? (
    <button type="button" onClick={() => onOpen(e)} className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#F9FAFB]">{body}</button>
  ) : (
    <div className="flex items-start gap-3 px-2 py-2">{body}</div>
  );
}

/** Latest activities of the project; View All opens the paginated timeline. Clicking an entry opens that shop. */
export function LastActivity({ data, onOpen }: { data: TrackingOverview; onOpen: (e: ActivityEvent) => void }) {
  const [all, setAll] = useState(false);
  return (
    <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="pt-activity">
      <div className="flex items-center justify-between">
        <h2 id="pt-activity" className="text-base font-semibold" style={{ color: RED }}>Last Activity</h2>
        <button type="button" onClick={() => setAll(true)} className="text-sm font-semibold underline-offset-2 hover:underline" style={{ color: RED }}>View All</button>
      </div>
      {data.activity.length === 0 ? <EmptyState icon={History} title="No activity yet" className="py-6" /> : (
        <ul className="mt-2 divide-y divide-[#F3F4F6]">
          {data.activity.slice(0, 4).map((e) => <li key={e.id}><ActivityRow e={e} onOpen={onOpen} compact /></li>)}
        </ul>
      )}
      {all && <ActivityDrawer projectId={data.project.id} onClose={() => setAll(false)} onOpen={(e) => { setAll(false); onOpen(e); }} />}
    </section>
  );
}

function ActivityDrawer({ projectId, onClose, onOpen }: { projectId: string; onClose: () => void; onOpen: (e: ActivityEvent) => void }) {
  const [page, setPage] = useState(1);
  const q = useTrackingActivity(projectId, page, true);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} variant="drawer" className="max-w-xl" title="Project Activity" description="Latest first">
      {q.isPending ? <RowsSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.data.length === 0 ? <EmptyState title="No activity yet" /> : (
        <>
          <ul className={cn("divide-y divide-[#F3F4F6]", q.isFetching && "opacity-70")}>{q.data.data.map((e) => <li key={e.id}><ActivityRow e={e} onOpen={onOpen} /></li>)}</ul>
          <div className="mt-3"><Pagination meta={q.data.meta} onPage={setPage} /></div>
        </>
      )}
    </Modal>
  );
}
