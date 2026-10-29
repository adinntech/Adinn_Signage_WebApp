"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { dayLabel, STAGE_ICON, STATE_META } from "@/components/journey/stage-meta";
import { Button } from "@/components/ui/button";
import type { JourneyStage } from "@/lib/api/journey";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  stages: JourneyStage[];
  selected: string;
  onSelect: (key: JourneyStage["key"]) => void;
}

/** Milestone Timeline: the stages top to bottom with their dates, revealed as they scroll into view. */
export function MilestoneTimeline({ stages, selected, onSelect }: Props) {
  const reduce = useReducedMotion();
  return (
    <ol className="relative space-y-1 pl-2">
      <span className="absolute bottom-6 left-[1.35rem] top-6 w-0.5 bg-border" aria-hidden />
      {stages.map((s) => {
        const m = STATE_META[s.state];
        const Icon = STAGE_ICON[s.key];
        const active = selected === s.key;
        return (
          <motion.li key={s.key} initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.3 }}>
            <button
              type="button"
              onClick={() => onSelect(s.key)}
              aria-current={active ? "step" : undefined}
              className={cn("relative flex w-full items-start gap-4 rounded-xl p-3 text-left transition-colors hover:bg-muted/60", active && "bg-brand-soft ring-1 ring-brand/20")}
            >
              <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-soft" style={{ background: m.color }}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-primary">{s.label}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.soft, color: m.color }}>
                    {m.label}
                  </span>
                  {s.overdue && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-danger">
                      <AlertTriangle className="size-3" aria-hidden /> Overdue
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {s.startedAt ? `${formatDate(s.startedAt)}${s.completedAt && s.state === "COMPLETED" ? ` → ${formatDate(s.completedAt)}` : " → now"}` : "Not started"}
                  {s.elapsedDays !== null && ` · ${dayLabel(s.elapsedDays)}`}
                  {s.assignee && ` · ${s.assignee}`}
                </span>
                {s.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{s.detail}</span>}
              </span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Stage Navigator: pick a stage from the list or step with Previous / Next (arrow keys work too). */
export function StageNavigator({ stages, selected, onSelect }: Props) {
  const idx = Math.max(0, stages.findIndex((s) => s.key === selected));
  const list = useRef<HTMLDivElement>(null);
  const go = (to: number) => {
    const s = stages[Math.min(stages.length - 1, Math.max(0, to))]!;
    onSelect(s.key);
    list.current?.querySelector<HTMLElement>(`[data-stage="${s.key}"]`)?.focus();
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Stage {idx + 1} of {stages.length}
        </p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => go(idx - 1)} disabled={idx === 0}>
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Button>
          <Button size="sm" variant="outline" onClick={() => go(idx + 1)} disabled={idx === stages.length - 1}>
            Next <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <div
        ref={list}
        role="listbox"
        aria-label="Stages"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            go(idx + 1);
          } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            go(idx - 1);
          }
        }}
        className="space-y-1.5"
      >
        {stages.map((s) => {
          const m = STATE_META[s.state];
          const Icon = STAGE_ICON[s.key];
          const active = s.key === selected;
          return (
            <button
              key={s.key}
              type="button"
              role="option"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-stage={s.key}
              onClick={() => onSelect(s.key)}
              className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors", active ? "border-royal bg-brand-soft" : "border-border hover:bg-muted/60")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: m.color }}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-primary">
                  {s.index + 1}. {s.label}
                </span>
                <span className="block text-xs" style={{ color: m.color }}>
                  {m.label}
                  {s.overdue ? " · Overdue" : ""}
                </span>
              </span>
              {s.pendingActions.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{s.pendingActions.length} pending</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
