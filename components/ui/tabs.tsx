"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabDef {
  key: string;
  label: string;
  /** Small count pill after the label. */
  count?: number | string | undefined;
  icon?: LucideIcon;
}

/**
 * Tab bar with a sliding underline, arrow-key navigation (Left, Right, Home, End) and the same look everywhere.
 * Each bar animates only against its own tabs, so several bars on one page never interfere.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (key: string) => void;
  label: string;
  className?: string;
}) {
  const group = useId();
  const reduce = useReducedMotion();

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next]!.key);
    document.getElementById(`${group}-${tabs[next]!.key}`)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto px-3 pt-1", className)}>
      {tabs.map((t, i) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            id={`${group}-${t.key}`}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 pb-2.5 pt-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              on ? "text-royal" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t.icon && <t.icon className="size-4" aria-hidden />}
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 py-0.5 text-xs transition-colors", on ? "bg-royal/10" : "bg-muted")}>{t.count}</span>}
            {on && (
              <motion.span
                layoutId={`${group}-underline`}
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-royal"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Content of the selected tab: fades and rises in a few pixels. Give it the selected tab as `k` so it re-enters on change. */
export function TabPanel({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={k}
      role="tabpanel"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
