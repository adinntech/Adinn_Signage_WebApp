"use client";

import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Scrolls the element with this id into view once `ready` (e.g. a drawer section opened from a mind map step).
 * Waits for the drawer to slide in first. Does nothing without an id.
 */
export function useScrollTo(id: string | null | undefined, ready = true, delay = 380) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!id || !ready) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }), delay);
    return () => clearTimeout(t);
  }, [id, ready, delay, reduce]);
}
