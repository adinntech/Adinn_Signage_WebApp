"use client";

import { useState } from "react";

/**
 * Unsaved values of a workflow step, kept in memory while the user moves between the steps of one drawer (Previous /
 * Continue), so going back and forth never loses what was typed. Cleared when the step is saved; gone on page reload.
 */
const drafts = new Map<string, unknown>();

export const readStepDraft = <T,>(key: string) => drafts.get(key) as T | undefined;
export const writeStepDraft = (key: string, value: unknown) => void drafts.set(key, value);
/** Clears one key, or every key starting with `prefix:` (a whole step). */
export const clearStepDraft = (prefix: string) => {
  for (const k of [...drafts.keys()]) if (k === prefix || k.startsWith(`${prefix}:`)) drafts.delete(k);
};

/** useState that is kept while the step is closed and opened again (same key). A null key is plain state. */
export function useStepDraft<T>(key: string | null, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => (key && drafts.has(key) ? (drafts.get(key) as T) : typeof initial === "function" ? (initial as () => T)() : initial));
  const set = (next: T | ((prev: T) => T)) =>
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (key) drafts.set(key, v);
      return v;
    });
  return [value, set] as const;
}
