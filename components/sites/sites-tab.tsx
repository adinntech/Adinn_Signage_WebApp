"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import type { Project } from "@/lib/api/projects";
import {
  downloadSites,
  downloadTemplate,
  SITE_COLUMNS,
  useDeleteSite,
  useDuplicateSite,
  useSiteStats,
  useSites,
  useUpdateSite,
  type Scenario,
  type Site,
  type SiteFilter,
  type SiteFields,
} from "@/lib/api/sites";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { BulkDeleteDialog, BulkEditDialog, type BulkTarget } from "./bulk-edit-dialog";
import { ImportHistory } from "./import-history";
import { ImportWizard } from "./import-wizard";
import { SiteFormDialog } from "./site-form-dialog";
import { SitesTable } from "./sites-table";
import { SitesStats, SitesToolbar, type FilterState } from "./sites-toolbar";

const COLUMNS_KEY = "sites.visibleColumns.v1";
const DEFAULT_VISIBLE = ["dealerName", "location", "district", "address1", "mobile", "gstin", "width", "height", "unit", "sqft", "scenario", "remarks"];
const ALL_KEYS = SITE_COLUMNS.map((c) => c.key);

function loadColumns(): string[] {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) return arr.filter((k): k is string => typeof k === "string" && ALL_KEYS.includes(k));
    }
  } catch {
    /* storage unavailable or corrupt: use defaults */
  }
  return DEFAULT_VISIBLE;
}

const NO_FILTER: FilterState = { district: "", scenario: "", missing: "", importBatchId: "" };

export function SitesTab({ project, readOnly }: { project: Project; readOnly?: boolean }) {
  const pid = project._id;
  const { can } = useAuth();
  const toast = useToast();
  const reduce = useReducedMotion();
  const canWrite = can("sites:write") && !readOnly;
  const defaultScenario: Scenario = project.requirement?.siteDataScenario ?? "MEASUREMENT_REQUIRED";

  const [q, setQ] = React.useState("");
  const dq = useDebounced(q.trim());
  const [filter, setFilterState] = React.useState<FilterState>(NO_FILTER);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [sort, setSort] = React.useState("seq");
  const [visible, setVisible] = React.useState<string[]>(loadColumns);

  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [allMatching, setAllMatching] = React.useState(false);
  const lastClicked = React.useRef<number | null>(null);

  const [adding, setAdding] = React.useState(false);
  const [detail, setDetail] = React.useState<Site | null>(null);
  const [deleting, setDeleting] = React.useState<Site | null>(null);
  const [wizard, setWizard] = React.useState(false);
  const [history, setHistory] = React.useState(false);
  const [bulkEdit, setBulkEdit] = React.useState<BulkTarget | null>(null);
  const [bulkDelete, setBulkDelete] = React.useState<BulkTarget | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const siteFilter: SiteFilter = {
    q: dq || undefined,
    district: filter.district || undefined,
    scenario: filter.scenario || undefined,
    missing: filter.missing || undefined,
    importBatchId: filter.importBatchId || undefined,
  };
  const hasFilters = !!(dq || filter.district || filter.scenario || filter.missing || filter.importBatchId);

  const list = useSites(pid, { ...siteFilter, page, limit, sort });
  const stats = useSiteStats(pid);
  const { mutateAsync: updateAsync } = useUpdateSite(pid);
  const del = useDeleteSite(pid);
  const dup = useDuplicateSite(pid);

  const rows = React.useMemo(() => list.data?.data ?? [], [list.data]);
  const meta = list.data?.meta;
  const rowsRef = React.useRef(rows);
  React.useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Page fell off the end (e.g. after deleting the last rows on it): step back.
  if (meta && page > meta.totalPages) setPage(meta.totalPages);

  const clearSelection = () => {
    setSelected(new Set());
    setAllMatching(false);
    lastClicked.current = null;
  };
  const resetView = () => {
    setPage(1);
    clearSelection();
  };
  const setFilter = (p: Partial<FilterState>) => {
    setFilterState((f) => ({ ...f, ...p }));
    resetView();
  };
  const onQ = (v: string) => {
    setQ(v);
    resetView();
  };
  const onSort = (field: string) => {
    setSort((s) => (s === field ? `-${field}` : field));
    resetView();
  };
  const toggleColumn = (key: string) =>
    setVisible((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      try {
        localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  const onToggle = React.useCallback((id: string, shift: boolean) => {
    setAllMatching(false);
    setSelected((cur) => {
      const list = rowsRef.current;
      const idx = list.findIndex((r) => r._id === id);
      const next = new Set(cur);
      if (shift && lastClicked.current !== null && idx >= 0) {
        const [a, b] = [Math.min(lastClicked.current, idx), Math.max(lastClicked.current, idx)];
        const on = !cur.has(id);
        for (let i = a; i <= b; i++) {
          const rid = list[i]?._id;
          if (!rid) continue;
          if (on) next.add(rid);
          else next.delete(rid);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      lastClicked.current = idx;
      return next;
    });
  }, []);
  const onToggleAll = () => {
    setAllMatching(false);
    lastClicked.current = null;
    setSelected(rows.length > 0 && rows.every((r) => selected.has(r._id)) ? new Set() : new Set(rows.map((r) => r._id)));
  };

  const onSaveCell = React.useCallback(
    async (id: string, key: string, value: string) => {
      await updateAsync({ id, patch: { [key]: value } as SiteFields });
    },
    [updateAsync],
  );

  const total = meta?.total ?? 0;
  const count = allMatching ? total : selected.size;
  const target = (): BulkTarget => (allMatching ? { filter: siteFilter, count } : { ids: [...selected], count });
  const pageAllSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));

  async function runExport(format: "xlsx" | "csv") {
    setExporting(true);
    try {
      const columns = ["siteCode", "shopName", ...SITE_COLUMNS.map((c) => c.key).filter((k) => k !== "siteCode" && k !== "shopName" && visible.includes(k))];
      await downloadSites(pid, {
        format,
        columns,
        sort,
        ...(selected.size > 0 && !allMatching ? { ids: [...selected] } : { filter: siteFilter }),
      });
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setExporting(false);
    }
  }
  async function runTemplate(s: Scenario) {
    try {
      await downloadTemplate(pid, s);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function runDuplicate(s: Site) {
    try {
      const copy = await dup.mutateAsync(s._id);
      toast(`Duplicated as ${copy.siteCode}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting._id);
      toast(`Deleted ${deleting.siteCode}`);
      setDeleting(null);
      clearSelection();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const importCta = canWrite ? (
    <div className="flex flex-wrap justify-center gap-2">
      <Button onClick={() => setWizard(true)}>
        <Upload className="size-4" aria-hidden /> Import Excel
      </Button>
      <Button variant="outline" onClick={() => setAdding(true)}>
        <Plus className="size-4" aria-hidden /> Add site
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="min-w-0 max-w-full space-y-3">
      <SitesStats stats={stats.data} missing={filter.missing} onMissing={(m) => setFilter({ missing: m })} />
      <SitesToolbar
        q={q}
        onQ={onQ}
        filter={filter}
        onFilter={setFilter}
        stats={stats.data}
        visible={visible}
        onToggleColumn={toggleColumn}
        canWrite={canWrite}
        onImport={() => setWizard(true)}
        onAdd={() => setAdding(true)}
        onHistory={() => setHistory(true)}
        onExport={runExport}
        onTemplate={runTemplate}
        exporting={exporting}
        exportLabel={count > 0 && !allMatching ? `Export ${formatNumber(count)} selected rows` : "Export current view (filters, columns, sort)"}
        hasBatchFilter={!!filter.importBatchId}
      />

      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.div
            key="bulk"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-secondary px-3 py-2 text-sm" role="region" aria-label="Bulk actions">
              <span className="font-medium">{formatNumber(count)} selected</span>
              {canWrite && (
                <Button size="sm" variant="outline" onClick={() => setBulkEdit(target())}>
                  Bulk edit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => runExport("xlsx")} loading={exporting}>
                Export {allMatching ? "all matching" : "selected"}
              </Button>
              {canWrite && (
                <Button size="sm" variant="outline" className="text-danger" onClick={() => setBulkDelete(target())}>
                  <Trash2 className="size-4" aria-hidden /> Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
                <X className="size-4" aria-hidden /> Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        {list.isPending ? (
          <RowsSkeleton rows={8} />
        ) : list.isError && !list.data ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={MapPin}
              title="No sites match your filters"
              description="Try clearing a filter or the search."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setFilter(NO_FILTER);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={MapPin}
              title="No sites yet"
              description={
                canWrite
                  ? "Import the client's Excel sheet or add a site manually."
                  : "Sites will appear here once they are imported."
              }
              action={importCta}
            />
          )
        ) : (
          <>
            {selected.size > 0 && pageAllSelected && total > rows.length && (
              <div className="border-b border-border bg-secondary px-4 py-2 text-center text-sm">
                {allMatching ? (
                  <>
                    All {formatNumber(total)} sites matching the filter are selected.{" "}
                    <button type="button" className="font-medium text-primary underline" onClick={clearSelection}>
                      Clear selection
                    </button>
                  </>
                ) : (
                  <>
                    All {formatNumber(rows.length)} sites on this page are selected.{" "}
                    <button type="button" className="font-medium text-primary underline" onClick={() => setAllMatching(true)}>
                      Select all {formatNumber(total)} matching the filter
                    </button>
                  </>
                )}
              </div>
            )}
            {list.isError && <p role="alert" className="border-b border-border bg-danger-soft px-4 py-2 text-sm text-danger">Could not refresh: {errorMessage(list.error)}</p>}
            <div className="h-[calc(100dvh-27rem)] min-h-80 overflow-auto" tabIndex={-1}>
              <SitesTable
                rows={rows}
                visible={visible}
                sort={sort}
                onSort={onSort}
                selected={selected}
                onToggle={onToggle}
                onToggleAll={onToggleAll}
                canWrite={canWrite}
                onSaveCell={onSaveCell}
                onOpen={setDetail}
                onDuplicate={runDuplicate}
                onDelete={setDeleting}
                dimmed={list.isPlaceholderData}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border">
              <div className="flex-1">
                <Pagination
                  meta={meta}
                  onPage={(p) => {
                    setPage(p);
                    clearSelection();
                  }}
                />
              </div>
              <label className="flex items-center gap-2 pr-4 text-sm text-muted-foreground">
                Rows
                <div className="w-20">
                  <Select
                    aria-label="Rows per page"
                    className="h-8"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      resetView();
                    }}
                  >
                    {[50, 100, 200].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </div>
              </label>
            </div>
          </>
        )}
      </Card>

      {adding && <SiteFormDialog projectId={pid} site={null} defaultScenario={defaultScenario} onClose={() => setAdding(false)} />}
      {detail && (
        <SiteFormDialog
          projectId={pid}
          site={detail}
          defaultScenario={defaultScenario}
          readOnly={!canWrite}
          onClose={() => setDetail(null)}
        />
      )}
      {deleting && (
        <Modal
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Delete ${deleting.siteCode}?`}
          description={deleting.shopName ?? deleting.dealerName}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="destructive" loading={del.isPending} onClick={confirmDelete}>
                Delete site
              </Button>
            </>
          }
        >
          <p className="text-sm">This site will be removed from the project.</p>
        </Modal>
      )}
      {bulkEdit && <BulkEditDialog projectId={pid} target={bulkEdit} onClose={() => setBulkEdit(null)} onDone={() => { setBulkEdit(null); clearSelection(); }} />}
      {bulkDelete && <BulkDeleteDialog projectId={pid} target={bulkDelete} onClose={() => setBulkDelete(null)} onDone={() => { setBulkDelete(null); clearSelection(); }} />}
      {wizard && (
        <ImportWizard
          projectId={pid}
          defaultScenario={defaultScenario}
          onClose={() => setWizard(false)}
          onViewSites={(batchId) => {
            setWizard(false);
            setQ("");
            setFilterState({ ...NO_FILTER, importBatchId: batchId });
            resetView();
          }}
        />
      )}
      {history && (
        <ImportHistory
          projectId={pid}
          onClose={() => setHistory(false)}
          onViewSites={(batchId) => {
            setHistory(false);
            setQ("");
            setFilterState({ ...NO_FILTER, importBatchId: batchId });
            resetView();
          }}
        />
      )}
    </div>
  );
}
