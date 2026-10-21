import { cn } from "@/lib/utils";

/** ADINN wordmark (stand-in until the official logo asset is dropped into /public). */
export function AdinnLogo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("select-none font-extrabold tracking-wide text-white", className)} aria-label="ADINN">
      <span className="text-[#ff3b3b]">A</span>
      {!compact && <span>DINN</span>}
    </span>
  );
}
