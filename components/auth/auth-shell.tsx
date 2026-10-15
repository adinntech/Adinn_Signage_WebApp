"use client";

import { motion } from "framer-motion";
import { MonitorPlay } from "lucide-react";
import { BrandPanel } from "./brand-panel";

const WIDTHS = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-4xl 2xl:max-w-5xl", form: "max-w-2xl 2xl:max-w-3xl" } as const;

/**
 * Split screen used by sign in and register: brand panel left, form right.
 * Type scales with clamp() so it reads well from small laptops to large monitors.
 */
export function AuthShell({
  title,
  eyebrow,
  subtitle,
  children,
  wide,
  size,
}: {
  title: string;
  /** Smaller line above the title, e.g. "Welcome to". */
  eyebrow?: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
  size?: keyof typeof WIDTHS;
}) {
  const width = WIDTHS[size ?? (wide ? "lg" : "md")];
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <BrandPanel />
      <section className="flex min-h-dvh items-start justify-center overflow-y-auto bg-linear-to-br from-white via-[#f5f8ff] to-[#e9f0ff] p-6 sm:p-10 lg:items-center 2xl:p-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={`w-full ${width}`}>
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-[#102449] to-[#2563EB] text-white shadow-card">
              <MonitorPlay className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-[0.15em] text-[#102449]">ADINN</span>
          </div>
          {eyebrow && <p className="text-[clamp(1.1rem,1.7vw,1.9rem)] font-medium leading-tight text-[#102449]/85">{eyebrow}</p>}
          <h1 className={eyebrow ? "mt-1 text-[clamp(1.6rem,2.9vw,3.1rem)] font-bold leading-tight tracking-tight text-[#102449]" : "text-[clamp(1.75rem,3vw,3.1rem)] font-bold leading-tight tracking-tight text-[#102449]"}>{title}</h1>
          {subtitle && <p className="mt-2 text-[clamp(0.85rem,1.05vw,1.15rem)] text-muted-foreground">{subtitle}</p>}
          {children}
        </motion.div>
      </section>
    </main>
  );
}

export function FormAlert({ kind, children }: { kind: "error" | "info" | "success"; children: React.ReactNode }) {
  const tone = kind === "error" ? "border-danger/30 bg-danger-soft text-danger" : kind === "success" ? "border-success/30 bg-success-soft text-success" : "border-warning/30 bg-warning-soft text-foreground";
  return (
    <motion.div role={kind === "error" ? "alert" : "status"} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: kind === "error" ? [0, -6, 6, -4, 4, 0] : 0 }} transition={{ duration: 0.35 }} className={`mt-5 rounded-lg border p-3 text-sm 2xl:text-base ${tone}`}>
      {children}
    </motion.div>
  );
}
