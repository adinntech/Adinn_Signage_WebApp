"use client";

import { cn } from "@/lib/utils";

/** The ZOHO logo (public/images/Zoho_logo.png). The file is a 600 px square with the wordmark in the middle band, so it is cropped to the wordmark. */
function ZohoMark() {
  return (
    <span className="relative block h-7 w-20 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/Zoho_logo.png" alt="" className="absolute max-w-none" style={{ width: "111.1%", left: "-5.56%", top: "-107.9%" }} />
    </span>
  );
}

/** "ZOHO vendors" switch: off shows nothing from Zoho, on fetches the Zoho vendor list. */
export function ZohoToggle({ on, onChange, className }: { on: boolean; onChange: (on: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Zoho vendors"
      onClick={() => onChange(!on)}
      className={cn("flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-3 pr-2 text-sm font-semibold text-navy shadow-soft transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
    >
      <ZohoMark />
      vendors
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-royal" : "bg-[#cbd5e1]")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
      </span>
    </button>
  );
}
