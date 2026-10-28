"use client";

import { Check, Columns3, Download, FileSpreadsheet, History, Plus, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SCENARIOS, SCENARIO_LABEL, SITE_COLUMNS, type MissingKey, type Scenario, type SiteStats } from "@/lib/api/sites";
import { cn } from "@/lib/utils";

export interface FilterState {
  district: string;
  scenario: Scenario | "";
  missing: MissingKey | "";
  importBatchId: string;
}

export const MISSING_LABEL: Record<MissingKey, string> = {
  address: "Missing address",
  mobile: "Missing mobile",
  measurement: "Missing measurement",
  gst: "Missing GST",
  district: "Missing district",
};

export function SitesStats({
  stats,
  missing,
  onMissing,
}: {
  stats?: SiteStats;
  missing: MissingKey | "";
  onMissing: (m: MissingKey | "") => void;
}) {
  const fmt = (n?: number) => (n === undefined ? "-" : new Intl.NumberFormat("en-IN").format(n));
  const chips: { key: MissingKey; label: string; n?: number }[] = [
    { key: "address", label: "address", n: stats?.missing.address },
    { key: "mobile", label: "mobile", n: stats?.missing.mobile },
    { key: "measurement", label: "measurement", n: stats?.missing.measurement },
    { key: "gst", label: "GST", n: stats?.missing.gst },
  ];
  return (
    <div className="flex flex-wrap items-stretch gap-3">
      <dl className="flex flex-wrap gap-3">
        {[
          ["Total sites", fmt(stats?.total)],
          ["Total sq.ft", fmt(stats?.totalSqft)],
          ["Districts", fmt(stats?.districts.length)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-28 rounded-lg border border-border bg-surface px-4 py-2 shadow-soft">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by missing data">
        {chips.map((c) => {
          const active = missing === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              disabled={!stats}
              onClick={() => onMissing(active ? "" : c.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-warning bg-warning text-white"
                  : c.n
                    ? "border-warning/40 bg-warning-soft text-warning hover:border-warning"
                    : "border-border bg-surface text-muted-foreground",
              )}
            >
              Missing {c.label}
              <span className="tabular-nums">{fmt(c.n)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SitesToolbar({
  q,
  onQ,
  filter,
  onFilter,
  stats,
  visible,
  onToggleColumn,
  canWrite,
  onImport,
  allowImport = true,
  onAdd,
  onHistory,
  onExport,
  onTemplate,
  exporting,
  exportLabel,
  hasBatchFilter,
}: {
  q: string;
  onQ: (v: string) => void;
  filter: FilterState;
  onFilter: (p: Partial<FilterState>) => void;
  stats?: SiteStats;
  visible: string[];
  onToggleColumn: (key: string) => void;
  canWrite: boolean;
  onImport: () => void;
  allowImport?: boolean;
  onAdd: () => void;
  onHistory: () => void;
  onExport: (format: "xlsx" | "csv") => void;
  onTemplate: (s: Scenario) => void;
  exporting: boolean;
  exportLabel: string;
  hasBatchFilter: boolean;
}) {
  const districts = (stats?.districts ?? []).filter((d) => d.district !== "(none)");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search sites" placeholder="Search shop, dealer, code, mobile" className="pl-9" value={q} onChange={(e) => onQ(e.target.value)} />
      </div>
      <div className="w-40">
        <Select aria-label="Filter by district" value={filter.district} onChange={(e) => onFilter({ district: e.target.value })}>
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d.district} value={d.district}>
              {d.district} ({d.count})
            </option>
          ))}
        </Select>
      </div>
      <div className="w-44">
        <Select aria-label="Filter by missing data" value={filter.missing} onChange={(e) => onFilter({ missing: e.target.value as MissingKey | "" })}>
          <option value="">Any data state</option>
          {(Object.keys(MISSING_LABEL) as MissingKey[]).map((k) => (
            <option key={k} value={k}>
              {MISSING_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-44">
        <Select aria-label="Filter by scenario" value={filter.scenario} onChange={(e) => onFilter({ scenario: e.target.value as Scenario | "" })}>
          <option value="">All scenarios</option>
          {SCENARIOS.map((s) => (
            <option key={s} value={s}>
              {SCENARIO_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      {hasBatchFilter && (
        <button
          type="button"
          onClick={() => onFilter({ importBatchId: "" })}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary-hover"
        >
          From last import <X className="size-3" aria-hidden />
          <span className="sr-only">Clear import filter</span>
        </button>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="size-4" aria-hidden /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Site ID and Shop are always shown</DropdownMenuLabel>
            {SITE_COLUMNS.filter((c) => c.key !== "siteCode" && c.key !== "shopName").map((c) => (
              <DropdownMenuItem
                key={c.key}
                onSelect={(e) => {
                  e.preventDefault();
                  onToggleColumn(c.key);
                }}
              >
                <span className="flex size-4 items-center justify-center">{visible.includes(c.key) && <Check className="size-4" aria-hidden />}</span>
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" loading={exporting}>
              <Download className="size-4" aria-hidden /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{exportLabel}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport("csv")}>CSV (.csv)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="size-4" aria-hidden /> Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Download an import template</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SCENARIOS.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onTemplate(s)}>
                {SCENARIO_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={onHistory}>
          <History className="size-4" aria-hidden /> Import history
        </Button>
        {canWrite && (
          <>
            {allowImport && (
              <Button variant="secondary" size="sm" onClick={onImport}>
                <Upload className="size-4" aria-hidden /> Import Excel
              </Button>
            )}
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-4" aria-hidden /> Add site
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
