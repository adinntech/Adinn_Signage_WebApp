"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** From / To dates (YYYY-MM-DD, India dates). Empty string = not set. */
export interface DateRange {
  from: string;
  to: string;
}
export const EMPTY_RANGE: DateRange = { from: "", to: "" };

/** From after To: the range is not applied (the filter shows the error). */
export const rangeError = (r: DateRange) => (r.from && r.to && r.from > r.to ? "From date must be on or before the To date" : undefined);
/** The range as list query values, only when it is valid. */
export const rangeParams = (r: DateRange) => (rangeError(r) ? { from: undefined, to: undefined } : { from: r.from || undefined, to: r.to || undefined });

/** How many dates are set over the given ranges (the More Filters count). */
export const datesSet = (...ranges: DateRange[]) => ranges.reduce((n, r) => n + (r.from ? 1 : 0) + (r.to ? 1 : 0), 0);

const PANEL_ID = "list-date-filters";

/** "More Filters" toggle of a list toolbar: chevron for open / closed, and how many dates are applied. */
export function MoreFiltersButton({ open, count, onClick }: { open: boolean; count: number; onClick: () => void }) {
  return (
    <Button variant="outline" aria-expanded={open} aria-controls={PANEL_ID} onClick={onClick}>
      <SlidersHorizontal className="size-4" aria-hidden /> More Filters
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white" aria-label={`${count} date filter${count > 1 ? "s" : ""} applied`}>
          {count}
        </span>
      )}
      <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
    </Button>
  );
}

/**
 * Created At and Last Updated At ranges, shown under the toolbar while More Filters is open. Closing it only hides
 * them: the dates stay applied.
 */
export function DateFiltersPanel({ open, created, updated, onCreated, onUpdated }: { open: boolean; created: DateRange; updated: DateRange; onCreated: (r: DateRange) => void; onUpdated: (r: DateRange) => void }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div id={PANEL_ID} key="panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
          <div className="mt-3 grid gap-4 border-t border-border pt-3 md:grid-cols-2">
            <DateRangeFilter label="Created At" value={created} onChange={onCreated} />
            <DateRangeFilter label="Last Updated At" value={updated} onChange={onUpdated} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const openPicker = (e: { currentTarget: HTMLInputElement }) => {
  try {
    e.currentTarget.showPicker?.();
  } catch {}
};

/**
 * One date range of a list filter (e.g. Created At): From and To date inputs. A click anywhere in an input opens the
 * calendar; each date clears on its own (cross); To cannot be before From. The browser shows the date as DD-MM-YYYY
 * in an Indian locale.
 */
export function DateRangeFilter({ label, value, onChange }: { label: string; value: DateRange; onChange: (r: DateRange) => void }) {
  const error = rangeError(value);
  const field = (k: keyof DateRange, text: string) => (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">
        {label} {text}
      </span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" aria-hidden>
        {text}
      </span>
      <Input
        type="date"
        className="cursor-pointer pl-12 pr-8"
        value={value[k]}
        min={k === "to" ? value.from || undefined : undefined}
        max={k === "from" ? value.to || undefined : undefined}
        aria-invalid={k === "to" && !!error}
        onClick={openPicker}
        onChange={(e) => onChange({ ...value, [k]: e.target.value })}
      />
      {value[k] && (
        <button
          type="button"
          aria-label={`Clear ${label} ${text} date`}
          onClick={() => onChange({ ...value, [k]: "" })}
          className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </label>
  );
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <CalendarDays className="size-3.5 text-brand" aria-hidden /> {label}
      </legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        {field("from", "From")}
        {field("to", "To")}
      </div>
      {error && (
        <p className="mt-1 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
