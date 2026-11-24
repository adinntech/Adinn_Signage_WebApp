"use client";

import { cn } from "@/lib/utils";

/**
 * On / off switch (a real `role="switch"` button: Space and Enter toggle it). Give it an `label` that says what it controls
 * ("Active: GSB Board"); the visible text, if any, is the caller's. The same look as the switches on the vendor screens.
 */
export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
  title,
  className,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-royal" : "bg-[#cbd5e1]",
        className,
      )}
    >
      <span aria-hidden className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[1.375rem]" : "left-0.5")} />
    </button>
  );
}
