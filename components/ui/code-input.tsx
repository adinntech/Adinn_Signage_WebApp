"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  id?: string;
};

/**
 * One-time code entry: one box per digit, digits only. Typing moves to the next box, Backspace to the previous,
 * pasting a whole code fills every box. A "Paste" shortcut reads the clipboard where the browser allows it.
 */
export function CodeInput({ value, onChange, length = 6, disabled, invalid, autoFocus, id }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const reduce = useReducedMotion();
  const [pasted, setPasted] = useState(false);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const clean = (s: string) => s.replace(/\D/g, "").slice(0, length);
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  function setAt(i: number, raw: string) {
    const d = clean(raw);
    if (!d) return;
    const next = digits.slice();
    // A multi-digit input (paste, autofill) spreads over the following boxes.
    d.split("").forEach((ch, k) => { if (i + k < length) next[i + k] = ch; });
    onChange(next.join("").slice(0, length));
    focusAt(i + d.length);
  }

  async function pasteFromClipboard() {
    try {
      const text = clean(await navigator.clipboard.readText());
      if (!text) return;
      onChange(text);
      focusAt(text.length);
      setPasted(true);
      setTimeout(() => setPasted(false), 1800);
    } catch {
      focusAt(value.length);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2" role="group" aria-label={`${length}-digit verification code`}>
        {digits.map((d, i) => (
          <motion.input
            key={i}
            id={i === 0 ? id : undefined}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid}
            maxLength={length}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, scale: d ? [1, 1.12, 1] : 1 }}
            transition={{ duration: 0.22, delay: reduce ? 0 : i * 0.04 }}
            className={`h-12 w-full min-w-0 max-w-12 rounded-lg border bg-white text-center font-mono text-xl font-semibold text-[#102449] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/25 disabled:opacity-60 2xl:h-14 2xl:text-2xl ${invalid ? "border-danger" : "border-[#d6e4fa]"}`}
            onChange={(e) => setAt(i, e.target.value)}
            onFocus={(e) => e.target.select()}
            onPaste={(e) => { e.preventDefault(); setAt(i, e.clipboardData.getData("text")); }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                const next = digits.slice();
                if (next[i]) next[i] = ""; else if (i > 0) { next[i - 1] = ""; focusAt(i - 1); }
                onChange(next.join(""));
              } else if (e.key === "ArrowLeft") focusAt(i - 1);
              else if (e.key === "ArrowRight") focusAt(i + 1);
            }}
          />
        ))}
      </div>
      <button type="button" disabled={disabled} onClick={() => void pasteFromClipboard()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline disabled:opacity-60">
        {pasted ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {pasted ? "Pasted" : "Paste code"}
      </button>
    </div>
  );
}
