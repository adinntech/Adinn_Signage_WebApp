"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { EditableCell, type CellIssue } from "@/components/sites/editable-cell";
import { EDITABLE } from "@/components/sites/site-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import {
  commitImport,
  patchImportRow,
  useImportRows,
  type DuplicatePolicy,
  type ImportBatch,
  type ImportRow,
  type ImportSummary,
  type RowState,
} from "@/lib/api/sites";
import { cn } from "@/lib/utils";

const COLS: { key: string; label: string; width: number; align?: "right" }[] = [
  { key: "shopName", label: "Shop", width: 180 },
  { key: "dealerName", label: "Dealer", width: 160 },
  { key: "location", label: "Location", width: 130 },
  { key: "district", label: "District", width: 120 },
  { key: "address1", label: "Address", width: 180 },
  { key: "mobile", label: "Mobile", width: 120 },
  { key: "gstin", label: "GST No", width: 160 },
  { key: "width", label: "Width", width: 80, align: "right" },
  { key: "height", label: "Height", width: 80, align: "right" },
  { key: "unit", label: "Unit", width: 70 },
  { key: "quantity", label: "Qty", width: 70, align: "right" },
];
const EDIT_KEYS = COLS.map((c) => c.key);
const ISSUE_FIELDS: Record<string, string[]> = { size: ["width", "height"] };

function issueFor(row: ImportRow, key: string): CellIssue | undefined {
  const hit = (list: { field: string; message: string }[]) =>
    list.find((i) => i.field === key || ISSUE_FIELDS[i.field]?.includes(key));
  const e = hit(row.errors ?? []);
  if (e) return { level: "error", message: e.message };
  const w = hit(row.warnings ?? []);
  return w ? { level: "warning", message: w.message } : undefined;
}

const STATE_TONE = { VALID: "success", WARNING: "warning", ERROR: "danger" } as const;
const POLICY_TEXT: Record<DuplicatePolicy, string> = { skip: "skip duplicates", import: "import anyway", update: "update existing" };

export function ReviewStep({
  projectId,
  batch,
  summary,
  onSummary,
  policy,
  onBack,
  onCommitted,
}: {
  projectId: string;
  batch: ImportBatch;
  summary: ImportSummary;
  onSummary: (s: ImportSummary) => void;
  policy: DuplicatePolicy;
  onBack: () => void;
  onCommitted: (b: ImportBatch) => void;
}) {
  const qc = useQueryClient();
  const [state, setState] = React.useState<RowState | "">("");
  const [page, setPage] = React.useState(1);
  const rowsQ = useImportRows(projectId, batch._id, { state, page, limit: 50 });
  const rows = rowsQ.data?.data ?? [];
  const [editing, setEditing] = React.useState<{ id: string; key: string } | null>(null);
  const [committing, setCommitting] = React.useState(false);
  const commitLock = React.useRef(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["site-import", projectId, batch._id, "rows"] });

  async function save(row: ImportRow, key: string, value: string) {
    const res = await patchImportRow(projectId, batch._id, row._id, { mapped: { [key]: value } });
    onSummary(res.summary);
    await refresh();
  }

  async function toggleSkip(row: ImportRow) {
    setError(null);
    try {
      const res = await patchImportRow(projectId, batch._id, row._id, { skipped: !row.skipped });
      onSummary(res.summary);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // Estimate: the server decides the final numbers on commit.
  const importable = Math.max(0, summary.valid + summary.warning - summary.skipped - (policy === "skip" ? summary.duplicates : 0));

  async function commit() {
    if (commitLock.current || importable === 0) return;
    commitLock.current = true;
    setCommitting(true);
    setError(null);
    try {
      onCommitted(await commitImport(projectId, batch._id, policy));
    } catch (e) {
      setError(errorMessage(e));
      commitLock.current = false;
      setCommitting(false);
    }
  }

  const chips: { key: RowState | ""; label: string; n: number; tone: string; filter: boolean }[] = [
    { key: "", label: "Total", n: batch.totalRows, tone: "", filter: true },
    { key: "VALID", label: "Valid", n: summary.valid, tone: "text-success", filter: true },
    { key: "WARNING", label: "Warnings", n: summary.warning, tone: "text-warning", filter: true },
    { key: "ERROR", label: "Errors", n: summary.error, tone: "text-danger", filter: true },
    { key: "DUPLICATE", label: "Duplicates", n: summary.duplicates, tone: "", filter: true },
    { key: "", label: "Skipped", n: summary.skipped, tone: "", filter: false },
  ];

  const total = 64 + 70 + COLS.reduce((n, c) => n + c.width, 0) + 280 + 90;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rows by state">
        {chips.map((c) => {
          const active = c.filter && state === c.key;
          const cls = cn(
            "rounded-full border px-3 py-1 text-sm",
            active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface",
          );
          const body = (
            <>
              {c.label} <span className={cn("font-semibold tabular-nums", !active && c.tone)}>{formatNumber(c.n)}</span>
            </>
          );
          return c.filter ? (
            <button
              key={c.label}
              type="button"
              aria-pressed={active}
              className={cls}
              onClick={() => {
                setState(c.key);
                setPage(1);
              }}
            >
              {body}
            </button>
          ) : (
            <span key={c.label} className={cls}>
              {body}
            </span>
          );
        })}
      </div>

      <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm">
        <strong>Rows with errors are not imported</strong> unless you fix them here (click a cell to edit) or skip them. Warnings are
        imported. Duplicates follow your policy ({POLICY_TEXT[policy]}).
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border">
        {rowsQ.isPending ? (
          <RowsSkeleton rows={6} />
        ) : rowsQ.isError && !rowsQ.data ? (
          <ErrorState error={rowsQ.error} onRetry={() => rowsQ.refetch()} />
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No rows in this view.</p>
        ) : (
          <div className="max-h-[42vh] overflow-auto">
            <table
              className={cn("table-fixed border-separate border-spacing-0 text-left text-sm", rowsQ.isPlaceholderData && "opacity-60")}
              style={{ width: total, minWidth: "100%" }}
            >
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:border-b [&>th]:border-border [&>th]:bg-muted [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
                  <th style={{ width: 64, left: 0, zIndex: 30 }}>Row</th>
                  <th style={{ width: 70 }}>State</th>
                  {COLS.map((c) => (
                    <th key={c.key} style={{ width: c.width }} className={c.align === "right" ? "text-right" : ""}>
                      {c.label}
                    </th>
                  ))}
                  <th style={{ width: 280 }}>Issues</th>
                  <th style={{ width: 90 }}>Skip</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const bg = r.skipped ? "bg-muted text-muted-foreground" : "bg-surface group-hover:bg-muted";
                  const td = cn("px-2 py-1.5 align-top", bg);
                  const dupLabel =
                    r.dup?.type === "FILE"
                      ? `Duplicate of row ${r.dup.ref}`
                      : r.dup?.type === "EXISTING"
                        ? "Already in project"
                        : r.dup?.type === "DEALER"
                          ? "Same dealer"
                          : null;
                  return (
                    <tr key={r._id} className="group border-b border-border">
                      <td className={cn(td, "sticky left-0 z-10 font-mono text-xs")}>{r.rowNumber}</td>
                      <td className={td}>
                        <Badge tone={STATE_TONE[r.state]}>{r.state === "VALID" ? "OK" : r.state === "WARNING" ? "Warn" : "Error"}</Badge>
                      </td>
                      {COLS.map((c) => {
                        const v = (r.mapped as Record<string, unknown>)[c.key];
                        const val = v === undefined || v === null ? "" : String(v);
                        return (
                          <td key={c.key} className={td}>
                            <EditableCell
                              fieldKey={c.key}
                              label={c.label}
                              kind={EDITABLE[c.key] ?? "text"}
                              value={val}
                              display={val}
                              editing={editing?.id === r._id && editing.key === c.key}
                              canEdit={!r.skipped}
                              issue={issueFor(r, c.key)}
                              align={c.align}
                              onStart={() => setEditing({ id: r._id, key: c.key })}
                              onSave={(x) => save(r, c.key, x)}
                              onClose={(move) =>
                                setEditing((cur) => {
                                  if (!cur || cur.id !== r._id || cur.key !== c.key) return cur;
                                  const next = move ? EDIT_KEYS[EDIT_KEYS.indexOf(c.key) + move] : undefined;
                                  return next ? { id: r._id, key: next } : null;
                                })
                              }
                            />
                          </td>
                        );
                      })}
                      <td className={cn(td, "text-xs")}>
                        <ul className="space-y-0.5">
                          {r.errors?.map((e, i) => (
                            <li key={`e${i}`} className="text-danger">
                              <span className="font-medium">{e.field}:</span> {e.message}
                            </li>
                          ))}
                          {r.warnings?.map((w, i) => (
                            <li key={`w${i}`} className="text-warning">
                              <span className="font-medium">{w.field}:</span> {w.message}
                            </li>
                          ))}
                        </ul>
                        {dupLabel && (
                          <Badge tone="info" className="mt-1">
                            {dupLabel}
                          </Badge>
                        )}
                      </td>
                      <td className={td}>
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={r.skipped}
                            onChange={() => toggleSkip(r)}
                            aria-label={`Skip row ${r.rowNumber}`}
                          />
                          Skip
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!rowsQ.isError && rows.length > 0 && <Pagination meta={rowsQ.data?.meta} onPage={setPage} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={onBack} disabled={committing}>
          <ArrowLeft className="size-4" aria-hidden /> Back to mapping
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          {importable === 0 && <span className="text-sm text-muted-foreground">Nothing to import yet. Fix the errors or go back.</span>}
          <Button onClick={commit} loading={committing} disabled={importable === 0}>
            Import {formatNumber(importable)} sites
          </Button>
        </div>
      </div>
    </div>
  );
}
