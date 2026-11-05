"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar, roleLabel } from "@/components/connect/format";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { usePeople } from "@/lib/api/connect";
import { cn } from "@/lib/utils";

/** Search the people who can be added to a conversation. `single` picks exactly one (direct message). */
export function PeoplePicker({ selected, onChange, single, exclude = [] }: { selected: string[]; onChange: (ids: string[]) => void; single?: boolean; exclude?: string[] }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const list = usePeople(dq);
  const rows = (list.data ?? []).filter((p) => !exclude.includes(p.id));
  const toggle = (id: string) => onChange(single ? [id] : selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search people" placeholder="Search by name" className="pl-9" maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="max-h-60 divide-y divide-border overflow-auto rounded-lg border border-border">
        {list.isPending && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Loading...</li>}
        {!list.isPending && rows.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No one found.</li>}
        {rows.map((p) => {
          const on = selected.includes(p.id);
          return (
            <li key={p.id}>
              <button type="button" onClick={() => toggle(p.id)} aria-pressed={on} className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60", on && "bg-brand-soft")}>
                <Avatar name={p.name} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{roleLabel(p.role)}</span>
                </span>
                <span className={cn("size-4 rounded border", on ? "border-royal bg-royal" : "border-border")} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
