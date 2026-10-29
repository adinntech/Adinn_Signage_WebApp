"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight, Clock3, Link2, Paperclip, StickyNote, User } from "lucide-react";
import { dayLabel, STAGE_ICON, STATE_META } from "@/components/journey/stage-meta";
import type { JourneyStage } from "@/lib/api/journey";
import { formatDate } from "@/lib/format";

/** Everything known about one stage. Slides in when another stage is selected. */
export function StagePanel({ stage }: { stage: JourneyStage }) {
  const reduce = useReducedMotion();
  const m = STATE_META[stage.state];
  const Icon = STAGE_ICON[stage.key];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stage.key}
        initial={reduce ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduce ? undefined : { opacity: 0, x: -16 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl text-white shadow-soft" style={{ background: m.color }}>
            <Icon className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-primary">{stage.label}</h3>
            <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: m.soft, color: m.color }}>
              {m.label}
            </span>
          </div>
        </div>

        {stage.overdue && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Overdue: {stage.overdueReason}
          </p>
        )}
        {stage.detail && <p className="text-sm text-muted-foreground">{stage.detail}</p>}

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3" aria-hidden /> Assigned to
            </dt>
            <dd className="mt-0.5 font-medium">{stage.assignee ?? "-"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3" aria-hidden /> Elapsed
            </dt>
            <dd className="mt-0.5 font-medium">{dayLabel(stage.elapsedDays)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Started</dt>
            <dd className="mt-0.5 font-medium">{stage.startedAt ? formatDate(stage.startedAt) : "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Completed</dt>
            <dd className="mt-0.5 font-medium">{stage.completedAt && stage.state === "COMPLETED" ? formatDate(stage.completedAt) : "-"}</dd>
          </div>
        </dl>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link2 className="size-3" aria-hidden /> Dependencies
          </h4>
          {stage.dependsOn.length === 0 ? (
            <p className="text-sm text-muted-foreground">None. This is where the journey starts.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {stage.dependsOn.map((d) => (
                <li key={d} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stage.waitingOn.includes(d) ? "bg-[#fff3dc] text-approval" : "bg-[#e2f8ea] text-finance"}`}>
                  {d}
                  {stage.waitingOn.includes(d) ? " (waiting)" : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ArrowRight className="size-3" aria-hidden /> Pending actions
          </h4>
          {stage.pendingActions.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending.</p> : stage.pendingActions.map((a) => (
            <p key={a} className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
              {a}
            </p>
          ))}
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <StickyNote className="size-3" aria-hidden /> Notes
          </h4>
          {stage.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {stage.notes.map((n, i) => (
                <li key={i} className="rounded-lg border border-border px-3 py-2 text-sm">
                  {n.text}
                  <span className="block text-xs text-muted-foreground">{formatDate(n.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {stage.attachments > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="size-4" aria-hidden /> {stage.attachments} attachment{stage.attachments === 1 ? "" : "s"} on file
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
