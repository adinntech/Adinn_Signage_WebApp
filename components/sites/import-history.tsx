"use client";

import { History } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useImportHistory, type BatchStatus } from "@/lib/api/sites";
import { formatDateTime, formatNumber, label } from "@/lib/format";

const TONE: Record<BatchStatus, Tone> = {
  UPLOADED: "neutral",
  PREVIEWED: "info",
  COMMITTING: "warning",
  COMMITTED: "success",
  FAILED: "danger",
  DISCARDED: "neutral",
};

export function ImportHistory({
  projectId,
  onClose,
  onViewSites,
}: {
  projectId: string;
  onClose: () => void;
  onViewSites: (batchId: string) => void;
}) {
  const q = useImportHistory(projectId, true);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Import history" description="Excel and CSV imports for this project." className="max-w-4xl">
      {q.isPending ? (
        <RowsSkeleton rows={4} className="p-0" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon={History} title="No imports yet" description="Imported files will be listed here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["File", "Date", "By", "Status", "Rows", "Result", ""].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.data.map((b) => (
                <tr key={b._id}>
                  <td className="max-w-56 truncate px-2 py-2 font-medium" title={b.fileName}>
                    {b.fileName ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">{formatDateTime(b.committedAt ?? b.createdAt)}</td>
                  <td className="px-2 py-2">{b.createdBy?.name ?? "-"}</td>
                  <td className="px-2 py-2">
                    <Badge tone={TONE[b.status]}>{label(b.status)}</Badge>
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatNumber(b.totalRows)}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {b.result
                      ? `${b.result.created} created, ${b.result.updated} updated, ${b.result.skippedRows} skipped, ${b.result.errorRows} with errors`
                      : "Not imported"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {b.status === "COMMITTED" && (
                      <Button size="sm" variant="outline" onClick={() => onViewSites(b._id)}>
                        View sites
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
