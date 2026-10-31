"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { VENDOR_STATUS_LABEL, VENDOR_TYPE_LABEL, downloadVendors, useDeleteVendor, useVendors, type Vendor, type VendorStatus, type VendorType } from "@/lib/api/vendors";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { STATUS_TONE, VendorDrawer } from "./vendor-drawer";
import { VendorForm } from "./vendor-form";
import { ExportMenu } from "./export-menu";
import { VendorImport } from "./vendor-import";
import { ZohoVendors } from "./zoho-vendors";

type Tab = "ALL" | VendorStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All Vendors" }, { key: "ACTIVE", label: "Active" }, { key: "PENDING_KYC", label: "Pending KYC" }, { key: "INACTIVE", label: "Inactive" }, { key: "BLACKLISTED", label: "Blacklisted" },
];

/** Vendor master & management: list, upload an Excel list, register new vendors, KYC and activation. */
export function VendorsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("vendors:manage");
  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [type, setType] = useState<VendorType | "">("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const list = useVendors({ page, limit, q: dq || undefined, status: tab === "ALL" ? "" : tab, type, sort: "name" });
  const del = useDeleteVendor();
  const [mode, setMode] = useState<"REGISTERED" | "ZOHO">("REGISTERED");
  const [form, setForm] = useState<{ open: boolean; vendor?: Vendor; zohoContact?: string }>({ open: false });
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<Vendor | null>(null);
  const [toDelete, setToDelete] = useState<Vendor | null>(null);
  const s = list.data?.summary;
  const rows = list.data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader
          code="V"
          title="Vendor Master & Management"
          subtitle="Register vendors, check KYC and keep their rates. Only active vendors can be given shops."
          right={canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="bg-white/15 text-white hover:bg-white/25 hover:text-white" onClick={() => setImporting(true)}><Upload className="size-4" aria-hidden /> Upload vendor list</Button>
              <Button size="sm" className="bg-white text-navy hover:bg-white/90" onClick={() => setForm({ open: true })}><Plus className="size-4" aria-hidden /> New vendor</Button>
            </div>
          )}
        />
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          {([["Total vendors", s?.ALL, "bg-[#e8f0ff] text-royal"], ["Active", s?.ACTIVE, "bg-[#e2f8ea] text-finance"], ["Pending KYC", s?.PENDING_KYC, "bg-[#fff0e0] text-approval"], ["Inactive / blacklisted", (s?.INACTIVE ?? 0) + (s?.BLACKLISTED ?? 0), "bg-[#ffe8e8] text-loss"]] as const).map(([l, v, c]) => (
            <div key={l} className={cn("rounded-xl p-3", c)}><p className="text-xs font-medium opacity-80">{l}</p><p className="text-2xl font-bold tabular-nums">{s ? v : "–"}</p></div>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Vendor lists" className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-soft">
        {([["REGISTERED", "Registered vendors"], ["ZOHO", "Zoho vendors"]] as const).map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={mode === k} onClick={() => setMode(k)} className={cn("rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring", mode === k ? "bg-royal text-white" : "text-muted-foreground hover:bg-muted")}>{label}</button>
        ))}
      </div>

      {mode === "ZOHO" && (
        <ZohoVendors canWrite={canWrite} />
      )}

      {mode === "REGISTERED" && (
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <Tabs label="Vendor status" className="border-b border-border pt-2" value={tab} onChange={(k) => { setTab(k as Tab); setPage(1); }} tabs={TABS.map((t) => ({ ...t, count: s ? (t.key === "ALL" ? s.ALL : s[t.key]) : undefined }))} />
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search vendor name, code, mobile, city…" className="pl-9" aria-label="Search vendors" />
          </div>
          <div className="w-44"><Select value={type} onChange={(e) => { setType(e.target.value as VendorType | ""); setPage(1); }} aria-label="Vendor type"><option value="">All types</option><option value="ONE_MAN">One-man</option><option value="ORGANIZATION">Organization</option></Select></div>
          <ExportMenu onExport={(format) => downloadVendors(format, { q: dq || undefined, status: tab === "ALL" ? "" : tab, type })} />
        </div>

        <div className={cn("overflow-x-auto transition-opacity", list.isFetching && !list.isPending && "opacity-60")}>
          {list.isPending ? (
            <RowsSkeleton rows={6} className="p-4" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="No vendors found" description={canWrite ? "Register a vendor or upload your vendor list." : "No vendor matches the filters."} />
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Service area</th><th className="px-4 py-3 text-right">Rate / shop</th><th className="px-4 py-3 text-right">Shops</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((v) => (
                  <tr key={v._id} className="hover:bg-[#f4f8ff]">
                    <td className="px-4 py-3 font-semibold text-navy">{v.name}<span className="block text-xs font-normal text-muted-foreground">{v.code}</span></td>
                    <td className="px-4 py-3">{VENDOR_TYPE_LABEL[v.type]}</td>
                    <td className="px-4 py-3">{v.contactPerson ?? "-"}<span className="block text-xs text-muted-foreground">{v.mobile}</span></td>
                    <td className="max-w-48 truncate px-4 py-3 text-muted-foreground" title={(v.serviceAreas ?? []).join(", ")}>{(v.serviceAreas ?? []).join(", ") || v.district || "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.ratePerShop != null ? `₹${v.ratePerShop}` : <span className="text-xs text-muted-foreground">Company</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.allocatedShops ?? 0}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[v.status]}>{VENDOR_STATUS_LABEL[v.status]}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label={`View ${v.name}`} onClick={() => setView(v)}><Eye className="size-4" aria-hidden /></Button>
                        {canWrite && <Button size="icon" variant="ghost" aria-label={`Edit ${v.name}`} onClick={() => setForm({ open: true, vendor: v })}><Pencil className="size-4" aria-hidden /></Button>}
                        {canWrite && <Button size="icon" variant="ghost" className="text-loss" aria-label={`Delete ${v.name}`} onClick={() => setToDelete(v)}><Trash2 className="size-4" aria-hidden /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination meta={list.data?.meta} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} />
      </section>
      )}

      {form.open && <VendorForm key={form.vendor?._id ?? form.zohoContact ?? "new"} open vendor={form.vendor} fromZohoContact={form.zohoContact} onClose={() => setForm({ open: false })} />}
      {importing && <VendorImport open onClose={() => setImporting(false)} />}
      <VendorDrawer vendor={view ? (rows.find((r) => r._id === view._id) ?? view) : null} onClose={() => setView(null)} onEdit={(v) => { setView(null); setForm({ open: true, vendor: v }); }} />
      <ConfirmDialog
        autoClose
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete vendor?"
        description={toDelete ? `${toDelete.name} (${toDelete.code}) will be removed. A vendor holding shops cannot be deleted.` : ""}
        confirmLabel="Delete vendor"
        destructive
        onConfirm={() => { if (toDelete) del.mutate(toDelete._id, { onSuccess: () => toast("Vendor deleted"), onError: (e) => toast(errorMessage(e), "error") }); }}
      />
    </div>
  );
}
