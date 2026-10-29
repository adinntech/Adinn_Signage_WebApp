"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, FileUp, Flag, FolderPlus, History, ListChecks, Loader2, Mail, ShieldCheck, StickyNote, UserCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useActivity, ACTIVITY_CATEGORIES, type ActivityCategory } from "@/lib/api/workspace";
import { cn } from "@/lib/utils";

export const CATEGORY_META: Record<ActivityCategory, { label: string; icon: LucideIcon; chip: string }> = {
  PROJECT: { label: "Project", icon: FolderPlus, chip: "bg-[#e8f0ff] text-royal" },
  STAGE: { label: "Stage", icon: Flag, chip: "bg-[#e2f8ea] text-finance" },
  ASSIGNMENT: { label: "Assignment", icon: UserCheck, chip: "bg-[#fff0e0] text-approval" },
  DOCUMENTS: { label: "Documents", icon: FileUp, chip: "bg-[#ffe9ee] text-[#e11d48]" },
  MAIL: { label: "Mail", icon: Mail, chip: "bg-[#e8f0ff] text-royal" },
  CODES: { label: "Codes", icon: BadgeCheck, chip: "bg-[#dcf7f3] text-recce" },
  APPROVAL: { label: "Approvals", icon: ShieldCheck, chip: "bg-[#f1e6ff] text-vendor" },
  SHOPS: { label: "Shops", icon: ListChecks, chip: "bg-[#e2f8ea] text-finance" },
  NOTES: { label: "Notes", icon: StickyNote, chip: "bg-[#fff3dc] text-planning" },
};

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} | ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
};

/** Project activity: the append-only history of business events, filtered by area. Nothing here can be edited. */
export function ActivityFeed({ pid, category, onCategory }: { pid: string; category: ActivityCategory | undefined; onCategory: (c: ActivityCategory | undefined) => void }) {
  const reduce = useReducedMotion();
  const q = useActivity(pid, category);
  const events = q.data?.pages.flatMap((p) => p.events) ?? [];

  return (
    <div>
      <div role="group" aria-label="Filter by area" className="mb-4 flex flex-wrap gap-1.5">
        {[undefined, ...ACTIVITY_CATEGORIES].map((c) => (
          <button key={c ?? "all"} type="button" aria-pressed={category === c} onClick={() => onCategory(c)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", category === c ? "border-royal bg-royal text-white" : "border-border bg-surface text-muted-foreground hover:bg-muted")}>
            {c ? CATEGORY_META[c].label : "All"}
          </button>
        ))}
      </div>

      {q.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState icon={History} title="No activity here yet" description={category ? "Nothing in this area. Try All." : "Events appear as the project moves forward."} />
      ) : (
        <ol className="divide-y divide-border">
          {events.map((e, i) => {
            const m = CATEGORY_META[e.category];
            return (
              <motion.li key={e.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.025 }} className="flex items-center gap-4 py-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", m.chip)}>
                  <m.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-primary">{e.title}</span>
                  <span className="block text-xs text-muted-foreground">{e.by ? `by ${e.by.name}` : "System"}</span>
                </span>
                <time className="shrink-0 text-right text-xs tabular-nums text-muted-foreground" dateTime={e.at}>
                  {when(e.at)}
                </time>
              </motion.li>
            );
          })}
        </ol>
      )}
      {q.hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage && <Loader2 className="size-4 animate-spin" aria-hidden />} Load older activity
          </Button>
        </div>
      )}
    </div>
  );
}
