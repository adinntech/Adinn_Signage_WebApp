"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { load } from "@/components/upload/sheet-preview";

type Cell = string | number | boolean | Date | null | undefined;

// Header words that mean a measurement column (width, height, size, sq.ft ...).
const MEASURE_HEADER = /width|height|breadth|dimension|measure|sq\.?\s?ft|sqft|square|\bsize\b|\bw\s*[x×]\s*h\b/i;

export interface MeasurementResult { columns: string[]; filled: number; rows: number }

/** Looks at the header row (within the first 10 rows) for measurement columns and counts rows that have a value in them. */
export function analyseMeasurements(rows: Cell[][]): MeasurementResult {
  const text = (c: Cell) => (c === null || c === undefined ? "" : String(c).trim());
  const headerAt = rows.slice(0, 10).findIndex((r) => r.filter((c) => typeof c === "string" && text(c)).length >= 3);
  if (headerAt < 0) return { columns: [], filled: 0, rows: 0 };
  const header = rows[headerAt]!;
  const idx = header.map((c, i) => (MEASURE_HEADER.test(text(c)) ? i : -1)).filter((i) => i >= 0);
  const body = rows.slice(headerAt + 1).filter((r) => r.some((c) => text(c)));
  const filled = body.filter((r) => idx.some((i) => text(r[i]))).length;
  return { columns: idx.map((i) => text(header[i])), filled, rows: body.length };
}

/** Warns, before the shops are extracted, when a "Shop + measurement" project's Excel has no measurement details. */
export function MeasurementCheck({ fileId, name }: { fileId: string; name: string }) {
  const q = useQuery({
    queryKey: ["measurement-check", fileId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sheets = await load(fileId, name);
      const all = sheets.map((s) => analyseMeasurements(s.rows));
      return all.find((r) => r.filled > 0) ?? all.find((r) => r.columns.length > 0) ?? all[0] ?? { columns: [], filled: 0, rows: 0 };
    },
  });
  if (q.isPending) return <p role="status" className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking {name} for measurement details…</p>;
  if (q.isError) return <p role="alert" className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs"><AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden /> Could not check {name} for measurement details: {q.error instanceof Error ? q.error.message : "read failed"}. Open View to check it by eye.</p>;
  const r = q.data;
  if (r.filled > 0) {
    return <p className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs text-success"><CheckCircle2 className="size-4 shrink-0" aria-hidden /> Measurement details found ({r.columns.join(", ")}) for {r.filled} of {r.rows} rows.</p>;
  }
  return (
    <div role="alert" className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        <strong>This is a Shop + measurement project, but this Excel has no measurement details</strong>
        {r.columns.length > 0 ? ` (the ${r.columns.join(", ")} column is empty).` : " (no width, height or size column found)."}{" "}
        Open the preview to check it. Ask BD / Client Servicing for the right file, or extract the shops now and measure them at the recce.
      </p>
    </div>
  );
}
