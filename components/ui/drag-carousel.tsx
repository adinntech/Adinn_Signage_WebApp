"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const EDGE = 0.14; // share of the width, at each end, where hovering scrolls on its own
const SPEED = 9; // px per frame at the very edge
const NO_DRAG = "input, textarea, select, button, a, label, [role='button']";

/**
 * A row of cards in a flex strip. Drag empty space to move it, hover near either end to glide that way,
 * or use the arrows. Form controls inside a card stay usable (a drag never starts on them).
 */
export function DragCarousel({ children, label, className = "", stretch = false }: { children: ReactNode; label: string; className?: string; /** Make every card as tall as the tallest one. */ stretch?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const dir = useRef(0);
  const raf = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("resize", measure); cancelAnimationFrame(raf.current); };
  }, [measure]);

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tick() {
    const el = ref.current;
    if (!el || dir.current === 0) { raf.current = 0; return; }
    el.scrollLeft += dir.current;
    raf.current = requestAnimationFrame(tick);
  }
  function glide(d: number) {
    dir.current = d;
    if (d !== 0 && !raf.current) raf.current = requestAnimationFrame(tick);
    if (d === 0) { cancelAnimationFrame(raf.current); raf.current = 0; }
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (drag.current) { el.scrollLeft = drag.current.left - (e.clientX - drag.current.x); return; }
    if (e.pointerType !== "mouse" || reduced()) return;
    const r = el.getBoundingClientRect();
    const p = (e.clientX - r.left) / r.width;
    if (p < EDGE) glide(-SPEED * (1 - p / EDGE));
    else if (p > 1 - EDGE) glide(SPEED * (1 - (1 - p) / EDGE));
    else glide(0);
  }
  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0 || (e.target as HTMLElement).closest(NO_DRAG)) return;
    glide(0);
    drag.current = { x: e.clientX, left: ref.current?.scrollLeft ?? 0 };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onUp() { drag.current = null; setDragging(false); }

  function page(d: number) {
    const el = ref.current;
    if (el) el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: reduced() ? "auto" : "smooth" });
  }

  return (
    <div className={`relative ${className}`}>
      {!(edge.start && edge.end) && (
        <>
          <button type="button" aria-label="Previous" disabled={edge.start} onClick={() => page(-1)} className="absolute -left-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-navy shadow-soft transition disabled:pointer-events-none disabled:opacity-0"><ChevronLeft className="size-5" aria-hidden /></button>
          <button type="button" aria-label="Next" disabled={edge.end} onClick={() => page(1)} className="absolute -right-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-navy shadow-soft transition disabled:pointer-events-none disabled:opacity-0"><ChevronRight className="size-5" aria-hidden /></button>
        </>
      )}
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => glide(0)}
        onKeyDown={(e) => { if (e.key === "ArrowRight") page(1); else if (e.key === "ArrowLeft") page(-1); }}
        className={`flex ${stretch ? "items-stretch" : "items-start"} gap-4 overflow-x-auto px-1 pb-3 [scrollbar-width:thin] ${dragging ? "cursor-grabbing select-none" : "cursor-grab snap-x snap-proximity"}`}
      >
        {children}
      </div>
    </div>
  );
}
