"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock3, Hourglass, MessageSquareText, User } from "lucide-react";
import { dayLabel, STAGE_ICON, STATE_META } from "@/components/journey/stage-meta";
import { Button } from "@/components/ui/button";
import type { Journey, JourneyStage, StageKey } from "@/lib/api/journey";
import { formatDate } from "@/lib/format";

/** The one-sentence answer to "where is this project?", written from the stage data only. */
export function plainSummary(j: Journey, current: JourneyStage): string {
  const next = j.stages[current.index + 1];
  if (current.state === "BLOCKED") return `This project is stopped at ${current.label}. ${current.pendingActions[0] ?? ""}`.trim();
  if (current.key === "COMPLETED" && current.state === "COMPLETED") return "Every stage is finished. This project is complete.";
  const age = current.elapsedDays === null ? "" : current.elapsedDays === 0 ? " It started today." : ` It has been here for ${dayLabel(current.elapsedDays)}.`;
  const wait = current.waitingOn.length ? ` Waiting on ${current.waitingOn.join(" and ")} first.` : "";
  const todo = current.pendingActions[0] ? ` Next action: ${current.pendingActions[0]}.` : "";
  const after = next ? ` After this comes ${next.label}.` : "";
  return `The project is at ${current.label}${current.state === "PENDING" ? " (not started yet)" : ""}.${age}${wait}${todo}${after}`;
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = String(value);
      return;
    }
    const c = animate(0, value, { duration: 1.2, ease: "easeOut", onUpdate: (v) => (el.textContent = String(Math.round(v))) });
    return () => c.stop();
  }, [value, reduce]);
  return <span ref={ref}>{value}</span>;
}

/** Progress ring that draws itself, with the percentage counting up in the middle. */
function Ring({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-28 shrink-0 sm:size-32" role="img" aria-label={`${value}% of the journey complete`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563EB" />
            <stop offset="1" stopColor="#7c5cd6" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#dbe5f7" strokeWidth="9" />
        <motion.circle cx="50" cy="50" r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: reduce ? c * (1 - value / 100) : c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.2, ease: "easeOut" }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-primary sm:text-3xl">
          <CountUp value={value} />%
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">complete</span>
      </span>
    </div>
  );
}

const CHIP = "inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium shadow-soft ring-1 ring-border";

/** "You are here": the current stage in plain words, what is next, the latest comment, and a stepped progress bar. */
export function JourneySummary({ journey: j, onOpen }: { journey: Journey; onOpen: (k: StageKey) => void }) {
  const reduce = useReducedMotion();
  const current = j.stages.find((s) => s.key === j.currentStage)!;
  const m = STATE_META[current.state];
  const Icon = STAGE_ICON[current.key];
  const latest = current.comments[0];
  return (
    <motion.section aria-label="Current stage summary" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#eef4ff] via-white to-[#f6f0ff] p-5 shadow-soft">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-4">
          <span className="relative mt-1 flex size-14 shrink-0 items-center justify-center">
            {current.state === "IN_PROGRESS" && <span className="journey-pulse absolute inset-0 rounded-2xl" style={{ background: m.color }} aria-hidden />}
            <motion.span initial={reduce ? false : { scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="relative flex size-14 items-center justify-center rounded-2xl text-white shadow-card" style={{ background: m.color }}>
              <Icon className="size-7" aria-hidden />
            </motion.span>
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              You are here
              <span className="rounded-full px-2.5 py-0.5 text-[11px] normal-case tracking-normal" style={{ background: m.soft, color: m.color }}>
                {m.label}
              </span>
              {current.overdue && <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[11px] normal-case tracking-normal text-danger">Overdue</span>}
            </p>
            <h2 className="text-xl font-bold text-primary sm:text-2xl">{current.label}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground/80">{plainSummary(j, current)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={CHIP}>
                <User className="size-3.5 text-muted-foreground" aria-hidden /> {current.assignee ?? "Not assigned"}
              </span>
              <span className={CHIP}>
                <Clock3 className="size-3.5 text-muted-foreground" aria-hidden /> {dayLabel(current.elapsedDays)} in this stage
              </span>
              {j.project.targetDate && (
                <span className={CHIP}>
                  <Hourglass className="size-3.5 text-muted-foreground" aria-hidden /> Target {formatDate(j.project.targetDate)}
                </span>
              )}
            </div>
          </div>
        </div>
        <Ring value={j.progress} />
      </div>

      {latest && (
        <motion.button type="button" onClick={() => onOpen(current.key)} initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="mt-4 flex w-full items-start gap-2 rounded-xl border border-border bg-white/80 px-3 py-2.5 text-left text-sm hover:bg-white">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-royal" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{latest.text}</span>
            <span className="text-xs text-muted-foreground">
              {latest.author} · {formatDate(latest.at)}
              {current.comments.length > 1 ? ` · ${current.comments.length} comments` : ""}
            </span>
          </span>
          <ArrowRight className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        </motion.button>
      )}

      <ol className="mt-4 grid grid-cols-8 gap-1.5" aria-label="Stage progress">
        {j.stages.map((s, i) => {
          const sm = STATE_META[s.state];
          return (
            <li key={s.key}>
              <button type="button" onClick={() => onOpen(s.key)} title={`${s.label}: ${sm.label}`} className="group block w-full text-left">
                <span className="block h-2 overflow-hidden rounded-full bg-[#dbe5f7]">
                  <motion.span className="block h-full origin-left rounded-full" style={{ background: sm.color }} initial={{ scaleX: reduce ? 1 : 0 }} animate={{ scaleX: s.state === "PENDING" || s.state === "NOT_APPLICABLE" ? 0 : 1 }} transition={{ delay: 0.15 + i * 0.1, duration: 0.45, ease: "easeOut" }} />
                </span>
                <span className="mt-1 hidden truncate text-[11px] text-muted-foreground group-hover:text-foreground lg:block">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="brand-outline" onClick={() => onOpen(current.key)}>
          Open {current.label} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </motion.section>
  );
}
