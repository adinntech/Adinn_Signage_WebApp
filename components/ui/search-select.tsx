"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchOption {
  value: string;
  label: string;
  sublabel?: string;
}

/** Searchable combobox: type to filter (the caller fetches), arrow keys to move, Enter to pick, Esc to close. */
export function SearchSelect({
  id,
  value,
  options,
  query,
  onQueryChange,
  onSelect,
  loading,
  placeholder = "Search...",
  emptyText = "No matches",
  invalid,
  onClear,
  inputClassName,
  action,
  disabled,
}: {
  id: string;
  value: SearchOption | null;
  options: SearchOption[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (o: SearchOption) => void;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  invalid?: boolean;
  /** Shows a clear (×) button while a value is selected (for optional fields). */
  onClear?: () => void;
  inputClassName?: string;
  /** Pinned last row of the list (e.g. "Add Industry"); reachable with the arrow keys like an option. */
  action?: { label: string; onSelect: () => void };
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const listId = `${id}-list`;
  const total = options.length + (action ? 1 : 0);
  const onAction = action && active === options.length;

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (o: SearchOption) => {
    onSelect(o);
    setOpen(false);
  };
  const runAction = () => {
    setOpen(false);
    action?.onSelect();
  };

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open ? (options[active] ? `${id}-opt-${active}` : onAction ? `${id}-action` : undefined) : undefined}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : (value?.label ?? query)}
        placeholder={value ? value.label : placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, total - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && options[active]) {
            e.preventDefault();
            pick(options[active]!);
          } else if (e.key === "Enter" && open && onAction) {
            e.preventDefault();
            runAction();
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={cn(
          "flex h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-sm shadow-soft placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-[invalid=true]:border-danger",
          onClear && value && "pr-16",
          inputClassName,
        )}
      />
      {onClear && value && (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => {
            onClear();
            onQueryChange("");
          }}
          className="absolute right-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      {loading ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      )}
      {open && !disabled && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-card">
          {options.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">{loading ? "Searching..." : emptyText}</li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={value?.value === o.value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn("flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm", i === active && "bg-muted")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.label}</span>
                  {o.sublabel && <span className="block truncate text-xs text-muted-foreground">{o.sublabel}</span>}
                </span>
                {value?.value === o.value && <Check className="size-4 text-brand" aria-hidden />}
              </li>
            ))
          )}
          {action && (
            <li
              id={`${id}-action`}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(options.length)}
              onClick={runAction}
              className={cn(
                "sticky -bottom-1 -mx-1 -mb-1 mt-1 flex cursor-pointer items-center gap-2 border-t border-border bg-surface px-4 py-2.5 text-sm font-semibold text-brand",
                onAction && "bg-brand-soft",
              )}
            >
              <Plus className="size-4" aria-hidden /> {action.label}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
