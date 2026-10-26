import * as React from "react";
import { FORMATS, type InputFormat } from "@/lib/input-format";
import { cn } from "@/lib/utils";

/**
 * Text field. Give it a `format` (phone, pincode, digits, decimal, coord, gst, pan, ifsc, account, email) and only
 * characters that belong there can be typed or pasted, up to the right length. Works with react-hook-form's register()
 * and with plain value / onChange, because the cleaned text is what the change handler sees.
 */
export function Input({ className, type = "text", format, onChange, ...props }: React.ComponentProps<"input"> & { format?: InputFormat }) {
  const spec = format ? FORMATS[format] : undefined;
  const handle = spec
    ? (e: React.ChangeEvent<HTMLInputElement>) => {
        const clean = spec.clean(e.target.value);
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }
    : onChange;
  return (
    <input
      type={format === "email" ? "text" : type}
      {...(spec ? { inputMode: spec.inputMode, autoComplete: spec.autoComplete, maxLength: spec.max, title: spec.title, ...(format === "gst" || format === "pan" || format === "ifsc" ? { autoCapitalize: "characters" } : {}) } : {})}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-soft placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring aria-[invalid=true]:border-danger disabled:opacity-60",
        className,
      )}
      {...props}
      onChange={handle}
    />
  );
}
