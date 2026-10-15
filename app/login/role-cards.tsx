"use client";

import { motion } from "framer-motion";
import { ChevronRight, Smartphone } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { LOGIN_ROLES } from "@/lib/login-roles";
import { cn } from "@/lib/utils";

/**
 * Role picker (a native radio group, so arrow keys and screen readers work).
 * xl and up: a vertical list joined by a timeline line. Below xl: a compact card grid.
 */
export function RoleCards({ registration, invalid }: { registration: UseFormRegisterReturn; invalid?: boolean }) {
  return (
    <fieldset aria-describedby="role-help" className="min-w-0">
      <legend className="text-[clamp(1rem,1.25vw,1.35rem)] font-bold text-[#102449]">Choose Your Role</legend>
      <p id="role-help" className="mt-1 text-sm text-muted-foreground 2xl:text-base">
        Access the features and tools built for your team.
      </p>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:flex xl:flex-col xl:gap-3">
        {LOGIN_ROLES.map(({ key, label, hint, icon: Icon, mobileOnly, accent }, index) => (
          <label key={key} style={{ "--role": accent } as React.CSSProperties} className="relative cursor-pointer xl:pl-7">
            {/*
              Timeline (xl only). Each row draws only its own halves of the line, so it stays aligned whatever the row heights are:
              the upper half reaches up through the gap to the previous row, the lower half runs to the bottom edge.
              The dot is 1.05rem wide, so its centre is 0.525rem from the left; the line is 2px wide.
            */}
            {index > 0 && <span aria-hidden data-tl="up" className="absolute left-[calc(0.525rem-1px)] top-[-0.75rem] hidden h-[calc(50%+0.75rem)] w-0.5 bg-[#2563EB]/30 xl:block" />}
            {index < LOGIN_ROLES.length - 1 && <span aria-hidden data-tl="down" className="absolute bottom-0 left-[calc(0.525rem-1px)] top-1/2 hidden w-0.5 bg-[#2563EB]/30 xl:block" />}
            <span aria-hidden data-tl="dot" className="absolute left-0 top-1/2 z-10 hidden size-[1.05rem] -translate-y-1/2 rounded-full border-[3px] border-[var(--role)] bg-white transition-colors xl:block" />
            <input type="radio" value={key} className="peer sr-only" {...registration} />
            <motion.span
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex h-full items-center gap-3 rounded-2xl border p-3 text-left shadow-soft transition 2xl:p-4",
                "flex-col text-center xl:flex-row xl:text-left",
                "bg-white/80 hover:border-[color-mix(in_srgb,var(--role)_55%,white)] hover:bg-white hover:shadow-card",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                "peer-checked:border-[var(--role)] peer-checked:bg-linear-to-r peer-checked:from-[var(--role)] peer-checked:to-[color-mix(in_srgb,var(--role),white_22%)] peer-checked:text-white peer-checked:shadow-card",
                "peer-checked:[&_.hint]:text-white/80 peer-checked:[&_.icon]:bg-white/15 peer-checked:[&_.icon]:text-white peer-checked:[&_.chev]:opacity-100 peer-checked:[&_.mobile]:text-white",
                invalid ? "border-danger" : "border-[#dfe7f7]",
              )}
            >
              <span className="icon flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--role)_12%,white)] text-[var(--role)] transition 2xl:size-12">
                <Icon className="size-5 2xl:size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight 2xl:text-base">{label}</span>
                <span className="hint block text-xs leading-tight text-muted-foreground 2xl:text-sm">{hint}</span>
              </span>
              <ChevronRight className="chev hidden size-5 shrink-0 opacity-0 transition xl:block" aria-hidden />
              {mobileOnly && (
                <span className="mobile absolute right-2 top-2 text-[#0D9488] xl:right-10 xl:top-1/2 xl:-translate-y-1/2" title="Mobile app only">
                  <Smartphone className="size-3.5" aria-label="Mobile app only" />
                </span>
              )}
            </motion.span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
