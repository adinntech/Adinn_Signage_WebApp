"use client";
import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuSeparator({ className, ...p }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...p} />;
}
export function DropdownMenuLabel({ className, ...p }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("px-2 py-1.5 text-sm", className)} {...p} />;
}
export function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn("z-50 min-w-56 rounded-lg border border-border bg-surface p-1 shadow-card", className)}
        {...props}
      />
    </DM.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
