"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The 10-digit mobile number only: "+91 98765 43210", "919876543210" or "098765 43210" (typed, pasted or a stored value
 * with the country code) become "9876543210". Never adds +91, so it cannot double it.
 */
export function toMobile10(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

/**
 * Indian mobile number field: a fixed "+91" on the left (part of the box, not editable or selectable, not in the
 * value) and the 10 digits on the right. The value and every change carry only the 10 digits. Works with
 * react-hook-form's register() and with a plain value / onChange, like Input.
 */
export function PhoneInput({ className, onChange, value, defaultValue, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = toMobile10(e.target.value);
    if (clean !== e.target.value) e.target.value = clean;
    onChange?.(e);
  };
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 flex select-none items-center border-r border-border px-3 text-sm font-medium text-muted-foreground"
      >
        +91
      </span>
      <Input
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        // No maxLength: a pasted "+91 98765 43210" must reach the handler whole (it keeps the last 10 digits).
        {...props}
        {...(value !== undefined ? { value: toMobile10(String(value)) } : {})}
        {...(defaultValue !== undefined ? { defaultValue: toMobile10(String(defaultValue)) } : {})}
        aria-description={props["aria-description"] ?? "Country code +91"}
        className={cn("pl-[3.75rem] tabular-nums", className)}
        onChange={handle}
      />
    </div>
  );
}
