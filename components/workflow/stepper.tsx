import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Horizontal numbered step indicator. Completed steps are clickable via `onStep`. */
export function Stepper({ steps, current, onStep }: { steps: string[]; current: number; onStep?: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
            <button
              type="button"
              disabled={!done || !onStep}
              onClick={() => onStep?.(i)}
              className="flex items-center gap-2 rounded-full px-1.5 py-1 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  done && "bg-finance text-white",
                  active && "bg-royal text-white ring-4 ring-royal/15",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-xs font-medium", active ? "text-navy" : "text-muted-foreground")}>{s}</span>
            </button>
            {i < steps.length - 1 && (
              <span aria-hidden className={cn("mx-1 h-0.5 w-6 shrink-0 rounded", done ? "bg-finance" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
