"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock3, Flag, History, LockKeyhole, Play, UserRoundCheck } from "lucide-react";
import type { ClientType } from "@/lib/api/clients";
import type { LeadStage, LeadStageState } from "@/lib/api/leads";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { branchSteps, canOpen, routeOfAssign, TYPE_LABEL, type AssignState, type Branch, type ChainStep, type HandoverType, type StepState } from "./assign-steps";
import { ASSIGN_META, CLIENT_META, STAGE_META, type BranchCard } from "./stage-meta";

export type { AssignState } from "./assign-steps";

/** A clickable node: a stage, or one of the two Project Assign branches (HANDOVER = Client Servicing, RECCE = Recce team). */
export type MapNode = LeadStage | "HANDOVER" | "RECCE";
const GREY = "#cbd5e1";
const SUCCESS = "#16a34a";

const nodeId = (k: MapNode | "END") => `lead-node-${k}`;

/** Node surface: 1px hairline border and a soft layered shadow; the state shows in the ring, icon and chip, not the border. */
const SURFACE =
  "border bg-surface shadow-[0_1px_2px_rgb(15_23_42/0.04),0_10px_28px_-18px_rgb(15_23_42/0.22)] transition-[box-shadow,opacity] duration-300 hover:shadow-[0_2px_6px_rgb(15_23_42/0.06),0_24px_40px_-22px_rgb(15_23_42/0.32)]";
const HAIRLINE = "rgb(226 232 240 / 0.6)";
/** Perspective for the hover tilt (3D-style depth with plain transforms). */
const DEPTH = { transformPerspective: 900 } as const;
/** Hover: lift with a slight tilt; none when reduced motion is asked for or the node cannot be opened. */
const lift = (reduce: boolean | null, on = true) => (reduce || !on ? undefined : { y: -3, rotateX: 4, rotateY: -3, transition: { type: "spring" as const, stiffness: 320, damping: 22 } });
/** Active node: soft tinted ring and coloured depth shadow. */
const activeRing = (c: string) => `0 0 0 3px ${c}1f, 0 16px 34px -20px ${c}`;
/** Border by state: tinted when done / active, hairline otherwise. */
const edge = (c: string, s: "done" | "active" | "idle") => (s === "active" ? `${c}66` : s === "done" ? `${c}40` : HAIRLINE);

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
function Spine({ from, to, filled, travel, flow = false }: { from: string; to: string; filled: boolean; travel: boolean; flow?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-14 w-0.5" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-slate-200/80" />
      {filled && (
        <motion.span
          className="absolute inset-0 origin-top rounded-full"
          style={{ background: `linear-gradient(${from}, ${to})` }}
          initial={travel && !reduce ? { scaleY: 0 } : false}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        />
      )}
      {/* Into the active stage: a soft flow shows the direction. */}
      {filled && flow && <span className="lm-flow absolute inset-0 rounded-full text-white/70" />}
      {travel && !reduce && (
        <motion.span
          className="absolute left-1/2 size-3.5 -translate-x-1/2 rounded-full"
          style={{ background: to, boxShadow: `0 0 0 4px ${to}33, 0 0 18px ${to}` }}
          initial={{ top: "-6px", opacity: 0 }}
          animate={{ top: ["-6px", "calc(100% - 8px)"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
        />
      )}
      <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 rounded-[1px] border-b-[1.5px] border-r-[1.5px]" style={{ borderColor: filled ? to : GREY }} />
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
      <span aria-hidden className={cn("absolute top-1/2 w-10 border-t border-dashed", side === "left" ? "-right-10" : "-left-10")} style={{ borderColor: `${color}66` }} />
      <span aria-hidden className={cn("absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full", side === "left" ? "-right-0.5" : "-left-0.5")} style={{ background: color }} />
      <div className={cn("rounded-xl p-3", SURFACE)} style={{ borderColor: HAIRLINE }}>
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

/** "Last updated" line of a completed card: the time that step itself was saved (IST), the same on every card. */
function Stamp({ at, label = "Last updated", className }: { at?: string | null; label?: string; className?: string }) {
  if (!at) return null;
  return (
    <span className={cn("mt-0.5 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground", className)}>
      <Clock3 className="size-3 shrink-0" aria-hidden /> {label} {formatDateTimeIST(at)}
    </span>
  );
}

function StageNode({ s, badge, celebrate, closed, onOpen, delay, client }: { s: LeadStageState; badge?: string; celebrate: boolean; closed: boolean; onOpen: () => void; delay: number; client?: ClientChoice }) {
  const m = STAGE_META[s.key];
  const reduce = useReducedMotion();
  const current = s.status === "CURRENT";
  const done = s.status === "DONE";
  const statusText = done ? "Completed" : current ? (closed ? "Lead closed here" : "In progress") : s.available ? "Pending" : "Next update";
  // Create Project: the client chosen (type + company); its time is the last client save (creation or Change Client).
  const picked = done && client?.done && client.flag ? `${CLIENT_META[client.flag].label} · ${client.name ?? ""}` : null;
  const at = done ? (client?.done ? (client.at ?? s.completedAt) : s.completedAt) : null;
  return (
    <motion.button
      type="button"
      id={nodeId(s.key)}
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={celebrate && !reduce ? { opacity: 1, y: 0, scale: [1, 1.07, 1] } : { opacity: 1, y: 0, scale: 1 }}
      transition={celebrate ? { duration: 0.55 } : { delay, duration: 0.35 }}
      whileHover={lift(reduce)}
      aria-label={`${m.label}: ${statusText}${picked ? `, ${picked}` : ""}${at ? `, last updated ${formatDateTimeIST(at)}` : ""}`}
      className={cn(
        "relative w-full max-w-[320px] justify-self-center rounded-2xl px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2",
        SURFACE,
        s.status === "PENDING" && "border-dashed opacity-75",
      )}
      style={{
        ...DEPTH,
        borderColor: edge(m.color, current ? "active" : done ? "done" : "idle"),
        background: current ? `${m.color}0a` : undefined,
        boxShadow: current && !closed ? activeRing(m.color) : undefined,
      }}
    >
      {current && !closed && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[18px] border"
          style={{ borderColor: m.color }}
          animate={{ opacity: [0.45, 0, 0.45] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {celebrate && !reduce && <Burst color={m.color} />}
      <span className="flex items-center gap-3">
        <span
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]"
          style={{ background: done || current ? m.color : "#cbd5e1" }}
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
            <m.icon className="size-4 shrink-0" style={{ color: m.color }} aria-hidden />
            <span className="truncate">{m.label}</span>
          </span>
          <span className={cn("mt-0.5 flex items-center gap-1 text-xs", done ? "text-success" : current ? "font-medium" : "text-muted-foreground")} style={current ? { color: m.color } : undefined}>
            {!s.available && !done && !current && <LockKeyhole className="size-3" aria-hidden />}
            {statusText}
          </span>
          {picked && <span className="mt-0.5 block truncate text-[11px] font-medium text-foreground">{picked}</span>}
          <Stamp at={at} />
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
      className={cn("absolute", vertical ? "w-0 border-l-2" : "h-0 border-t-2", !active && "border-dashed")}
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

/** Branch title node: who the branch went to, or its state. Not clickable: its steps open the drawer sections. */
function AssignNode({ k, a, delay, celebrate }: { k: Branch; a: AssignState; delay: number; celebrate: boolean }) {
  const m = ASSIGN_META[k];
  const reduce = useReducedMotion();
  const mine = k === "HANDOVER" ? a.cs : a.recce;
  const route = routeOfAssign(a);
  const assigned = !!mine.assignee;
  const other = route && route !== k ? ASSIGN_META[route].short : null;
  const locked = !assigned && (!a.unlocked || !!other);
  const active = !assigned && !locked;
  const status = assigned
    ? `Completed · ${mine.assignee!.name}`
    : other
      ? a.completed
        ? `Not used · assigned to ${other}`
        : `Disabled · ${other} route in progress`
      : !a.unlocked
        ? a.completed
          ? "Not used"
          : "Opens at Project Assign"
        : route === k
          ? "In progress: follow the steps below"
          : k === "HANDOVER"
            ? "Starts when you assign the Client Servicing person"
            : "Starts when you send the project code email";
  return (
    <motion.div
      id={nodeId(k)}
      role="group"
      initial={{ opacity: 0, y: 16 }}
      animate={celebrate && assigned && !reduce ? { opacity: 1, y: 0, scale: [1, 1.06, 1] } : { opacity: locked ? 0.62 : 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      aria-label={`${m.label}: ${status}`}
      className={cn("relative mx-auto w-full max-w-[340px] rounded-2xl px-4 py-3.5", SURFACE, locked && "border-dashed")}
      style={{
        borderColor: edge(m.color, active ? "active" : assigned ? "done" : "idle"),
        background: active || assigned ? `${m.color}0a` : undefined,
      }}
    >
      {celebrate && assigned && !reduce && <Burst color={m.color} />}
      <span className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: locked ? "#94a3b8" : m.color }}>
          {assigned ? <UserRoundCheck className="size-5" aria-hidden /> : locked ? <LockKeyhole className="size-4.5" aria-hidden /> : <m.icon className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{m.label}</span>
          <span className={cn("mt-0.5 block text-xs", assigned ? "font-medium" : !active && "text-muted-foreground")} style={active || assigned ? { color: m.color } : undefined}>
            {status}
          </span>
          {assigned && <Stamp at={mine.assignedAt} />}
          {!other && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: locked ? GREY : `${m.color}66`, color: locked ? "#64748b" : m.color }}>
              {/* Client Servicing has the ON / OFF toggle; the Recce team always gets the full handover. */}
              {k === "HANDOVER" ? (a.cs.full === false ? "Toggle OFF · client details only" : "Toggle ON · full handover") : "Full handover · no toggle"}
            </span>
          )}
        </span>
      </span>
    </motion.div>
  );
}

/* ------------------------------ Branch step chains ------------------------------ */

const TYPE_SHORT: Record<HandoverType, string> = { ASO: "ASO", SHOP_DETAILS: "Shop Details", SHOP_MEASUREMENT: "Shop + Measure" };
const STATE_CHIP: Record<StepState, string> = { DONE: "Done", CURRENT: "Now", NEXT: "Next", LOCKED: "Locked", DISABLED: "Disabled" };

/** Connector between two steps of a branch: solid in the branch colour once the step above is done. */
function StepLink({ color, filled, flow }: { color: string; filled: boolean; flow: boolean }) {
  if (filled && flow)
    // Into the active step: soft flowing dashes show the direction.
    return <span aria-hidden className="lm-flow mx-auto block h-5 w-0.5 rounded-full" style={{ color }} />;
  return <span aria-hidden className={cn("mx-auto block h-5 w-0 border-l-2", !filled && "border-dashed")} style={{ borderColor: filled ? color : GREY }} />;
}

/** The three handover types under the Handover Type step, the chosen one highlighted. */
function TypeBranches({ chosen, color }: { chosen: HandoverType | null; color: string }) {
  return (
    <span className="relative mt-2 block pt-2.5" aria-label={`Handover type: ${chosen ? TYPE_LABEL[chosen] : "not chosen yet"}`}>
      <span aria-hidden className="absolute left-[16.66%] right-[16.66%] top-0 h-2.5 rounded-t-md border-x-2 border-t-2" style={{ borderColor: `${color}55` }} />
      <span aria-hidden className="absolute left-1/2 top-0 h-2.5 border-l-2" style={{ borderColor: `${color}55` }} />
      <span className="grid grid-cols-3 gap-1">
        {(["ASO", "SHOP_DETAILS", "SHOP_MEASUREMENT"] as const).map((t) => {
          const on = chosen === t;
          return (
            <span
              key={t}
              className={cn("truncate rounded-md border px-1 py-0.5 text-center text-[10px] font-semibold leading-tight", !on && "text-muted-foreground")}
              style={on ? { background: color, borderColor: color, color: "#fff" } : { borderColor: GREY }}
              title={TYPE_LABEL[t]}
            >
              {TYPE_SHORT[t]}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** One step: Done / Now open their drawer section; Next / Locked / Disabled say what comes first. */
function StepNode({ s, n, color: branch, onOpen, onBlocked, delay }: { s: ChainStep; n: number; color: string; onOpen: () => void; onBlocked: (why: string) => void; delay: number }) {
  const reduce = useReducedMotion();
  const color = s.color ?? branch;
  const done = s.state === "DONE";
  const now = s.state === "CURRENT";
  const next = s.state === "NEXT";
  const grey = s.state === "LOCKED" || s.state === "DISABLED";
  const open = canOpen(s);
  const tone = grey ? "#94a3b8" : color;
  return (
    <motion.button
      type="button"
      onClick={() => (open ? onOpen() : onBlocked(s.blocked ?? "This step is not open yet"))}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: grey ? 0.6 : 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={lift(reduce, open)}
      aria-disabled={!open}
      title={open ? undefined : (s.blocked ?? undefined)}
      aria-label={`${s.label}: ${STATE_CHIP[s.state]}${s.info ? `, ${s.info}` : ""}${!open && s.blocked ? `. ${s.blocked}` : ""}`}
      className={cn(
        "relative mx-auto block w-full max-w-[340px] rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2",
        SURFACE,
        grey && "border-dashed shadow-none hover:shadow-none",
        !open && "cursor-not-allowed",
      )}
      style={{
        ...DEPTH,
        borderColor: edge(color, now ? "active" : done ? "done" : "idle"),
        background: now ? `${color}0a` : grey ? "rgb(248 250 252)" : undefined,
        boxShadow: now ? activeRing(color) : undefined,
      }}
    >
      {now && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[14px] border"
          style={{ borderColor: color }}
          animate={{ opacity: [0.45, 0, 0.45] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <span className="flex items-start gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]"
          style={{ background: done || now ? color : next ? `${color}80` : "#cbd5e1" }}
        >
          {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : now ? n : <LockKeyhole className="size-3.5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <s.icon className="size-3.5 shrink-0" style={{ color: tone }} aria-hidden />
            <span className="truncate text-[13px] font-semibold text-foreground">{s.label}</span>
            <span
              className={cn("ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide", done && "bg-success-soft text-success", grey && "bg-muted text-muted-foreground")}
              style={now ? { background: color, color: "#fff" } : next ? { background: `${color}1f`, color } : undefined}
            >
              {STATE_CHIP[s.state]}
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{s.desc}</span>
          {s.info && (
            <span className="mt-1 block truncate text-[11px] font-medium" style={{ color: done ? SUCCESS : now ? color : "#64748b" }}>
              {s.info}
            </span>
          )}
          <Stamp at={s.at} label={done ? "Last updated" : (s.atLabel ?? "Updated")} />
          {s.types !== undefined && <TypeBranches chosen={s.types} color={tone} />}
        </span>
      </span>
    </motion.button>
  );
}

/** Email History, hanging off the request email step; opens once an email is recorded. */
function HistoryNode({ h, color, onOpen, onBlocked }: { h: NonNullable<ChainStep["history"]>; color: string; onOpen: () => void; onBlocked: (why: string) => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center">
      <span />
      <span aria-hidden className="block h-12 w-0 border-l-2 border-dashed" style={{ borderColor: GREY }} />
      <span className="flex items-center">
        <span aria-hidden className="block w-4 shrink-0 border-t border-dashed sm:w-6" style={{ borderColor: h.enabled ? color : GREY }} />
        <button
          type="button"
          onClick={() => (h.enabled ? onOpen() : onBlocked("Email History opens after the first project code request email"))}
          aria-disabled={!h.enabled}
          aria-label={`Email History: ${h.info}`}
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2",
            SURFACE,
            !h.enabled && "cursor-not-allowed border-dashed opacity-60 shadow-none hover:shadow-none",
          )}
          style={{ borderColor: h.enabled ? `${color}55` : HAIRLINE }}
        >
          {h.enabled ? <History className="size-3.5 shrink-0" style={{ color }} aria-hidden /> : <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="min-w-0">
            <span className="block font-semibold text-foreground">Email History</span>
            <span className="block truncate text-muted-foreground">{h.info}</span>
          </span>
        </button>
      </span>
    </div>
  );
}

/** One Project Assign branch: its title node, then its step chain (collapsed while the lead is on the other route). */
function BranchColumn({
  k,
  a,
  onOpen,
  onBlocked,
  delay,
  celebrate,
}: {
  k: Branch;
  a: AssignState;
  onOpen: (step: string) => void;
  onBlocked: (why: string) => void;
  delay: number;
  celebrate: boolean;
}) {
  const color = ASSIGN_META[k].color;
  const route = routeOfAssign(a);
  const collapsed = !!route && route !== k;
  const assigned = k === "HANDOVER" ? !!a.cs.assignee : !!a.recce.assignee;
  const steps = branchSteps(a, k);
  return (
    <div className="flex min-w-0 flex-col">
      <AssignNode k={k} a={a} delay={delay} celebrate={celebrate} />
      {!collapsed && (
        <ol className="flex flex-col">
          {steps.map((s, i) => {
            const prevDone = i === 0 ? a.unlocked || assigned : steps[i - 1]!.state === "DONE";
            return (
              <li key={s.step}>
                <StepLink color={s.color ?? color} filled={prevDone} flow={s.state === "CURRENT"} />
                <StepNode s={s} n={i + 1} color={color} onOpen={() => onOpen(s.step)} onBlocked={onBlocked} delay={delay + 0.05 * (i + 1)} />
                {s.history && <HistoryNode h={s.history} color={s.color ?? color} onOpen={() => onOpen("history")} onBlocked={onBlocked} />}
              </li>
            );
          })}
        </ol>
      )}
      {/* Runs on to the merge line, whatever the other column's height. */}
      <span aria-hidden className={cn("mx-auto hidden min-h-5 w-0 flex-1 border-l-2 sm:block", !assigned && "border-dashed")} style={{ borderColor: assigned && a.completed ? SUCCESS : GREY }} />
    </div>
  );
}


/* ------------------------------ Client Selection fork ------------------------------ */

/** Create Project -> New Client / Existing Client. `flag` is the chosen one; `done` once the order exists. */
export interface ClientChoice {
  flag: ClientType | null;
  done: boolean;
  name?: string | null;
  /** When the client was last saved on the lead (order created, or Change Client). */
  at?: string | null;
}

function ClientNode({ f, c, onOpen, delay }: { f: ClientType; c: ClientChoice; onOpen: () => void; delay: number }) {
  const m = CLIENT_META[f];
  const reduce = useReducedMotion();
  const mine = c.flag === f;
  const done = c.done && mine;
  const locked = c.done && !mine;
  const ready = !c.done && (!c.flag || mine);
  const status = done ? `Completed · ${c.name ?? "Selected"}` : locked ? "Not used" : mine ? "Selecting the company..." : c.flag ? "Switch to this" : "Choose to start";
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: locked || (!ready && !done) ? 0.62 : 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={lift(reduce)}
      aria-label={`${m.label}: ${status}`}
      className={cn("relative w-full max-w-[300px] justify-self-center rounded-2xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2", SURFACE, locked && "border-dashed")}
      style={{
        ...DEPTH,
        borderColor: edge(m.color, mine && !c.done ? "active" : done ? "done" : "idle"),
        background: done || mine ? `${m.color}0a` : undefined,
        boxShadow: mine && !c.done ? activeRing(m.color) : undefined,
      }}
    >
      {mine && !c.done && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[18px] border border-dashed"
          style={{ borderColor: m.color }}
          animate={{ opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <span className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: locked ? "#94a3b8" : m.color }}>
          {done ? <Check className="size-5" strokeWidth={3} aria-hidden /> : locked ? <LockKeyhole className="size-4" aria-hidden /> : <m.icon className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{m.label}</span>
          <span className={cn("mt-0.5 block truncate text-xs", !done && !mine && "text-muted-foreground")} style={done || mine ? { color: m.color } : undefined}>
            {status}
          </span>
          {done && <Stamp at={c.at} />}
          {!c.done && (
            <ul className="mt-1.5 hidden space-y-0.5 sm:block">
              {m.items.map((it) => (
                <li key={it} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: `${m.color}99` }} />
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

function ClientFork({ c, onOpen, draw }: { c: ClientChoice; onOpen: (f: ClientType) => void; draw: boolean }) {
  const colors: [string, string] = [CLIENT_META.NEW.color, CLIENT_META.EXISTING.color];
  const split: [boolean, boolean] = c.flag ? [c.flag === "NEW", c.flag === "EXISTING"] : [true, true];
  return (
    <div className="my-1">
      <Fork colors={colors} active={split} draw={false} />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-0 sm:grid-cols-2 sm:gap-8">
        <ClientNode f="NEW" c={c} onOpen={() => onOpen("NEW")} delay={0.12} />
        <ClientNode f="EXISTING" c={c} onOpen={() => onOpen("EXISTING")} delay={0.18} />
      </div>
      <div className="mt-3 sm:mt-0">
        <Fork merge colors={colors} active={c.done ? split : [false, false]} draw={draw} />
      </div>
    </div>
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
        className={cn(
          "relative inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-semibold",
          done ? "border-success/40 bg-success-soft text-success shadow-[0_12px_28px_-16px_rgb(22_163_74/0.7)]" : "border-dashed border-slate-200 bg-surface text-muted-foreground",
        )}
      >
        {celebrate && done && !reduce && <Burst color={SUCCESS} />}
        <Flag className="size-4" aria-hidden />
        {done ? `Lead Completed${a.completedAt ? ` · ${formatDateTimeIST(a.completedAt)}` : ""}` : "Lead Completed"}
      </motion.div>
    </div>
  );
}

/**
 * Lead Management mind map: Create Project (NEW_LEAD) -> New Client / Existing Client -> Project Assign, then Project
 * Assign forks into Assign to Client Servicing and Assign to Recce Team; either branch leads to Lead Completed.
 * `celebrate` is the stage that was just completed (NEW_LEAD draws the forks, PROJECT_ASSIGN runs the chosen branch into
 * Lead Completed).
 */
export function LeadMindMap({
  stages,
  assign,
  client,
  badges = {},
  closed = false,
  celebrate,
  onOpen,
  onClientOpen,
  onBlocked = () => {},
}: {
  stages: LeadStageState[];
  assign: AssignState | null;
  client?: ClientChoice;
  badges?: Partial<Record<MapNode, string>>;
  closed?: boolean;
  celebrate?: LeadStage | null;
  /** `step`: a step of a Project Assign branch (opens that section of the branch drawer). */
  onOpen: (k: MapNode, step?: string) => void;
  onClientOpen?: (f: ClientType) => void;
  /** A step that cannot be opened yet was clicked: why (complete the step before it / other route). */
  onBlocked?: (why: string) => void;
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
  // Assigned, or the route taken by the first save (the other branch is then disabled).
  const chosen: Branch | null = assign ? routeOfAssign(assign) : null;
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
              <StageNode s={s} badge={badges[s.key]} celebrate={celebrate === s.key} closed={closed} onOpen={() => onOpen(s.key)} delay={i * 0.06} client={s.key === "NEW_LEAD" ? client : undefined} />
              {m.right ? <SideCard card={m.right} side="right" color={m.color} state={s.status} delay={0.14 + i * 0.06} /> : <span className="hidden xl:block" />}
            </div>
            {next && s.key === "NEW_LEAD" && client ? (
              <ClientFork c={client} onOpen={(f) => (onClientOpen ? onClientOpen(f) : onOpen("NEW_LEAD"))} draw={i === celebrateIdx} />
            ) : (
              next && <Spine from={m.color} to={STAGE_META[next.key].color} filled={s.status === "DONE"} travel={i === celebrateIdx} flow={next.status === "CURRENT" && !closed} />
            )}
          </div>
        );
      })}

      {assign && (
        <>
          <Fork colors={branchColors} active={chosen ? [chosen === "HANDOVER", chosen === "RECCE"] : [open, open && assign.recce.available]} draw={celebrate === "NEW_LEAD"} />
          <div className="mt-4 grid grid-cols-1 gap-6 sm:mt-0 sm:grid-cols-2 sm:gap-8">
            <BranchColumn k="HANDOVER" a={assign} onOpen={(step) => onOpen("HANDOVER", step)} onBlocked={onBlocked} delay={0.35} celebrate={celebrate === "PROJECT_ASSIGN"} />
            <BranchColumn k="RECCE" a={assign} onOpen={(step) => onOpen("RECCE", step)} onBlocked={onBlocked} delay={0.45} celebrate={celebrate === "PROJECT_ASSIGN"} />
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
        <span className="flex items-center gap-1.5">
          {(["Now", "Next", "Locked", "Disabled"] as const).map((l) => (
            <span key={l} className={cn("rounded-full px-1.5 py-px text-[10px] font-bold uppercase", l === "Now" ? "bg-primary text-white" : l === "Next" ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground")}>
              {l}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
