"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, LockKeyhole, Play, Sparkle, UserRoundCheck } from "lucide-react";
import type { LeadStage, LeadStageState } from "@/lib/api/leads";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HANDOVER_META, STAGE_META, type BranchCard } from "./stage-meta";

export type MapNode = LeadStage | "HANDOVER";

export interface HandoverNodeState {
  unlocked: boolean;
  assignee: { name: string } | null;
  assignedAt: string | null;
  type?: "ASO" | "SHOP_DETAILS" | "SHOP_MEASUREMENT" | null;
}
const TYPE_LABEL = { ASO: "ASO", SHOP_DETAILS: "Shop Details Only", SHOP_MEASUREMENT: "Shop + Measurement" } as const;

const nodeId = (k: MapNode) => `lead-node-${k}`;

/** Small radial burst played on a node the moment its stage is completed. */
function Burst({ color }: { color: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 size-2 rounded-full"
            style={{ background: i % 2 ? color : "#22c55e" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 120, y: Math.sin(a) * 52, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        );
      })}
    </span>
  );
}

/**
 * Vertical connector between two stages. It fills with the stage colour once the upper stage is done; right after a
 * completion the fill "draws" downwards and a glowing dot travels to the next stage.
 */
function Spine({ from, to, filled, travel, skip }: { from: string; to: string; filled: boolean; travel: boolean; skip?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-14 w-1" aria-hidden>
      <span className={cn("absolute inset-0 rounded-full", skip ? "border-l-2 border-dashed border-slate-300 bg-transparent" : "bg-slate-200")} />
      {filled && !skip && (
        <motion.span
          className="absolute inset-0 origin-top rounded-full"
          style={{ background: `linear-gradient(${from}, ${to})` }}
          initial={travel && !reduce ? { scaleY: 0 } : false}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        />
      )}
      {travel && !reduce && (
        <motion.span
          className="absolute left-1/2 size-3.5 -translate-x-1/2 rounded-full"
          style={{ background: to, boxShadow: `0 0 0 4px ${to}33, 0 0 18px ${to}` }}
          initial={{ top: "-6px", opacity: 0 }}
          animate={{ top: ["-6px", "calc(100% - 8px)"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
        />
      )}
      <span className="absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2" style={{ borderColor: filled && !skip ? to : "#cbd5e1" }} />
    </div>
  );
}

/** Work / output branch next to a stage, joined to it by a dashed line. */
function Branch({ card, side, color, state, delay }: { card: BranchCard; side: "left" | "right"; color: string; state: LeadStageState["status"]; delay: number }) {
  const done = state === "DONE";
  const dim = state === "PENDING" || state === "SKIPPED";
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -18 : 18 }}
      animate={{ opacity: dim ? 0.55 : 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn("relative hidden w-full max-w-[260px] xl:block", side === "left" ? "justify-self-end" : "justify-self-start")}
    >
      <span
        aria-hidden
        className={cn("absolute top-1/2 w-10 border-t-2 border-dashed", side === "left" ? "-right-10" : "-left-10")}
        style={{ borderColor: `${color}80` }}
      />
      <span aria-hidden className={cn("absolute top-1/2 size-2 -translate-y-1/2 rounded-full", side === "left" ? "-right-1" : "-left-1")} style={{ background: color }} />
      <div className="rounded-xl border bg-surface/90 p-3 shadow-soft backdrop-blur" style={{ borderColor: `${color}40` }}>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
          <card.icon className="size-3.5" aria-hidden /> {card.title}
        </p>
        <ul className="space-y-1">
          {card.items.map((it) => (
            <li key={it} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {done ? <Check className="size-3 shrink-0 text-success" aria-hidden /> : <span className="size-1.5 shrink-0 rounded-full" style={{ background: `${color}99` }} />}
              {it}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function StageNode({ s, badge, celebrate, closed, onOpen, delay }: { s: LeadStageState; badge?: string; celebrate: boolean; closed: boolean; onOpen: () => void; delay: number }) {
  const m = STAGE_META[s.key];
  const reduce = useReducedMotion();
  const current = s.status === "CURRENT";
  const done = s.status === "DONE";
  const skipped = s.status === "SKIPPED";
  const statusText = skipped
    ? "Skipped · already registered"
    : done
      ? `Done${s.completedAt ? ` · ${formatDate(s.completedAt)}` : ""}`
      : current
        ? closed
          ? "Lead closed here"
          : "In progress"
        : s.available
          ? "Pending"
          : "Next update";
  return (
    <motion.button
      type="button"
      id={nodeId(s.key)}
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={celebrate && !reduce ? { opacity: 1, y: 0, scale: [1, 1.07, 1] } : { opacity: 1, y: 0, scale: 1 }}
      transition={celebrate ? { duration: 0.55 } : { delay, duration: 0.35 }}
      whileHover={reduce ? undefined : { y: -2 }}
      aria-label={`${m.label}: ${statusText}`}
      className={cn(
        "relative w-full max-w-[320px] justify-self-center rounded-2xl border-2 bg-surface px-4 py-3.5 text-left shadow-card transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2",
        skipped && "border-dashed bg-muted/40 shadow-none",
        s.status === "PENDING" && "opacity-75",
      )}
      style={{
        borderColor: skipped ? "#cbd5e1" : current || done ? m.color : `${m.color}40`,
        background: current ? `linear-gradient(135deg, ${m.soft}, #ffffff 70%)` : undefined,
        boxShadow: current && !closed ? `0 0 0 4px ${m.color}1f, 0 10px 28px -10px ${m.color}66` : undefined,
      }}
    >
      {current && !closed && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[18px] border-2"
          style={{ borderColor: m.color }}
          animate={{ opacity: [0.55, 0, 0.55], scale: [1, 1.04, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {celebrate && !reduce && <Burst color={m.color} />}
      <span className="flex items-center gap-3">
        <span
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ background: skipped ? "#94a3b8" : m.color }}
        >
          {done ? (
            <motion.span initial={celebrate && !reduce ? { scale: 0, rotate: -40 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 16 }}>
              <Check className="size-5" strokeWidth={3} aria-hidden />
            </motion.span>
          ) : (
            s.number
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <m.icon className="size-4 shrink-0" style={{ color: skipped ? "#94a3b8" : m.color }} aria-hidden />
            <span className="truncate">{m.label}</span>
          </span>
          <span className={cn("mt-0.5 flex items-center gap-1 text-xs", done ? "text-success" : current ? "font-medium" : "text-muted-foreground")} style={current ? { color: m.color } : undefined}>
            {!s.available && !done && !current && <LockKeyhole className="size-3" aria-hidden />}
            {statusText}
          </span>
        </span>
        {badge && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: m.soft, color: m.color }}>
            {badge}
          </span>
        )}
      </span>
    </motion.button>
  );
}

function HandoverNode({ h, onOpen, travel }: { h: HandoverNodeState; onOpen: () => void; travel: boolean }) {
  const reduce = useReducedMotion();
  const m = HANDOVER_META;
  const assigned = !!h.assignee;
  return (
    <div className="relative grid grid-cols-1 items-center xl:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] xl:gap-x-10">
      <span className="hidden xl:block" />
      <div className="relative mx-auto h-full w-1" aria-hidden>
        <span className="absolute inset-0 rounded-full" style={{ background: h.unlocked ? STAGE_META.RATE_CARD.color : "#e2e8f0" }} />
      </div>
      <div className="relative mt-2 flex xl:mt-0">
        {/* Fork: dashed line from the main chain to the parallel Client Servicing track. */}
        <motion.span
          aria-hidden
          className="absolute -left-[calc(2.5rem+160px)] top-1/2 hidden h-0 w-[calc(2.5rem+160px)] origin-left border-t-2 border-dashed xl:block"
          style={{ borderColor: h.unlocked ? m.color : "#cbd5e1" }}
          initial={travel && !reduce ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        />
        <motion.button
          type="button"
          id={nodeId("HANDOVER")}
          onClick={onOpen}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: h.unlocked ? 1 : 0.6, x: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          whileHover={reduce ? undefined : { y: -2 }}
          className="relative w-full max-w-[300px] rounded-2xl border-2 border-dashed bg-surface px-4 py-3 text-left shadow-soft"
          style={{ borderColor: h.unlocked ? m.color : "#cbd5e1", background: h.unlocked && !assigned ? `linear-gradient(135deg, ${m.soft}, #ffffff 70%)` : undefined }}
          aria-label={`${m.label}: ${assigned ? `assigned to ${h.assignee!.name}` : h.unlocked ? "ready" : "unlocks after Requirement Discussion"}`}
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: h.unlocked ? m.color : "#94a3b8" }}>
              {assigned ? <UserRoundCheck className="size-5" aria-hidden /> : h.unlocked ? <m.icon className="size-5" aria-hidden /> : <LockKeyhole className="size-4.5" aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{m.label}</span>
              <span className="block text-xs" style={{ color: h.unlocked ? m.color : undefined }}>
                {assigned
                  ? `${h.assignee!.name}${h.assignedAt ? ` · ${formatDate(h.assignedAt)}` : ""}`
                  : h.unlocked
                    ? h.type
                      ? `${TYPE_LABEL[h.type]} · runs alongside the rate card`
                      : "Ready · runs alongside the rate card"
                    : "Unlocks after Requirement Discussion"}
              </span>
              {assigned && h.type && (
                <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.soft, color: m.color }}>
                  {TYPE_LABEL[h.type]}
                </span>
              )}
            </span>
          </span>
        </motion.button>
      </div>
    </div>
  );
}

/**
 * Lead Management mind map: the six stages as a chain, each with its work / output branches, and the Client
 * Servicing handover forking off after Requirement Discussion. `celebrate` is the stage that was just completed.
 */
export function LeadMindMap({
  stages,
  handover,
  badges = {},
  closed = false,
  celebrate,
  onOpen,
}: {
  stages: LeadStageState[];
  handover: HandoverNodeState | null;
  badges?: Partial<Record<MapNode, string>>;
  closed?: boolean;
  celebrate?: LeadStage | null;
  onOpen: (k: MapNode) => void;
}) {
  const reduce = useReducedMotion();

  // After a completion, bring the new current stage into view once the connector has drawn to it.
  useEffect(() => {
    if (!celebrate) return;
    const next = stages.find((s) => s.status === "CURRENT");
    if (!next) return;
    const t = setTimeout(() => document.getElementById(nodeId(next.key))?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }), 650);
    return () => clearTimeout(t);
  }, [celebrate, stages, reduce]);

  const celebrateIdx = celebrate ? stages.findIndex((s) => s.key === celebrate) : -1;

  return (
    <div className="relative mx-auto w-full max-w-[1100px] pb-6">
      <div className="mb-3 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-royal px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-soft">
          <Play className="size-3 fill-current" aria-hidden /> Start
        </span>
      </div>
      <Spine from="#2563eb" to="#2563eb" filled travel={false} />
      {stages.map((s, i) => {
        const m = STAGE_META[s.key];
        const next = stages[i + 1];
        // The segment below a done stage is drawn; it "travels" right after this stage was completed (to the next
        // stage of this lead's flow, so a skipped stage is passed through in one go).
        const travel = celebrateIdx >= 0 && (i === celebrateIdx || (stages[celebrateIdx + 1]?.status === "SKIPPED" && i === celebrateIdx + 1));
        return (
          <div key={s.key}>
            <div className="grid grid-cols-1 items-center xl:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] xl:gap-x-10">
              {m.left ? <Branch card={m.left} side="left" color={m.color} state={s.status} delay={0.1 + i * 0.06} /> : <span className="hidden xl:block" />}
              <StageNode s={s} badge={badges[s.key]} celebrate={celebrate === s.key} closed={closed} onOpen={() => onOpen(s.key)} delay={i * 0.06} />
              {m.right ? <Branch card={m.right} side="right" color={m.color} state={s.status} delay={0.14 + i * 0.06} /> : <span className="hidden xl:block" />}
            </div>
            {next && (
              <>
                <Spine
                  from={m.color}
                  to={STAGE_META[next.key].color}
                  filled={s.status === "DONE" || s.status === "SKIPPED"}
                  travel={travel}
                  skip={next.status === "SKIPPED" || s.status === "SKIPPED"}
                />
                {s.key === "REQUIREMENT_DISCUSSION" && handover && (
                  <>
                    <HandoverNode h={handover} onOpen={() => onOpen("HANDOVER")} travel={celebrate === "REQUIREMENT_DISCUSSION"} />
                    <Spine from={m.color} to={STAGE_META[next.key].color} filled={s.status === "DONE"} travel={travel} />
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
      {stages.every((s) => s.status === "DONE" || s.status === "SKIPPED") && (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-success">
          <Sparkle className="size-4" aria-hidden /> All stages completed
        </motion.p>
      )}

      <div className="mx-auto mt-8 flex w-fit flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface/80 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-success" /> Next stage
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed border-royal" /> Back to previous stage
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed border-slate-300" /> Skipped (existing client)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed border-approval" /> Client Servicing handover
        </span>
      </div>
    </div>
  );
}
