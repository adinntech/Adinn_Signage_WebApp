"use client";

import * as React from "react";
import { animate, useReducedMotion, motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function CountUp({ value }: { value: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = formatNumber(value);
      return;
    }
    const c = animate(0, value, { duration: 0.8, ease: "easeOut", onUpdate: (v) => (el.textContent = formatNumber(Math.round(v))) });
    return () => c.stop();
  }, [value, reduce]);
  return <span ref={ref}>{formatNumber(value)}</span>;
}

export type KpiColor = "blue" | "rose" | "teal" | "green" | "orange" | "purple" | "red";
const COLORS: Record<KpiColor, { card: string; icon: string; value: string }> = {
  blue: { card: "from-[#e8f0ff] to-white border-[#cfe0ff]", icon: "bg-royal text-white", value: "text-royal" },
  rose: { card: "from-[#ffe9ee] to-white border-[#ffd0da]", icon: "bg-[#e11d48] text-white", value: "text-[#e11d48]" },
  teal: { card: "from-[#dcf7f3] to-white border-[#b7ece5]", icon: "bg-recce text-white", value: "text-recce" },
  green: { card: "from-[#e2f8ea] to-white border-[#bdebcc]", icon: "bg-finance text-white", value: "text-finance" },
  orange: { card: "from-[#fff0e0] to-white border-[#ffd9b0]", icon: "bg-approval text-white", value: "text-approval" },
  purple: { card: "from-[#f1e6ff] to-white border-[#ddc4fb]", icon: "bg-vendor text-white", value: "text-vendor" },
  red: { card: "from-[#ffe8e8] to-white border-[#ffc9c9]", icon: "bg-loss text-white", value: "text-loss" },
};

/** Colorful KPI tile. Clickable when `onClick` is given (used as a quick filter). */

/** KPI stat card with an icon chip and count-up value. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
  delay = 0,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: KpiColor;
  active?: boolean;
  onClick?: () => void;
  delay?: number;
}) {
  const c = COLORS[color];
  const body = (
    <>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl shadow-soft", c.icon)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 text-left">
        <span className={cn("block text-3xl font-bold leading-none tabular-nums", c.value)}>{value}</span>
        <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">{label}</span>
      </span>
    </>
  );
  const cls = cn(
    "flex w-full items-center gap-3 rounded-xl border bg-gradient-to-br p-4 shadow-soft transition-shadow",
    c.card,
    onClick && "cursor-pointer hover:shadow-card",
    active && "ring-2 ring-royal ring-offset-1",
  );
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}>
      {onClick ? (
        <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.div>
  );
}
