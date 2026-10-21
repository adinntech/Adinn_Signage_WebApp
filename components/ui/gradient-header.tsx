import { cn } from "@/lib/utils";

/** Blue-gradient section header from the ADINN reference (letter chip + title + optional right slot). */
export function GradientHeader({
  code,
  title,
  subtitle,
  right,
  className,
}: {
  code?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-t-xl bg-gradient-to-r from-navy via-[#173a8a] to-royal px-4 py-3 text-white",
        className,
      )}
    >
      {code && (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-white/20 px-1.5 text-xs font-bold ring-1 ring-white/30">
          {code}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="truncate text-xs text-white/70">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
