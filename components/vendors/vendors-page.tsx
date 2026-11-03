"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, KeyRound, Mail, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
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
import { VENDOR_STATUS_LABEL, VENDOR_TYPE_LABEL, downloadVendors, useDeleteVendor, useVendors, useZohoSyncStatus, type Vendor, type VendorStatus, type VendorType } from "@/lib/api/vendors";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** " · Name" for a populated user reference, or nothing. */
const who = (u: Vendor["createdBy"]) => (u && typeof u === "object" && u.name ? ` · ${u.name}` : "");
import { STATUS_TONE, VendorDrawer } from "./vendor-drawer";
import { VendorForm } from "./vendor-form";
import { ExportMenu } from "./export-menu";
import { VendorImport } from "./vendor-import";
import { VendorIdDialog } from "./vendor-id-dialog";
import { VendorMaster } from "./vendor-master";
import { VendorRegistrationMail } from "./vendor-registration-mail";

type Tab = "ALL" | VendorStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All Vendors" }, { key: "ACTIVE", label: "Active" }, { key: "PENDING_KYC", label: "Pending KYC" }, { key: "INACTIVE", label: "Inactive" }, { key: "BLACKLISTED", label: "Blacklisted" },
];

/**
 * Two separate pages share this shell: "master" (find a Zoho vendor and add its cost) and "registration" (new vendors:
 * documents, registration mail, vendor ID, KYC and activation, upload an Excel list).
 */
export function VendorsPage({ view: which = "master" }: { view?: "master" | "registration" }) {
  const router = useRouter();
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
  const [form, setForm] = useState<{ open: boolean; vendor?: Vendor }>({ open: false });
  const registration = which === "registration";
  const [mailing, setMailing] = useState<Vendor | null>(null);
  const [idFor, setIdFor] = useState<Vendor | null>(null);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<Vendor | null>(null);
  const [toDelete, setToDelete] = useState<Vendor | null>(null);
  const s = list.data?.summary;
  const zoho = useZohoSyncStatus().data;
  const rows = list.data?.data ?? [];
  /** Upload vendor list and New vendor: registration page only, at the right corner. */
  const actions = canWrite && registration && (
    <>
      <Button variant="outline" onClick={() => setImporting(true)}><Upload className="size-4" aria-hidden /> Upload vendor list</Button>
      <Button className="bg-royal hover:bg-royal/90" onClick={() => setForm({ open: true })}><Plus className="size-4" aria-hidden /> New vendor</Button>
    </>
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader
          code="V"
          title={registration ? "Vendor Registration" : "Vendor Master"}
          subtitle={registration ? "Register new vendors with their documents, send the registration mail and enter the vendor ID Accounts reply with." : "Find a vendor from Zoho and add its cost. Only active vendors can be given shops."}
        />
        {/* One dashboard for the whole vendor base: the Zoho vendors plus the vendors registered here. A Zoho vendor also registered here is counted once (as Zoho). */}
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          {([
            ["All vendors", zoho && s ? zoho.total + s.NEW : undefined, `${zoho?.total ?? 0} Zoho + ${s?.NEW ?? 0} new`, "bg-[#e8f0ff] text-royal", "MASTER"],
            ["Zoho vendors", zoho?.total, zoho ? `${zoho.active} active · ${zoho.total - zoho.active} inactive` : "", "bg-[#f1e6ff] text-vendor", "MASTER"],
            ["New registered", s?.NEW, s ? `${s.NEW_ACTIVE} active` : "", "bg-[#e2f8ea] text-finance", "REGISTERED"],
            ["New - pending KYC", s?.NEW_PENDING_KYC, "Need documents and activation", "bg-[#fff0e0] text-approval", "REGISTERED"],
          ] as const).map(([l, v, sub, c, target]) => (
            <button key={l} type="button" onClick={() => { const toRegistration = target === "REGISTERED"; if (toRegistration !== registration) return router.push(toRegistration ? "/vendors/registration" : "/vendors/master"); if (l === "New - pending KYC") { setTab("PENDING_KYC"); setPage(1); } }} className={cn("rounded-xl p-3 text-left transition-shadow hover:shadow-soft focus-visible:outline-2 focus-visible:outline-ring", c)}>
              <span className="block text-xs font-medium opacity-80">{l}</span>
              <span className="block text-2xl font-bold tabular-nums">{v ?? "–"}</span>
              <span className="block truncate text-[11px] opacity-80">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}

      {!registration && <VendorMaster canWrite={canWrite} />}

      {registration && (
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <div className="border-b border-border px-4 py-3"><h2 className="text-base font-bold text-navy">Registered vendors</h2><p className="text-xs text-muted-foreground">New vendors registered here with their KYC documents and registration mail. Click a row to see all its details.</p></div>
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
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Service area</th><th className="px-4 py-3 text-right">Rate / shop</th><th className="px-4 py-3 text-right">Shops</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Created / updated</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((v) => (
                  <tr key={v._id} className="cursor-pointer hover:bg-[#f4f8ff]" onClick={() => setView(v)} title="Click to see all details">
                    <td className="px-4 py-3 font-semibold text-navy">{v.name}<span className="block text-xs font-normal text-muted-foreground">{v.code}</span></td>
                    <td className="px-4 py-3">{VENDOR_TYPE_LABEL[v.type]}</td>
                    <td className="px-4 py-3">{v.contactPerson ?? "-"}<span className="block text-xs text-muted-foreground">{v.mobile}</span></td>
                    <td className="max-w-48 truncate px-4 py-3 text-muted-foreground" title={(v.serviceAreas ?? []).join(", ")}>{(v.serviceAreas ?? []).join(", ") || v.district || "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.ratePerShop != null ? `₹${v.ratePerShop}` : <span className="text-xs text-muted-foreground">Company</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.allocatedShops ?? 0}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {v.zohoVendorNo ? <span className="text-xs">Vendor ID <span className="font-mono font-semibold text-navy">{v.zohoVendorNo}</span></span>
                        : v.registration?.mailSentAt ? <><span className="block text-xs text-approval">Mail sent · waiting for ID</span>{canWrite && <button type="button" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-royal hover:underline" onClick={() => setIdFor(v)}><KeyRound className="size-3" aria-hidden /> Enter vendor ID</button>}</>
                        : v.source === "ZOHO" ? <span className="text-xs text-muted-foreground">From Zoho</span>
                        : <><span className="block text-xs text-muted-foreground">{v.registration?.draft?.savedAt ? "Mail draft saved" : "Mail not sent"}</span>{canWrite && <button type="button" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-royal hover:underline" onClick={() => setMailing(v)}><Mail className="size-3" aria-hidden /> {v.registration?.draft?.savedAt ? "Continue mail" : "Send mail"}</button>}</>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      <span className="block">Created {formatDate(v.createdAt)}{who(v.createdBy)}</span>
                      <span className="block text-muted-foreground">Updated {formatDate(v.updatedAt ?? v.createdAt)}{who(v.updatedBy)}</span>
                    </td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[v.status]}>{VENDOR_STATUS_LABEL[v.status]}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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

      {form.open && <VendorForm key={form.vendor?._id ?? "new"} open vendor={form.vendor} onClose={() => setForm({ open: false })} />}
      {importing && <VendorImport open onClose={() => setImporting(false)} />}
      {mailing && <VendorRegistrationMail vendor={mailing} open onClose={() => setMailing(null)} />}
      {idFor && <VendorIdDialog vendor={idFor} onClose={() => setIdFor(null)} />}
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
