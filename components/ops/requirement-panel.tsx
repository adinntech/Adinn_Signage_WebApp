import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  blue: "from-[#1d4ed8] via-[#2563eb] to-[#38bdf8]",
  pink: "from-[#be185d] via-[#ec4899] to-[#f472b6]",
  green: "from-[#047857] via-[#10b981] to-[#34d399]",
  orange: "from-[#c2410c] via-[#f97316] to-[#fbbf24]",
  purple: "from-[#6d28d9] via-[#9333ea] to-[#c084fc]",
  soft: "from-[#eef4ff] to-[#f7faff]",
} as const;
export type PanelTone = keyof typeof TONES;

/**
 * The numbered, colourful section card from the ADINN reference: number chip, title, tag pill and a short description
 * on a gradient header, with the section content below.
 */
export function RequirementPanel({
  n,
  title,
  tag,
  tone,
  description,
  actions,
  children,
  className,
}: {
  n: number | string;
  title: string;
  tag?: string;
  tone: PanelTone;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const soft = tone === "soft";
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-surface shadow-soft", className)}>
      <div className={cn("bg-gradient-to-r px-4 py-3", soft ? "border-b border-border text-navy" : "text-white", TONES[tone])}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-bold ring-1", soft ? "bg-royal/10 text-royal ring-royal/20" : "bg-white/25 ring-white/40")}>{n}</span>
          <h2 className="min-w-0 flex-1 text-lg font-bold leading-tight">{title}</h2>
          {tag && <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", soft ? "bg-white text-royal ring-royal/20" : "bg-white/25 ring-white/40")}>{tag}</span>}
          {actions}
        </div>
        {description && <p className={cn("mt-1.5 text-sm", soft ? "text-muted-foreground" : "text-white/90")}>{description}</p>}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}
