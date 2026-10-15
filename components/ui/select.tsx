import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-border bg-surface pl-3 pr-9 text-sm text-foreground shadow-soft focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring aria-[invalid=true]:border-danger disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
