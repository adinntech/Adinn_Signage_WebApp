"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SITE_COLUMNS, type Site } from "@/lib/api/sites";
import { cn } from "@/lib/utils";
import { EditableCell } from "./editable-cell";
import { cellWarning, displayValue, EDITABLE, editValue } from "./site-utils";

const COL = Object.fromEntries(SITE_COLUMNS.map((c) => [c.key, c]));
const SELECT_W = 44;
const CODE_W = COL.siteCode!.width;
const SHOP_W = COL.shopName!.width;
const ACTION_W = 52;

const sortField = (key: string) => (key === "siteCode" ? "seq" : key);

interface RowProps {
  site: Site;
  cols: string[];
  selected: boolean;
  editingKey: string | null;
  canWrite: boolean;
  onToggle: (id: string, shift: boolean) => void;
  onStart: (id: string, key: string) => void;
  onSave: (id: string, key: string, value: string) => Promise<void>;
  onClose: (id: string, key: string, move?: 1 | -1) => void;
  onOpen: (s: Site) => void;
  onDuplicate: (s: Site) => void;
  onDelete: (s: Site) => void;
}

const SiteRow = React.memo(function SiteRow(p: RowProps) {
  const { site, selected } = p;
  const bg = selected ? "bg-secondary" : "bg-surface group-hover:bg-muted";
  const td = "px-2 py-1.5 align-top";
  const cell = (key: string) => {
    const warn = cellWarning(site, key);
    const kind = EDITABLE[key];
    return (
      <EditableCell
        fieldKey={key}
        label={COL[key]?.label ?? key}
        kind={kind ?? "text"}
        value={editValue(site, key)}
        display={key === "status" ? <Badge>{displayValue(site, key)}</Badge> : displayValue(site, key)}
        editing={p.editingKey === key}
        canEdit={p.canWrite && !!kind}
        issue={warn ? { level: "warning", message: warn } : undefined}
        align={COL[key]?.align}
        onStart={() => p.onStart(site._id, key)}
        onSave={(v) => p.onSave(site._id, key, v)}
        onClose={(m) => p.onClose(site._id, key, m)}
      />
    );
  };
  return (
    <tr className="group border-b border-border">
      <td className={cn(td, "sticky left-0 z-10 text-center", bg)} style={{ width: SELECT_W }}>
        <input
          type="checkbox"
          aria-label={`Select ${site.siteCode}`}
          checked={selected}
          onChange={() => undefined}
          onClick={(e) => p.onToggle(site._id, e.shiftKey)}
          className="size-4 cursor-pointer accent-primary"
        />
      </td>
      <td className={cn(td, "sticky z-10 font-mono text-xs", bg)} style={{ left: SELECT_W }}>
        <button type="button" onClick={() => p.onOpen(site)} className="truncate font-medium text-primary hover:underline">
          {site.siteCode}
        </button>
      </td>
      <td
        className={cn(td, "sticky z-10 border-r border-border font-medium shadow-[2px_0_4px_-2px_rgb(11_42_91/0.12)]", bg)}
        style={{ left: SELECT_W + CODE_W }}
      >
        {cell("shopName")}
      </td>
      {p.cols.map((k) => (
        <td key={k} className={cn(td, bg)}>
          {cell(k)}
        </td>
      ))}
      <td className={cn("sticky right-0 z-10 px-1 py-1.5 text-center align-top", bg)} style={{ width: ACTION_W }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${site.siteCode}`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onSelect={() => p.onOpen(site)}>
              <Pencil className="size-4" aria-hidden /> {p.canWrite ? "Edit" : "View details"}
            </DropdownMenuItem>
            {p.canWrite && (
              <>
                <DropdownMenuItem onSelect={() => p.onDuplicate(site)}>
                  <Copy className="size-4" aria-hidden /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => p.onDelete(site)} className="text-danger">
                  <Trash2 className="size-4" aria-hidden /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
});

export function SitesTable({
  rows,
  visible,
  sort,
  onSort,
  selected,
  onToggle,
  onToggleAll,
  canWrite,
  onSaveCell,
  onOpen,
  onDuplicate,
  onDelete,
  dimmed,
}: {
  rows: Site[];
  /** Visible optional column keys (Site ID and Shop are always pinned). */
  visible: string[];
  sort: string;
  onSort: (field: string) => void;
  selected: Set<string>;
  onToggle: (id: string, shift: boolean) => void;
  onToggleAll: () => void;
  canWrite: boolean;
  onSaveCell: (id: string, key: string, value: string) => Promise<void>;
  onOpen: (s: Site) => void;
  onDuplicate: (s: Site) => void;
  onDelete: (s: Site) => void;
  dimmed?: boolean;
}) {
  const cols = React.useMemo(
    () => SITE_COLUMNS.map((c) => c.key).filter((k) => k !== "siteCode" && k !== "shopName" && visible.includes(k)),
    [visible],
  );
  const editable = React.useMemo(() => ["shopName", ...cols.filter((k) => EDITABLE[k])], [cols]);
  const [editing, setEditing] = React.useState<{ id: string; key: string } | null>(null);

  const start = React.useCallback((id: string, key: string) => setEditing({ id, key }), []);
  const close = React.useCallback(
    (id: string, key: string, move?: 1 | -1) =>
      setEditing((cur) => {
        // Ignore stale closes (e.g. an earlier cell finishing a save after another one was opened).
        if (!cur || cur.id !== id || cur.key !== key) return cur;
        if (!move) return null;
        const next = editable[editable.indexOf(key) + move];
        return next ? { id, key: next } : null;
      }),
    [editable],
  );

  const total = SELECT_W + CODE_W + SHOP_W + ACTION_W + cols.reduce((n, k) => n + (COL[k]?.width ?? 120), 0);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const someSelected = !allSelected && rows.some((r) => selected.has(r._id));
  const cur = sort.replace(/^-/, "");

  const header = (key: string, extra?: string) => {
    const c = COL[key]!;
    const active = c.sortable && cur === sortField(key);
    return (
      <th
        key={key}
        scope="col"
        aria-sort={active ? (sort.startsWith("-") ? "descending" : "ascending") : undefined}
        className={cn("px-2 py-2.5 font-medium", c.align === "right" && "text-right", extra)}
      >
        {c.sortable ? (
          <button
            type="button"
            onClick={() => onSort(sortField(key))}
            className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")}
          >
            {c.label}
            {active && (sort.startsWith("-") ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
          </button>
        ) : (
          c.label
        )}
      </th>
    );
  };

  return (
    <table
      className={cn("table-fixed border-separate border-spacing-0 text-left text-sm transition-opacity", dimmed && "opacity-60")}
      style={{ width: total, minWidth: "100%" }}
    >
      <colgroup>
        <col style={{ width: SELECT_W }} />
        <col style={{ width: CODE_W }} />
        <col style={{ width: SHOP_W }} />
        {cols.map((k) => (
          <col key={k} style={{ width: COL[k]?.width }} />
        ))}
        <col style={{ width: ACTION_W }} />
      </colgroup>
      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
        <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:border-b [&>th]:border-border [&>th]:bg-muted">
          <th scope="col" className="left-0 z-30 px-2 text-center" style={{ left: 0, zIndex: 30 }}>
            <input
              type="checkbox"
              aria-label="Select all rows on this page"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={onToggleAll}
              className="size-4 cursor-pointer accent-primary"
            />
          </th>
          <th
            scope="col"
            className="px-2 py-2.5 font-medium"
            style={{ left: SELECT_W, zIndex: 30 }}
            aria-sort={cur === "seq" ? (sort.startsWith("-") ? "descending" : "ascending") : undefined}
          >
            <button
              type="button"
              onClick={() => onSort("seq")}
              className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", cur === "seq" && "text-foreground")}
            >
              Site ID
              {cur === "seq" && (sort.startsWith("-") ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
            </button>
          </th>
          <th
            scope="col"
            className="px-2 py-2.5 font-medium"
            style={{ left: SELECT_W + CODE_W, zIndex: 30 }}
            aria-sort={cur === "shopName" ? (sort.startsWith("-") ? "descending" : "ascending") : undefined}
          >
            <button
              type="button"
              onClick={() => onSort("shopName")}
              className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", cur === "shopName" && "text-foreground")}
            >
              Shop
              {cur === "shopName" && (sort.startsWith("-") ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
            </button>
          </th>
          {cols.map((k) => header(k))}
          <th scope="col" className="px-1" style={{ right: 0, zIndex: 30 }}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <SiteRow
            key={s._id}
            site={s}
            cols={cols}
            selected={selected.has(s._id)}
            editingKey={editing?.id === s._id ? editing.key : null}
            canWrite={canWrite}
            onToggle={onToggle}
            onStart={start}
            onSave={onSaveCell}
            onClose={close}
            onOpen={onOpen}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        ))}
      </tbody>
    </table>
  );
}
