"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, MessageSquareText, TriangleAlert } from "lucide-react";
import { STAGE_ICON, STATE_META } from "@/components/journey/stage-meta";
import type { JourneyStage } from "@/lib/api/journey";
import { formatDate } from "@/lib/format";

/**
 * The curved process flow. Eight stages sit on one smooth path that runs left to right, loops back through the middle
 * and runs left to right again. Geometry is in a 1000 x 520 box; nodes are HTML buttons placed by percentage so they
 * stay clickable and readable while the SVG stretches.
 */
const W = 1000;
const H = 520;
const PATH = "M 30 120 H 880 C 1000 120 1000 260 500 260 C 0 260 0 400 120 400 H 970";
const COLS = [120, 373, 627, 880];
const point = (i: number) => ({ x: COLS[i % 4]!, y: i < 4 ? 120 : 400 });

export function JourneyPath({ stages, selected, onSelect }: { stages: JourneyStage[]; selected: string; onSelect: (key: JourneyStage["key"]) => void }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const base = useRef<SVGPathElement>(null);
  const done = useRef<SVGPathElement>(null);

  // Where the finished (blue) part of the path ends: at the furthest stage that has started.
  const reached = stages.reduce((n, s) => (s.state === "COMPLETED" || s.state === "IN_PROGRESS" || s.state === "BLOCKED" ? s.index : n), 0);

  useEffect(() => {
    const path = base.current;
    const fill = done.current;
    const root = box.current;
    if (!path || !fill || !root) return;
    const total = path.getTotalLength();
    // Length along the path of the node that was reached (closest sampled point).
    const target = point(reached);
    let best = 0;
    let bestD = Infinity;
    for (let l = 0; l <= total; l += total / 600) {
      const p = path.getPointAtLength(l);
      const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    fill.style.strokeDasharray = `${total}`;
    if (reduce) {
      fill.style.strokeDashoffset = `${total - best}`;
      return;
    }
    fill.style.strokeDashoffset = `${total}`;
    let revert: (() => void) | undefined;
    let cancelled = false;
    // The animation libraries are loaded only when this view is shown.
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const trigger = { trigger: root, start: "top 85%", once: true };
        gsap.to(fill, { strokeDashoffset: total - best, duration: 1.6, ease: "power2.inOut", scrollTrigger: trigger });
        gsap.from(".journey-node", { scale: 0.7, opacity: 0, duration: 0.45, stagger: 0.09, ease: "back.out(1.6)", scrollTrigger: trigger });
        gsap.from(".journey-label", { y: 8, opacity: 0, duration: 0.4, stagger: 0.09, delay: 0.2, scrollTrigger: trigger });
      }, root);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [reached, reduce]);

  return (
    <div ref={box} className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id="journey-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2563EB" />
            <stop offset="1" stopColor="#7c5cd6" />
          </linearGradient>
        </defs>
        <path d={PATH} fill="none" stroke="#dbe5f7" strokeWidth={14} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path ref={base} d={PATH} fill="none" stroke="#b7c6e6" strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="journey-flow" />
        <path ref={done} d={PATH} fill="none" stroke="url(#journey-grad)" strokeWidth={8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      {stages.map((s) => {
        const { x, y } = point(s.index);
        const m = STATE_META[s.state];
        const Icon = s.state === "COMPLETED" ? Check : STAGE_ICON[s.key];
        const active = selected === s.key;
        const when = s.state === "COMPLETED" ? s.completedAt : s.startedAt;
        return (
          <div key={s.key} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
            <div className="journey-node relative">
              {s.state === "IN_PROGRESS" && <span className="journey-pulse absolute inset-0 rounded-full" style={{ background: m.color }} aria-hidden />}
              {active && (
                <motion.span layoutId="journey-selected" className="absolute -inset-2 rounded-full border-2" style={{ borderColor: m.color }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <motion.button
                type="button"
                onClick={() => onSelect(s.key)}
                whileHover={reduce ? undefined : { scale: 1.08 }}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                aria-pressed={active}
                aria-label={`${s.label}: ${m.label}`}
                className="relative flex size-[clamp(2.75rem,7vw,4.5rem)] items-center justify-center rounded-full border-4 border-white text-white shadow-card outline-offset-4"
                style={{ background: m.color, boxShadow: `0 0 0 3px ${m.ring}, 0 8px 18px -6px ${m.color}80` }}
              >
                <Icon className="size-[45%]" aria-hidden />
                {s.comments.length > 0 && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-royal px-1 text-[10px] font-bold text-white ring-2 ring-white" title={`${s.comments.length} comment${s.comments.length === 1 ? "" : "s"}`}>
                    <MessageSquareText className="size-2.5" aria-hidden />
                    {s.comments.length}
                  </span>
                )}
                {s.overdue && (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-danger text-white ring-2 ring-white" title={s.overdueReason ?? "Overdue"}>
                    <TriangleAlert className="size-3" aria-hidden />
                  </span>
                )}
              </motion.button>
            </div>
            <div className="journey-label pointer-events-none absolute left-1/2 top-full mt-3 w-[clamp(5.5rem,16vw,10rem)] -translate-x-1/2 text-center">
              <p className="text-[clamp(0.7rem,1.3vw,0.9rem)] font-semibold leading-tight text-primary">{s.label}</p>
              <p className="text-[clamp(0.65rem,1.1vw,0.75rem)] font-semibold" style={{ color: m.color }}>
                {m.label}
              </p>
              {when && <p className="text-[clamp(0.6rem,1vw,0.7rem)] text-muted-foreground">{formatDate(when)}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
