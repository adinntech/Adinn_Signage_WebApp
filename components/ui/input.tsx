import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-soft placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring aria-[invalid=true]:border-danger disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
