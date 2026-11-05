"use client";

import * as React from "react";
import { X } from "lucide-react";
import { FORMATS, type InputFormat } from "@/lib/input-format";
import { cn } from "@/lib/utils";

/** A search box is a controlled input with room for an icon (pl-9) and a label or placeholder that starts with "Search". */
const isSearchBox = (p: React.ComponentProps<"input">) =>
  !p.readOnly && !p.disabled && /(^|\s)pl-9(\s|$)/.test(p.className ?? "") && /^(search|find)/i.test(String(p["aria-label"] ?? p.placeholder ?? ""));

/**
 * Text field. Give it a `format` (phone, pincode, digits, decimal, coord, gst, pan, ifsc, account, email) and only
 * characters that belong there can be typed or pasted, up to the right length. Works with react-hook-form's register()
 * and with plain value / onChange, because the cleaned text is what the change handler sees.
 * A search box (see isSearchBox) shows a cross at its right corner while it holds text; it clears the box.
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
  const clearable = !spec && isSearchBox({ ...props, className }) && props.value != null && String(props.value) !== "";
  const clear = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget.previousElementSibling as HTMLInputElement | null;
    if (!el) return;
    // Go through the native setter so React sees a real change and the owner's onChange runs with "".
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  };
  const field = (
    <input
      type={format === "email" ? "text" : type}
      {...(spec ? { inputMode: spec.inputMode, autoComplete: spec.autoComplete, maxLength: spec.max, title: spec.title, ...(format === "gst" || format === "pan" || format === "ifsc" ? { autoCapitalize: "characters" } : {}) } : {})}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-soft placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring aria-[invalid=true]:border-danger disabled:opacity-60",
        className,
        clearable && "pr-9",
      )}
      {...props}
      onChange={handle}
    />
  );
  if (!clearable) return field;
  return (
    <>
      {field}
      <button type="button" aria-label="Clear search" title="Clear" onClick={clear} className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <X className="size-4" aria-hidden />
      </button>
    </>
  );
}
