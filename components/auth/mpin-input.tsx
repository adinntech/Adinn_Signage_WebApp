"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  label: string;
  autoFocus?: boolean;
  onComplete?: () => void;
}

/** Four masked digit boxes with auto-advance, backspace and paste support. */
export function MpinInput({ value, onChange, invalid, disabled, label, autoFocus, onComplete }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 4 }, (_, i) => value[i] ?? "");

  function set(next: string) {
    const v = next.replace(/\D/g, "").slice(0, 4);
    onChange(v);
    if (v.length === 4) onComplete?.();
    return v;
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`${label}, digit ${i + 1} of 4`}
          aria-invalid={invalid}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            const next = set(value.slice(0, i) + ch + value.slice(i + 1));
            if (ch && i < 3 && next.length > i) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              set(value.slice(0, i - 1) + value.slice(i));
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 3) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const v = set(e.clipboardData.getData("text"));
            refs.current[Math.min(v.length, 3)]?.focus();
          }}
          className={cn(
            "size-11 shrink-0 rounded-lg border bg-surface text-center text-lg font-semibold text-primary shadow-soft transition",
            "focus-visible:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#2563EB]/40 disabled:opacity-60",
            invalid ? "border-danger" : d ? "border-[#2563EB]/60" : "border-border",
          )}
        />
      ))}
    </div>
  );
}
