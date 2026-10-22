"use client";

import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

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

/** KPI stat card with an icon chip and count-up value. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
  loading,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  /** CSS colour for the icon chip. */
  color: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-soft transition-shadow hover:shadow-card">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-8 w-16" /> : <p className={cn("text-2xl font-bold tracking-tight text-foreground")}>{value === undefined ? "-" : <CountUp value={value} />}</p>}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
