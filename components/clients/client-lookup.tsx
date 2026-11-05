"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, TriangleAlert } from "lucide-react";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { useClients, clientTypeOf, type Client } from "@/lib/api/clients";
import { cn } from "@/lib/utils";

/** What matched, so the person sees why a company was suggested. */
function matchedOn(c: Client, q: string): string | null {
  const t = q.trim().toLowerCase();
  if (!t) return null;
  if (c.clientNo?.toLowerCase().includes(t)) return "Client ID";
  if (c.code?.toLowerCase().includes(t)) return "Client code";
  if (c.gstin?.toLowerCase().includes(t)) return "GST";
  if (c.onboarding?.pan?.toLowerCase().includes(t)) return "PAN";
  return null;
}

/** Companies sharing a GST number or PAN are likely duplicates of one another. */
export function duplicateKeys(items: Client[]): Set<string> {
  const seen = new Map<string, string>();
  const dup = new Set<string>();
  for (const c of items) {
    for (const key of [c.gstin && `gst:${c.gstin}`, c.onboarding?.pan && `pan:${c.onboarding.pan}`]) {
      if (!key) continue;
      const prev = seen.get(key);
      if (prev && prev !== c._id) {
        dup.add(prev);
        dup.add(c._id);
      }
      seen.set(key, c._id);
    }
  }
  return dup;
}

/**
 * Reusable client search. Looks up the client master by Client ID, client code, company name, GST number or PAN
 * (debounced), flags records that share a GST number or PAN, and hands the chosen verified client to the caller.
 * It only reads: nothing about a client is changed by picking it.
 */
export function ClientLookup({
  onSelect,
  placeholder = "Search by client ID, company name, GST number or PAN",
  autoFocus,
  className,
}: {
  onSelect: (client: Client) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim());
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const list = useClients({ q, limit: 8, status: "ACTIVE", sort: "name" }, q.length >= 2);
  const items = q.length >= 2 ? (list.data?.data ?? []) : [];
  const dups = duplicateKeys(items);
  const waiting = text.trim().length >= 2 && (text.trim() !== q || list.isFetching);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const choose = (c: Client) => {
    setOpen(false);
    setText("");
    onSelect(c);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Find client"
        autoFocus={autoFocus}
        maxLength={60}
        placeholder={placeholder}
        className="pl-9 pr-9"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && items[active]) {
            e.preventDefault();
            choose(items[active]);
          }
        }}
      />
      {waiting && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      {open && text.trim().length >= 2 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-80 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-card"
        >
          {!waiting && items.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No client matches “{q}”.</li>}
          {items.map((c, i) => {
            const why = matchedOn(c, q);
            return (
              <li key={c._id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                  className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left", i === active ? "bg-brand-soft" : "hover:bg-muted")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <ClientTypeBadge type={clientTypeOf(c)} />
                      {why && <span className="rounded bg-muted px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">{why}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.clientNo, c.gstin, c.onboarding?.pan, c.city].filter(Boolean).join(" · ")}
                    </span>
                    {dups.has(c._id) && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning">
                        <TriangleAlert className="size-3" aria-hidden /> Shares a GST number or PAN with another client
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
