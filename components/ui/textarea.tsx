import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-soft placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring aria-[invalid=true]:border-danger disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
