"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Flag, LockKeyhole, Play, UserRoundCheck } from "lucide-react";
import type { LeadStage, LeadStageState } from "@/lib/api/leads";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ASSIGN_META, STAGE_META, type BranchCard } from "./stage-meta";

/** A clickable node: a stage, or one of the two Project Assign branches (HANDOVER = Client Servicing, RECCE = Recce team). */
export type MapNode = LeadStage | "HANDOVER" | "RECCE";
type Branch = "HANDOVER" | "RECCE";

/** Project Assign branches: who the project went to (either one completes the lead). */
export interface AssignState {
  /** The lead is open at Project Assign, so a branch can be worked on. */
  unlocked: boolean;
  completed: boolean;
  completedAt?: string | null;
  cs: { assignee: { name: string } | null; assignedAt: string | null; type?: "ASO" | "SHOP_DETAILS" | "SHOP_MEASUREMENT" | null };
  recce: { available: boolean; assignee: { name: string } | null; assignedAt: string | null };
}
const TYPE_LABEL = { ASO: "ASO", SHOP_DETAILS: "Shop Details Only", SHOP_MEASUREMENT: "Shop + Measurement" } as const;
const GREY = "#cbd5e1";
const SUCCESS = "#16a34a";

const nodeId = (k: MapNode | "END") => `lead-node-${k}`;

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
function Spine({ from, to, filled, travel }: { from: string; to: string; filled: boolean; travel: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-14 w-1" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-slate-200" />
      {filled && (
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
      <span className="absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2" style={{ borderColor: filled ? to : GREY }} />
    </div>
  );
}

/** Work / output branch next to a stage, joined to it by a dashed line. */
function SideCard({ card, side, color, state, delay }: { card: BranchCard; side: "left" | "right"; color: string; state: LeadStageState["status"]; delay: number }) {
  const done = state === "DONE";
  const dim = state === "PENDING" || state === "SKIPPED";
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -18 : 18 }}
      animate={{ opacity: dim ? 0.55 : 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn("relative hidden w-full max-w-[260px] xl:block", side === "left" ? "justify-self-end" : "justify-self-start")}
    >
      <span aria-hidden className={cn("absolute top-1/2 w-10 border-t-2 border-dashed", side === "left" ? "-right-10" : "-left-10")} style={{ borderColor: `${color}80` }} />
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
  const statusText = done ? `Done${s.completedAt ? ` · ${formatDate(s.completedAt)}` : ""}` : current ? (closed ? "Lead closed here" : "In progress") : s.available ? "Pending" : "Next update";
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
        s.status === "PENDING" && "opacity-75",
      )}
      style={{
        borderColor: current || done ? m.color : `${m.color}40`,
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
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white" style={{ background: m.color }}>
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
            <m.icon className="size-4 shrink-0" style={{ color: m.color }} aria-hidden />
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

/* ------------------------------ Project Assign fork ------------------------------ */

// Column centres of the two-column branch grid (gap-8 = 2rem, so each centre sits gap/4 off the quarter line).
const LEFT_X = "calc(25% - 0.5rem)";
const RIGHT_X = "calc(75% + 0.5rem)";

/** One line segment: solid in the branch colour when active, dashed grey otherwise. Scales in from `origin` when `draw`. */
function Segment({ style, vertical, color, active, origin, draw, delay }: { style: React.CSSProperties; vertical: boolean; color: string; active: boolean; origin: string; draw: boolean; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className={cn("absolute", vertical ? "w-0 border-l-[3px]" : "h-0 border-t-[3px]", !active && "border-dashed")}
      style={{ ...style, borderColor: active ? color : GREY, transformOrigin: origin }}
      initial={draw && !reduce ? (vertical ? { scaleY: 0 } : { scaleX: 0 }) : false}
      animate={vertical ? { scaleY: 1 } : { scaleX: 1 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
    />
  );
}

/** Glowing dot running from the centre to a branch column (split) or from a branch column to the centre (merge). */
function Runner({ to, color, merge, delay }: { to: string; color: string; merge?: boolean; delay: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const left = merge ? [to, to, "50%"] : ["50%", to, to];
  const top = merge ? ["0%", "50%", "50%"] : ["50%", "50%", "100%"];
  return (
    <motion.span
      aria-hidden
      className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ background: color, boxShadow: `0 0 0 4px ${color}33, 0 0 16px ${color}` }}
      initial={{ left: left[0], top: top[0], opacity: 0 }}
      animate={{ left, top, opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1, delay, ease: "easeInOut", times: [0, 0.55, 1] }}
    />
  );
}

/**
 * The connector between Project Assign and its two branches (split), or between the branches and Lead Completed
 * (merge). Hidden on narrow screens, where the branches simply stack.
 */
function Fork({ merge, colors, active, draw }: { merge?: boolean; colors: [string, string]; active: [boolean, boolean]; draw: boolean }) {
  const [lc, rc] = colors;
  const centreColor = active[0] ? lc : active[1] ? rc : GREY;
  const stub: React.CSSProperties = merge ? { left: "50%", top: "50%", height: "50%" } : { left: "50%", top: 0, height: "50%" };
  const drop = (x: string): React.CSSProperties => (merge ? { left: x, top: 0, height: "50%" } : { left: x, top: "50%", height: "50%" });
  // Each half of the bar grows from the centre (split) or towards it (merge).
  const leftBar: React.CSSProperties = { top: "50%", left: LEFT_X, width: `calc(50% - (${LEFT_X}))` };
  const rightBar: React.CSSProperties = { top: "50%", left: "50%", width: `calc((${RIGHT_X}) - 50%)` };
  const d = merge ? 0.15 : 0;
  return (
    <div className="relative hidden h-12 sm:block">
      <Segment style={stub} vertical color={centreColor} active={active[0] || active[1]} origin={merge ? "top" : "top"} draw={draw} delay={merge ? d + 0.5 : d} />
      <Segment style={leftBar} vertical={false} color={lc} active={active[0]} origin={merge ? "left" : "right"} draw={draw} delay={d + 0.25} />
      <Segment style={rightBar} vertical={false} color={rc} active={active[1]} origin={merge ? "right" : "left"} draw={draw} delay={d + 0.25} />
      <Segment style={drop(LEFT_X)} vertical color={lc} active={active[0]} origin="top" draw={draw} delay={merge ? d : d + 0.5} />
      <Segment style={drop(RIGHT_X)} vertical color={rc} active={active[1]} origin="top" draw={draw} delay={merge ? d : d + 0.5} />
      {draw && !merge && (
        <>
          <Runner to={LEFT_X} color={lc} delay={0.2} />
          <Runner to={RIGHT_X} color={rc} delay={0.2} />
        </>
      )}
      {draw && merge && active[0] && <Runner to={LEFT_X} color={SUCCESS} merge delay={0.1} />}
      {draw && merge && active[1] && <Runner to={RIGHT_X} color={SUCCESS} merge delay={0.1} />}
    </div>
  );
}

function AssignNode({ k, a, chosen, onOpen, delay, celebrate }: { k: Branch; a: AssignState; chosen: Branch | null; onOpen: () => void; delay: number; celebrate: boolean }) {
  const m = ASSIGN_META[k];
  const reduce = useReducedMotion();
  const mine = k === "HANDOVER" ? a.cs : a.recce;
  const assigned = chosen === k;
  const other = chosen && chosen !== k ? ASSIGN_META[chosen].short : null;
  const unavailable = k === "RECCE" && !a.recce.available && !assigned;
  const locked = !assigned && (!a.unlocked || unavailable || !!other);
  const ready = !assigned && !locked;
  const type = k === "HANDOVER" ? a.cs.type : null;
  const status = assigned
    ? `${mine.assignee!.name}${mine.assignedAt ? ` · ${formatDate(mine.assignedAt)}` : ""}`
    : other
      ? `Not needed · assigned to ${other}`
      : unavailable
        ? "Opens in the next update"
        : !a.unlocked
          ? a.completed
            ? "Not used"
            : "Opens at Project Assign"
          : type
            ? `${TYPE_LABEL[type]} · in progress`
            : "Ready to assign";
  return (
    <motion.button
      type="button"
      id={nodeId(k)}
      onClick={onOpen}
      initial={{ opacity: 0, y: 16 }}
      animate={celebrate && assigned && !reduce ? { opacity: 1, y: 0, scale: [1, 1.06, 1] } : { opacity: locked ? 0.62 : 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={reduce ? undefined : { y: -3 }}
      aria-label={`${m.label}: ${status}`}
      className={cn(
        "relative w-full max-w-[340px] justify-self-center rounded-2xl border-2 bg-surface px-4 py-3.5 text-left shadow-card transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2",
        !assigned && "border-dashed",
      )}
      style={{
        borderColor: assigned ? m.color : ready ? m.color : GREY,
        background: ready ? `linear-gradient(135deg, ${m.soft}, #ffffff 75%)` : assigned ? `linear-gradient(135deg, ${m.soft}, #ffffff 60%)` : undefined,
        boxShadow: ready ? `0 10px 26px -14px ${m.color}` : undefined,
      }}
    >
      {ready && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[18px] border-2 border-dashed"
          style={{ borderColor: m.color }}
          animate={{ opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {celebrate && assigned && !reduce && <Burst color={m.color} />}
      <span className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: locked ? "#94a3b8" : m.color }}>
          {assigned ? <UserRoundCheck className="size-5" aria-hidden /> : locked ? <LockKeyhole className="size-4.5" aria-hidden /> : <m.icon className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{m.label}</span>
          <span className={cn("mt-0.5 block text-xs", assigned ? "font-medium" : !ready && "text-muted-foreground")} style={ready || assigned ? { color: m.color } : undefined}>
            {status}
          </span>
          {assigned && type && (
            <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.soft, color: m.color }}>
              {TYPE_LABEL[type]}
            </span>
          )}
          {!assigned && !other && (
            <ul className="mt-2 hidden space-y-0.5 sm:block">
              {m.items.map((it) => (
                <li key={it} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: locked ? GREY : `${m.color}99` }} />
                  {it}
                </li>
              ))}
            </ul>
          )}
        </span>
      </span>
    </motion.button>
  );
}

function EndNode({ a, celebrate }: { a: AssignState; celebrate: boolean }) {
  const reduce = useReducedMotion();
  const done = a.completed;
  return (
    <div className="flex justify-center">
      <motion.div
        id={nodeId("END")}
        initial={{ opacity: 0, y: 10 }}
        animate={celebrate && done && !reduce ? { opacity: 1, y: 0, scale: [1, 1.1, 1] } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: celebrate ? 0.9 : 0.3 }}
        className={cn("relative inline-flex items-center gap-2.5 rounded-full border-2 px-4 py-2 text-sm font-semibold", done ? "border-success bg-success text-white shadow-card" : "border-dashed border-slate-300 bg-surface text-muted-foreground")}
      >
        {celebrate && done && !reduce && <Burst color={SUCCESS} />}
        <Flag className="size-4" aria-hidden />
        {done ? `Lead Completed${a.completedAt ? ` · ${formatDate(a.completedAt)}` : ""}` : "Lead Completed"}
      </motion.div>
    </div>
  );
}

/**
 * Lead Management mind map: New Lead -> Project Assign, then Project Assign forks into Assign to Client Servicing and
 * Assign to Recce Team; either branch leads to Lead Completed. `celebrate` is the stage that was just completed
 * (NEW_LEAD draws the fork, PROJECT_ASSIGN runs the chosen branch into Lead Completed).
 */
export function LeadMindMap({
  stages,
  assign,
  badges = {},
  closed = false,
  celebrate,
  onOpen,
}: {
  stages: LeadStageState[];
  assign: AssignState | null;
  badges?: Partial<Record<MapNode, string>>;
  closed?: boolean;
  celebrate?: LeadStage | null;
  onOpen: (k: MapNode) => void;
}) {
  const reduce = useReducedMotion();

  // After a completion, bring the next node into view once the connector has drawn to it.
  useEffect(() => {
    if (!celebrate) return;
    const target = celebrate === "PROJECT_ASSIGN" ? "END" : celebrate === "NEW_LEAD" ? "PROJECT_ASSIGN" : stages.find((s) => s.status === "CURRENT")?.key;
    if (!target) return;
    const t = setTimeout(() => document.getElementById(nodeId(target))?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }), 650);
    return () => clearTimeout(t);
  }, [celebrate, stages, reduce]);

  const celebrateIdx = celebrate ? stages.findIndex((s) => s.key === celebrate) : -1;
  const chosen: Branch | null = assign?.cs.assignee ? "HANDOVER" : assign?.recce.assignee ? "RECCE" : null;
  const branchColors: [string, string] = [ASSIGN_META.HANDOVER.color, ASSIGN_META.RECCE.color];
  const open = !!assign?.unlocked;

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
        return (
          <div key={s.key}>
            <div className="grid grid-cols-1 items-center xl:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] xl:gap-x-10">
              {m.left ? <SideCard card={m.left} side="left" color={m.color} state={s.status} delay={0.1 + i * 0.06} /> : <span className="hidden xl:block" />}
              <StageNode s={s} badge={badges[s.key]} celebrate={celebrate === s.key} closed={closed} onOpen={() => onOpen(s.key)} delay={i * 0.06} />
              {m.right ? <SideCard card={m.right} side="right" color={m.color} state={s.status} delay={0.14 + i * 0.06} /> : <span className="hidden xl:block" />}
            </div>
            {next && <Spine from={m.color} to={STAGE_META[next.key].color} filled={s.status === "DONE"} travel={i === celebrateIdx} />}
          </div>
        );
      })}

      {assign && (
        <>
          <Fork colors={branchColors} active={chosen ? [chosen === "HANDOVER", chosen === "RECCE"] : [open, open && assign.recce.available]} draw={celebrate === "NEW_LEAD"} />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-0 sm:grid-cols-2 sm:gap-8">
            <AssignNode k="HANDOVER" a={assign} chosen={chosen} onOpen={() => onOpen("HANDOVER")} delay={0.35} celebrate={celebrate === "PROJECT_ASSIGN"} />
            <AssignNode k="RECCE" a={assign} chosen={chosen} onOpen={() => onOpen("RECCE")} delay={0.45} celebrate={celebrate === "PROJECT_ASSIGN"} />
          </div>
          <div className="mt-4 sm:mt-0">
            <Fork merge colors={[SUCCESS, SUCCESS]} active={[assign.completed && chosen === "HANDOVER", assign.completed && chosen === "RECCE"]} draw={celebrate === "PROJECT_ASSIGN"} />
          </div>
          <EndNode a={assign} celebrate={celebrate === "PROJECT_ASSIGN"} />
        </>
      )}

      <div className="mx-auto mt-8 flex w-fit flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface/80 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-success" /> Done
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed" style={{ borderColor: ASSIGN_META.HANDOVER.color }} /> Client Servicing branch
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed" style={{ borderColor: ASSIGN_META.RECCE.color }} /> Recce Team branch
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed border-slate-300" /> Not open / not needed
        </span>
      </div>
    </div>
  );
}
