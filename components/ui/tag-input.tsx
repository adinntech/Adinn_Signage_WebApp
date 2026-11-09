"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagOption {
  value: string;
  /** Shown before the value, e.g. the person's name. */
  label?: string | null;
  /** Small grey text after it, e.g. the group. */
  hint?: string | null;
}

/**
 * Enter or comma adds a tag; Backspace on empty input removes the last.
 * Give it `options` (what matches the typed text) and a Gmail-style list opens under the box: arrows move, Enter or a click picks.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  max = 200,
  disabled,
  invalid,
  onDraftChange,
  options,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
  invalid?: boolean;
  /** The text typed but not yet added as a tag (so a form can use it, e.g. Send without pressing Enter). */
  onDraftChange?: (draft: string) => void;
  /** Suggestions for the text typed so far. Already-added values are left out. */
  options?: TagOption[];
}) {
  const [draft, setDraftState] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const setDraft = (d: string) => {
    setDraftState(d);
    setActive(-1);
    onDraftChange?.(d);
  };
  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) {
      setDraft("");
      return;
    }
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next);
    setDraft("");
  };
  const shown = (options ?? []).filter((o) => !value.some((v) => v.toLowerCase() === o.value.toLowerCase())).slice(0, 8);
  const open = focused && !disabled && draft.trim() !== "" && shown.length > 0;
  const listId = `${id ?? "tags"}-options`;
  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 shadow-soft focus-within:outline-2 focus-within:outline-ring",
          invalid && "border-danger",
          disabled && "opacity-60",
        )}
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {t}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${t}`}
              onClick={() => onChange(value.filter((v) => v !== t))}
              className="rounded hover:text-danger"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          role={options ? "combobox" : undefined}
          aria-expanded={options ? open : undefined}
          aria-controls={options ? listId : undefined}
          aria-autocomplete={options ? "list" : undefined}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          value={draft}
          disabled={disabled}
          placeholder={value.length ? "" : placeholder}
          onFocus={() => setFocused(true)}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (open && e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % shown.length);
            } else if (open && e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? shown.length - 1 : a - 1));
            } else if (open && e.key === "Escape") {
              e.preventDefault();
              setFocused(false);
            } else if (e.key === "Enter") {
              e.preventDefault();
              add(open && active >= 0 ? shown[active]!.value : draft);
            } else if (e.key === "Tab" && open && active >= 0) {
              e.preventDefault();
              add(shown[active]!.value);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => {
            setFocused(false);
            add(draft);
          }}
          className="bare-field min-w-24 flex-1 bg-transparent px-1 text-sm placeholder:text-muted-foreground/70"
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-card"
        >
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so the box keeps focus: a blur would add the half-typed text first.
              onMouseDown={(e) => {
                e.preventDefault();
                add(o.value);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-sm", i === active ? "bg-secondary" : "hover:bg-secondary/60")}
            >
              {o.label && <span className="font-medium text-navy">{o.label}</span>}
              <span className={cn("truncate", o.label ? "text-muted-foreground" : "text-navy")}>{o.value}</span>
              {o.hint && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
