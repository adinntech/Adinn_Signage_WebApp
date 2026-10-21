import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SortState<K extends string> {
  key: K;
  dir: "asc" | "desc";
}

/** Sortable <th> used by the dashboard tables. */
export function SortHeader<K extends string>({
  col,
  label,
  sort,
  onSort,
  className,
}: {
  col: K;
  label: string;
  sort: SortState<K>;
  onSort: (k: K) => void;
  className?: string;
}) {
  const on = sort.key === col;
  const Icon = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-4 py-3 text-left font-semibold", className)}>
      <button type="button" onClick={() => onSort(col)} className="inline-flex items-center gap-1 uppercase hover:text-royal">
        {label}
        <Icon className={cn("size-3", !on && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

export const nextSort = <K extends string>(s: SortState<K>, key: K): SortState<K> =>
  s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
