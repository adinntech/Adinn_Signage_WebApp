"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronsDownUp, ChevronsUpDown, Store, UserRound, Users } from "lucide-react";
import type { Tally, TrackingOverview, TrackMember } from "@/lib/api/projectTracking";
import { cn } from "@/lib/utils";
import { INHOUSE, RED, stateOf, VENDOR } from "./ui";

export type MapOpen = { vendor: boolean; inhouse: boolean };
const CHIP = 40;
const GAP = 10;
const LIMIT = 8;

/** Curved connectors from every chip (left / right column) to the middle of the branch circle. */
function Connectors({ count, side, color }: { count: number; side: "left" | "right"; color: string }) {
  const h = count * CHIP + (count - 1) * GAP;
  const mid = h / 2;
  const w = 36;
  return (
    <svg width={w} height={h} className="hidden shrink-0 @min-[920px]:block" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const y = i * (CHIP + GAP) + CHIP / 2;
        const d = side === "left" ? `M0,${y} C${w / 2},${y} ${w / 2},${mid} ${w},${mid}` : `M${w},${y} C${w / 2},${y} ${w / 2},${mid} 0,${mid}`;
        return <path key={i} d={d} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1.5} />;
      })}
    </svg>
  );
}

function MemberChip({ m, color, selected, onClick, label }: { m: TrackMember; color: string; selected: boolean; onClick: () => void; label: string }) {
  const s = stateOf(m);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={`${m.name}: ${m.completed} of ${m.assigned} completed${m.rejected ? `, ${m.rejected} rejected` : ""}`}
      className={cn(
        "flex w-full items-center gap-2 rounded-full border bg-white px-3 text-left text-[13px] shadow-sm transition-all hover:-translate-y-px hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2",
        selected ? "ring-2" : "border-[#E5E7EB]",
      )}
      style={{ height: CHIP, borderColor: selected ? color : undefined, ["--tw-ring-color" as string]: `${color}55`, outlineColor: color }}
    >
      <span className="min-w-0 flex-1 truncate font-semibold text-[#1F2937]" aria-label={label}>{m.name}</span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-[#374151]">{m.completed} / {m.assigned}</span>
      <s.Icon className="size-4 shrink-0" style={{ color: s.color }} aria-label={s.label} />
    </button>
  );
}

function MemberColumn({ list, side, color, selected, onSelect }: { list: TrackMember[]; side: "left" | "right"; color: string; selected: string | null; onSelect: (m: TrackMember) => void }) {
  const [all, setAll] = useState(false);
  const reduce = useReducedMotion();
  const shown = all ? list : list.slice(0, LIMIT);
  const extra = list.length - shown.length;
  const rows = shown.length + (extra > 0 || all ? 1 : 0);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: side === "left" ? 16 : -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: side === "left" ? 16 : -16 }}
      transition={{ duration: 0.22 }}
      className={cn("flex w-full min-w-0 items-center @min-[920px]:w-auto", side === "right" && "flex-row-reverse")}
    >
      <ul className="grid w-full min-w-0 gap-[10px] @min-[520px]:grid-cols-2 @min-[920px]:w-[170px] @min-[1180px]:w-[200px] @min-[920px]:grid-cols-1">
        {shown.map((m) => (
          <li key={m.id}>
            <MemberChip m={m} color={color} selected={selected === m.id} onClick={() => onSelect(m)} label={m.name} />
          </li>
        ))}
        {(extra > 0 || all) && list.length > LIMIT && (
          <li>
            <button type="button" onClick={() => setAll((v) => !v)} className="flex w-full items-center justify-center rounded-full border border-dashed text-xs font-semibold hover:bg-[#F9FAFB]" style={{ height: CHIP, borderColor: color, color }}>
              {all ? "Show less" : `+${extra} more`}
            </button>
          </li>
        )}
      </ul>
      <Connectors count={rows} side={side} color={color} />
    </motion.div>
  );
}

function BranchNode({ title, sub, t, members, color, Icon, open, onToggle }: { title: string; sub: string; t: Tally; members: number; color: string; Icon: typeof Users; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="relative grid size-28 shrink-0 place-items-center rounded-full border-2 bg-white text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 @min-[480px]:size-36 @min-[1280px]:size-40"
      style={{ borderColor: `${color}66`, background: `radial-gradient(circle at 50% 35%, ${color}14, #fff 70%)`, outlineColor: color }}
    >
      <span className="flex flex-col items-center px-2 @min-[480px]:px-3">
        <Icon className="size-5 @min-[480px]:size-6" style={{ color }} aria-hidden />
        <span className="mt-1 text-[11px] font-semibold leading-tight text-[#1F2937] @min-[480px]:text-[13px]">{title}</span>
        <span className="text-base font-bold leading-tight text-[#111827] @min-[480px]:text-lg">{t.assigned} Shops</span>
        <span className="text-[10px] text-[#6B7280] @min-[480px]:text-[11px]">({members} {sub})</span>
      </span>
      <span className="absolute -bottom-2 rounded-full bg-white px-2 text-[10px] font-semibold shadow" style={{ color }}>{open ? "Hide" : "Show"} list</span>
    </button>
  );
}

const Link = ({ color }: { color: string }) => (
  <span className="relative hidden h-0.5 min-w-4 flex-1 @min-[480px]:block" style={{ background: `${color}88` }} aria-hidden>
    <span className="absolute -left-1 -top-[3px] size-2 rounded-full" style={{ background: color }} />
    <span className="absolute -right-1 -top-[3px] size-2 rounded-full" style={{ background: color }} />
  </span>
);

/**
 * Recce mind map (first reference design): vendors on the left, the project in the centre, in-house staff on the right. Click the
 * project to open / close both branches, a branch to open / close its list, a vendor or staff member to open their shops.
 */
export function MindMap({ data, open, setOpen, selected, onSelect }: { data: TrackingOverview; open: MapOpen; setOpen: (o: MapOpen) => void; selected: string | null; onSelect: (m: TrackMember) => void }) {
  const { counts, branches, vendors, staff } = data;
  const anyOpen = open.vendor || open.inhouse;
  const hasV = vendors.length > 0;
  const hasI = staff.length > 0;
  return (
    // Layout follows the card's own width (container queries), not the window: the sidebar takes part of the screen.
    <div className="@container relative overflow-hidden rounded-2xl border border-[#EEF0F3] bg-[#FAFBFC] p-4 sm:p-6">
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button type="button" onClick={() => setOpen({ vendor: hasV, inhouse: hasI })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]">
          <ChevronsUpDown className="size-3.5" aria-hidden /> Expand all
        </button>
        <button type="button" onClick={() => setOpen({ vendor: false, inhouse: false })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]">
          <ChevronsDownUp className="size-3.5" aria-hidden /> Collapse all
        </button>
      </div>

      <div className="mt-10 flex flex-col items-center gap-6 @min-[920px]:mt-2 @min-[920px]:min-h-[340px] @min-[920px]:flex-row @min-[920px]:justify-center @min-[920px]:gap-0">
        {/* Vendors */}
        <div className="order-2 flex w-full min-w-0 justify-end @min-[920px]:order-none @min-[920px]:w-auto @min-[920px]:flex-1">
          <AnimatePresence initial={false}>{open.vendor && hasV && <MemberColumn key="v" list={vendors} side="left" color={VENDOR} selected={selected} onSelect={onSelect} />}</AnimatePresence>
        </div>

        <div className="order-1 flex w-full items-center justify-center gap-0 @min-[920px]:order-none @min-[920px]:w-auto @min-[920px]:max-w-[620px] @min-[920px]:flex-[2]">
          {hasV ? <BranchNode title="Vendors (Free-Lancers)" sub="Vendors" t={branches.vendor} members={counts.vendors} color={VENDOR} Icon={Users} open={open.vendor} onToggle={() => setOpen({ ...open, vendor: !open.vendor })} /> : <span className="hidden w-36 @min-[480px]:block" />}
          {hasV ? <Link color={VENDOR} /> : <span className="hidden flex-1 @min-[480px]:block" />}
          <button
            type="button"
            onClick={() => setOpen(anyOpen ? { vendor: false, inhouse: false } : { vendor: hasV, inhouse: hasI })}
            aria-expanded={anyOpen}
            className="relative mx-1.5 grid size-32 shrink-0 place-items-center rounded-full border-[3px] bg-white text-center shadow-[0_0_0_10px_rgba(217,45,32,0.06),0_0_0_22px_rgba(217,45,32,0.035)] transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 @min-[480px]:mx-2 @min-[480px]:size-40 @min-[480px]:shadow-[0_0_0_14px_rgba(217,45,32,0.06),0_0_0_30px_rgba(217,45,32,0.035)] @min-[1280px]:size-48"
            style={{ borderColor: RED, outlineColor: RED }}
          >
            <span className="flex flex-col items-center">
              <Store className="size-6 @min-[480px]:size-8" style={{ color: RED }} aria-hidden />
              <span className="mt-1 text-xs font-semibold text-[#1F2937] @min-[480px]:text-sm">Recce Project</span>
              <span className="text-xl font-bold text-[#111827] @min-[480px]:text-2xl">{counts.total} Shops</span>
              {counts.notAllocated > 0 && <span className="text-[11px] text-[#6B7280]">{counts.notAllocated} not allocated</span>}
            </span>
          </button>
          {hasI ? <Link color={INHOUSE} /> : <span className="hidden flex-1 @min-[480px]:block" />}
          {hasI ? <BranchNode title="In-house Staff" sub="Members" t={branches.inhouse} members={counts.staff} color={INHOUSE} Icon={UserRound} open={open.inhouse} onToggle={() => setOpen({ ...open, inhouse: !open.inhouse })} /> : <span className="hidden w-36 @min-[480px]:block" />}
        </div>

        {/* In-house staff */}
        <div className="order-3 flex w-full min-w-0 justify-start @min-[920px]:w-auto @min-[920px]:flex-1">
          <AnimatePresence initial={false}>{open.inhouse && hasI && <MemberColumn key="i" list={staff} side="right" color={INHOUSE} selected={selected} onSelect={onSelect} />}</AnimatePresence>
        </div>
      </div>

      {!anyOpen && <p className="mt-4 text-center text-xs text-[#6B7280]">Click the project to open the allocation, then a vendor or staff member to see their shops.</p>}
    </div>
  );
}
