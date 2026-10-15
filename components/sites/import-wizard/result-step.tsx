"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import type { ImportBatch } from "@/lib/api/sites";

export function ResultStep({
  batch,
  onView,
  onAnother,
}: {
  batch: ImportBatch;
  onView: () => void;
  onAnother: () => void;
}) {
  const r = batch.result ?? { created: 0, updated: 0, skippedRows: 0, errorRows: 0 };
  const items = [
    ["Created", r.created],
    ["Updated", r.updated],
    ["Skipped", r.skippedRows],
    ["Rows with errors (not imported)", r.errorRows],
  ] as const;
  return (
    <div className="mx-auto max-w-xl space-y-5 py-4 text-center">
      <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
      <div>
        <h3 className="text-lg font-semibold text-primary">Import complete</h3>
        <p className="text-sm text-muted-foreground">{batch.fileName}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-left">
        {items.map(([k, n]) => (
          <div key={k} className="rounded-lg border border-border px-4 py-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{formatNumber(n)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onView}>View sites</Button>
        <Button variant="outline" onClick={onAnother}>
          Import another
        </Button>
      </div>
    </div>
  );
}
