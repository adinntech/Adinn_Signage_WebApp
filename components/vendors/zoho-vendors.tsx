"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudDownload, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { downloadZohoVendors, useStartZohoSync, useZohoDirectory, useZohoSyncStatus, type ZohoVendorRow } from "@/lib/api/vendors";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExportMenu } from "./export-menu";

/**
 * Zoho vendors: the stored copy of the Signage creditors in Zoho Books. They are existing vendors, so each row shows its
 * status in Zoho (Active / Inactive) and nothing about registration or KYC: that applies only to vendors added through
 * "New vendor" in the Registered vendors list. Everything is listed by default.
 */
export function ZohoVendors({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const status = useZohoSyncStatus();
  const start = useStartZohoSync();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [zStatus, setZStatus] = useState<"active" | "inactive" | "">("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const list = useZohoDirectory({ page, limit, q: dq || undefined, status: zStatus });

  const s = status.data;
  const running = !!s?.sync.running;
  // When a sync that was running ends: refresh the list and say how it went.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) { wasRunning.current = true; return; }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    void qc.invalidateQueries({ queryKey: ["zoho", "directory"] });
    if (s?.sync.error) toast(s.sync.error, "error");
    else toast(`Zoho sync complete: ${s?.total ?? 0} vendors stored`);
  }, [running, s?.sync.error, s?.total, qc, toast]);

  const rows = list.data?.data ?? [];
  const sync = () => start.mutate(undefined, { onError: (e) => toast(errorMessage(e), "error") });

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-r from-[#eef4ff] to-[#f7f0ff] p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-royal text-white"><CloudDownload className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-navy">Zoho vendors · Creditors - Signage</h2>
          <p className="text-xs text-muted-foreground">
            {s?.lastSyncedAt ? `Last synced ${formatDateTime(s.lastSyncedAt)}` : "Not synced yet"} · Signage creditors of Zoho Books, with their status in Zoho.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" className="bg-royal hover:bg-royal/90" disabled={running} loading={start.isPending} onClick={sync}>
            <RefreshCw className={cn("size-4", running && "animate-spin")} aria-hidden /> {running ? "Syncing…" : "Sync from Zoho"}
          </Button>
        )}
      </div>

      {running && (
        <div role="status" className="border-b border-border px-4 py-2.5">
          <p className="text-xs font-medium text-navy">
            {s?.sync.phase === "details" ? `Reading city, address and created-by… ${s.sync.detailsDone} of ${s.sync.detailsTotal}` : `Reading the vendor list from Zoho… ${s?.sync.fetched ?? 0} so far`}. You can keep working; the first sync takes a few minutes, later ones are quicker.
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e5edff]">
            {s?.sync.phase === "details" && s.sync.detailsTotal > 0 ? <div className="h-full rounded-full bg-royal transition-all" style={{ width: `${Math.round((s.sync.detailsDone / s.sync.detailsTotal) * 100)}%` }} /> : <div className="h-full w-1/3 animate-pulse rounded-full bg-royal" />}
          </div>
        </div>
      )}
      {!running && s?.sync.error && <p role="alert" className="border-b border-[#ffc9c9] bg-[#fff5f5] px-4 py-2.5 text-sm text-loss">{s.sync.error}</p>}

      <Tabs
        label="Status in Zoho"
        className="border-b border-border pt-2"
        value={zStatus || "ALL"}
        onChange={(k) => { setZStatus(k === "ALL" ? "" : (k as "active" | "inactive")); setPage(1); }}
        tabs={[{ key: "ALL", label: "All vendors", count: s?.total }, { key: "active", label: "Active", count: s?.active }, { key: "inactive", label: "Inactive", count: s ? s.total - s.active : undefined }]}
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search vendor ID, name, phone, email, city, GSTIN, contact ID…" className="pl-9" aria-label="Search Zoho vendors" />
        </div>
        <ExportMenu disabled={!list.data?.meta.total} onExport={(format) => downloadZohoVendors(format, { q: dq || undefined, status: zStatus })} />
      </div>

      <div className={cn("overflow-x-auto transition-opacity", list.isFetching && !list.isPending && "opacity-60")}>
        {list.isPending ? (
          <RowsSkeleton rows={6} className="p-4" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          s && s.total === 0 && !running ? (
            <EmptyState title="No Zoho vendors stored yet" description={canWrite ? "Press “Sync from Zoho” to bring in the vendor list." : "Ask Operations to sync the vendor list from Zoho."} />
          ) : (
            <EmptyState title="No vendors found" description="Nothing matches the search and filters." />
          )
        ) : (
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
              <tr><th className="px-4 py-3">Vendor ID</th><th className="px-4 py-3">Vendor name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Created by</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Contact ID</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((v) => <Row key={v._id} v={v} />)}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={list.data?.meta} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} />
    </section>
  );
}

function Row({ v }: { v: ZohoVendorRow }) {
  return (
    <tr className="hover:bg-[#f4f8ff]">
      <td className="px-4 py-3 font-mono text-sm font-semibold text-navy">{v.vendorNo ?? "–"}</td>
      <td className="max-w-64 truncate px-4 py-3 font-semibold text-navy" title={v.name}>{v.name}</td>
      <td className="whitespace-nowrap px-4 py-3">{v.mobile ?? <span className="text-muted-foreground">–</span>}</td>
      <td className="max-w-52 truncate px-4 py-3 text-muted-foreground" title={v.email ?? ""}>{v.email ?? "–"}</td>
      <td className="px-4 py-3 text-xs"><span className="block max-w-44 truncate font-medium" title={v.createdByName ?? ""}>{v.createdByName ?? "–"}</span>{v.zohoCreatedAt && <span className="text-muted-foreground">{formatDate(v.zohoCreatedAt)}</span>}</td>
      <td className="px-4 py-3"><Badge tone={v.zohoStatus === "active" ? "success" : "neutral"}>{v.zohoStatus === "active" ? "Active" : "Inactive"}</Badge></td>
      <td className="max-w-44 truncate px-4 py-3" title={v.address ?? ""}>{v.city || (v.address ? v.address.split(",").slice(-2).join(",").trim() : "–")}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.zohoContactId}</td>
    </tr>
  );
}
