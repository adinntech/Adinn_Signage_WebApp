"use client";

import { useState } from "react";
import { Download, Eye, GitCompare, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import {
  downloadShopVersion,
  useShopVersion,
  useShopVersionCompare,
  useShopVersions,
  type HandoverType,
  type ShopDiffStatus,
  type ShopVersionItem,
  type ShopVersionKind,
} from "@/lib/api/sales";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE = 50;
const KIND_LABEL: Record<ShopVersionKind, string> = {
  LEGACY: "Existing data",
  UPLOAD: "Excel upload",
  ADD: "Shop added",
  EDIT: "Shop edited",
  DELETE: "Shop deleted",
  CLEAR: "Cleared (Clear All)",
};
const STATUS: Record<ShopVersionItem["status"], { label: string; className: string }> = {
  CURRENT: { label: "Current", className: "bg-success-soft text-success" },
  PREVIOUS: { label: "Previous", className: "bg-muted text-muted-foreground" },
  FIRST: { label: "First Upload", className: "bg-brand-soft text-brand" },
};
const DIFF: Record<ShopDiffStatus, { label: string; row: string; chip: string }> = {
  ADDED: { label: "Added", row: "bg-success-soft/50", chip: "bg-success-soft text-success" },
  REMOVED: { label: "Removed", row: "bg-danger-soft/50 text-muted-foreground line-through", chip: "bg-danger-soft text-danger" },
  MODIFIED: { label: "Modified", row: "bg-warning-soft/40", chip: "bg-warning-soft text-warning" },
  UNCHANGED: { label: "Unchanged", row: "", chip: "bg-muted text-muted-foreground" },
};
const pageMeta = (page: number, total: number) => ({ page, limit: PAGE, total, totalPages: Math.max(1, Math.ceil(total / PAGE)) });

/**
 * Shop list version history (Assign Type & Details > History): every saved version of the current assign type,
 * newest first, with View (the exact saved table), Download (Excel of that version) and Compare (with the version
 * before it). Read-only: a version is never restored over the current table.
 */
export function ShopVersionsDialog({ orderId, type, onClose, onChangeLog }: { orderId: string; type: HandoverType; onClose: () => void; onChangeLog?: () => void }) {
  const toast = useToast();
  const q = useShopVersions(orderId, type);
  const [view, setView] = useState<number | null>(null);
  const [compare, setCompare] = useState<number | null>(null);
  const download = (v: number) => void downloadShopVersion(orderId, v).catch((e) => toast(errorMessage(e), "error"));
  return (
    <>
      <Modal
        open
        onOpenChange={(o) => !o && onClose()}
        title="Shop List Version History"
        description="Every saved version of this shop list, newest first. Versions are kept permanently; Clear All saves an empty version."
        className="max-w-[min(96vw,1200px)] max-h-[90dvh]"
        titleClassName="text-lg"
        footer={
          <>
            {onChangeLog && (
              <Button variant="outline" onClick={onChangeLog}>
                <History className="size-4" aria-hidden /> Change Log
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        {q.isPending ? (
          <RowsSkeleton rows={5} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data.length ? (
          <EmptyState icon={History} title="No versions yet" description="The first Excel upload (or the first saved change) is saved as V1." />
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Version</th>
                  <th className="px-3 py-2.5">Excel File</th>
                  <th className="px-3 py-2.5">Saved At</th>
                  <th className="px-3 py-2.5">By</th>
                  <th className="px-3 py-2.5 text-right">Shops</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Changes</th>
                  {/* Sticky: on a narrower screen the table scrolls sideways and the actions stay in view. */}
                  <th className="sticky right-0 bg-muted px-3 py-2.5 text-right shadow-[-6px_0_6px_-6px_rgb(0_0_0/0.15)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data.map((v) => (
                  <tr key={v.version} className={cn(v.status === "CURRENT" && "bg-brand-soft/30")}>
                    <td className="px-3 py-2.5 font-semibold text-navy">V{v.version}</td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium" title={v.fileName ?? undefined}>
                        {v.fileName ?? "-"}
                      </span>
                      <span className="block text-xs text-muted-foreground">{KIND_LABEL[v.kind]}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatDateTimeIST(v.at)}</td>
                    <td className="px-3 py-2.5">{v.by?.name || "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{v.total}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS[v.status].className)}>{STATUS[v.status].label}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {v.kind === "LEGACY" ? (
                        <span className="text-muted-foreground">Data saved before version history</span>
                      ) : (
                        <>
                          <span className="font-semibold text-success">{v.summary.added} added</span> · <span className="font-semibold text-warning">{v.summary.modified} modified</span> ·{" "}
                          <span className="font-semibold text-danger">{v.summary.removed} removed</span>
                        </>
                      )}
                    </td>
                    <td className={cn("sticky right-0 px-3 py-2.5 shadow-[-6px_0_6px_-6px_rgb(0_0_0/0.15)]", v.status === "CURRENT" ? "bg-[color-mix(in_oklab,var(--color-brand-soft)_30%,var(--color-surface))]" : "bg-surface")}>
                      <div className="flex justify-end gap-1 whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => setView(v.version)} aria-label={`View V${v.version}`}>
                          <Eye className="size-4" aria-hidden /> View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => download(v.version)} aria-label={`Download V${v.version}`}>
                          <Download className="size-4" aria-hidden /> Download
                        </Button>
                        {v.hasPrevious && (
                          <Button variant="ghost" size="sm" onClick={() => setCompare(v.version)} aria-label={`Compare V${v.version} with the previous version`}>
                            <GitCompare className="size-4" aria-hidden /> Compare
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
      {view && <VersionViewDialog orderId={orderId} type={type} version={view} onClose={() => setView(null)} onDownload={() => download(view)} />}
      {compare && <VersionCompareDialog orderId={orderId} type={type} version={compare} onClose={() => setCompare(null)} />}
    </>
  );
}

/** One version exactly as saved: S.No and every column and row (read-only, paged). */
function VersionViewDialog({ orderId, type, version, onClose, onDownload }: { orderId: string; type: HandoverType; version: number; onClose: () => void; onDownload: () => void }) {
  const q = useShopVersion(orderId, type, version);
  const [page, setPage] = useState(1);
  const rows = q.data?.rows ?? [];
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Shop List · V${version}`}
      description={q.data ? `${q.data.fileName ?? KIND_LABEL[q.data.kind]} · ${formatDateTimeIST(q.data.at)} · ${q.data.total} shop${q.data.total === 1 ? "" : "s"} · read-only` : undefined}
      className="max-w-[min(96vw,1400px)] max-h-[90dvh]"
      footer={
        <>
          <Button variant="outline" onClick={onDownload}>
            <Download className="size-4" aria-hidden /> Download Excel
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {q.isPending ? (
        <RowsSkeleton rows={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !rows.length ? (
        <EmptyState title="No shops in this version" description="This version was saved with an empty shop list (Clear All)." />
      ) : (
        <div className="space-y-3">
          <div className="max-h-[60dvh] overflow-auto rounded-lg border border-border">
            <table className="w-max min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">S.No</th>
                  {q.data.columns.map((c) => (
                    <th key={c.id} className="max-w-72 px-3 py-2">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((r, i) => (
                  <tr key={r.rowId}>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{(page - 1) * PAGE + i + 1}</td>
                    {q.data.columns.map((c) => (
                      <td key={c.id} className="max-w-72 whitespace-pre-wrap break-words px-3 py-2">
                        {r.cells[c.id] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={pageMeta(page, rows.length)} onPage={setPage} />
        </div>
      )}
    </Modal>
  );
}

/** The version against the one before it: rows matched by Row ID; changed cells show the old and the new value. */
function VersionCompareDialog({ orderId, type, version, onClose }: { orderId: string; type: HandoverType; version: number; onClose: () => void }) {
  const q = useShopVersionCompare(orderId, type, version);
  const [filter, setFilter] = useState<ShopDiffStatus | "">("");
  const [page, setPage] = useState(1);
  const all = q.data?.rows ?? [];
  const rows = filter ? all.filter((r) => r.status === filter) : all;
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const counts = q.data?.counts;
  const chips: { key: ShopDiffStatus | ""; label: string; n: number; className: string }[] = counts
    ? [
        { key: "", label: "All", n: all.length, className: "bg-muted text-foreground" },
        { key: "ADDED", label: "Added", n: counts.added, className: DIFF.ADDED.chip },
        { key: "REMOVED", label: "Removed", n: counts.removed, className: DIFF.REMOVED.chip },
        { key: "MODIFIED", label: "Modified", n: counts.modified, className: DIFF.MODIFIED.chip },
        { key: "UNCHANGED", label: "Unchanged", n: counts.unchanged, className: DIFF.UNCHANGED.chip },
      ]
    : [];
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={q.data ? `Compare V${q.data.from} → V${q.data.to}` : `Compare V${version}`}
      description="Rows are matched by their internal Row ID. Changed cells show the old value (struck through) and the new value."
      className="max-w-[min(96vw,1400px)] max-h-[90dvh]"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {q.isPending ? (
        <RowsSkeleton rows={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rows">
            {chips.map((c) => (
              <button
                key={c.key || "all"}
                type="button"
                onClick={() => {
                  setFilter(c.key);
                  setPage(1);
                }}
                aria-pressed={filter === c.key}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-offset-1 transition", c.className, filter === c.key ? "ring-2 ring-royal" : "opacity-80 hover:opacity-100")}
              >
                {c.label} · {c.n}
              </button>
            ))}
          </div>
          {!rows.length ? (
            <EmptyState title={all.length ? "No rows in this filter" : "Both versions are empty"} description={all.length ? "Choose another filter." : "Neither version has shops."} />
          ) : (
            <>
              <div className="max-h-[58dvh] overflow-auto rounded-lg border border-border">
                <table className="w-max min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">S.No</th>
                      <th className="px-3 py-2">Change</th>
                      {q.data.columns.map((c) => (
                        <th key={c.id} className="max-w-72 px-3 py-2">
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shown.map((r, i) => (
                      <tr key={`${r.status}-${r.rowId}`} className={DIFF[r.status].row}>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground no-underline">{(page - 1) * PAGE + i + 1}</td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold no-underline", DIFF[r.status].chip)}>{DIFF[r.status].label}</span>
                        </td>
                        {q.data.columns.map((c) => {
                          const changed = r.changed.includes(c.id);
                          return (
                            <td key={c.id} className={cn("max-w-72 whitespace-pre-wrap break-words px-3 py-2", changed && "bg-warning-soft")}>
                              {changed ? (
                                <>
                                  <span className="block text-danger line-through">{r.before?.[c.id] || "(blank)"}</span>
                                  <span className="block font-semibold text-success">{r.cells[c.id] || "(blank)"}</span>
                                </>
                              ) : (
                                (r.cells[c.id] ?? "")
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={pageMeta(page, rows.length)} onPage={setPage} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
