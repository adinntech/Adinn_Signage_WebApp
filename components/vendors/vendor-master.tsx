"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeIndianRupee, Check, CloudDownload, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/api";
import { downloadZohoVendors, useAddVendorSkill, useSetZohoPrice, useStartZohoSync, useVendorSkills, useZohoDirectory, useZohoSyncStatus, type ZohoVendorRow } from "@/lib/api/vendors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExportMenu } from "./export-menu";
import { ZohoVendorDrawer } from "./zoho-vendor-drawer";

const money = (n: number | null) => (n == null ? "–" : `₹${n}`);

/**
 * Vendor master. Search the vendors fetched from Zoho (by vendor ID, name, GST, PAN, phone or anything else known), add
 * the cost of the vendor you found (price per shop, far-distance price, skills), and only vendors with a cost are listed
 * below. A registered vendor keeps its cost on the vendor (used by allocation and costing); a Zoho vendor not registered
 * yet keeps it here and it carries over when it is registered.
 */
export function VendorMaster({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const status = useZohoSyncStatus();
  const start = useStartZohoSync();
  const s = status.data;
  const running = !!s?.sync.running;
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) { wasRunning.current = true; return; }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    void qc.invalidateQueries({ queryKey: ["zoho", "directory"] });
    if (s?.sync.error) toast(s.sync.error, "error");
    else toast(`Zoho sync complete: ${s?.total ?? 0} vendors stored`);
  }, [running, s?.sync.error, s?.total, qc, toast]);

  const [costFor, setCostFor] = useState<ZohoVendorRow | null>(null);
  const [removing, setRemoving] = useState<ZohoVendorRow | null>(null);
  const [viewing, setViewing] = useState<ZohoVendorRow | null>(null);
  const clear = useSetZohoPrice();

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-r from-[#eef4ff] to-[#f7f0ff] p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-royal text-white"><CloudDownload className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-navy">Find a vendor in Zoho</h2>
            <p className="text-xs text-muted-foreground">{s?.lastSyncedAt ? `Zoho list synced ${formatDateTime(s.lastSyncedAt)}` : "Zoho list not synced yet"} · {s?.total ?? 0} Signage creditors</p>
          </div>
          {canWrite && (
            <Button size="sm" className="bg-royal hover:bg-royal/90" disabled={running} loading={start.isPending} onClick={() => start.mutate(undefined, { onError: (e) => toast(errorMessage(e), "error") })}>
              <RefreshCw className={cn("size-4", running && "animate-spin")} aria-hidden /> {running ? "Syncing…" : "Sync from Zoho"}
            </Button>
          )}
        </div>
        {running && (
          <p role="status" className="border-b border-border px-4 py-2.5 text-xs font-medium text-navy">
            {s?.sync.phase === "details" ? `Reading city, address and created-by… ${s.sync.detailsDone} of ${s.sync.detailsTotal}` : `Reading the vendor list from Zoho… ${s?.sync.fetched ?? 0} so far`}. You can keep working.
          </p>
        )}
        <SearchResults canWrite={canWrite} onCost={setCostFor} onView={setViewing} syncing={running} empty={s?.total === 0} />
      </section>

      <WithCost canWrite={canWrite} onView={setViewing} onEdit={setCostFor} onRemove={setRemoving} />
      <ZohoVendorDrawer vendor={viewing} canWrite={canWrite} onCost={(v) => { setViewing(null); setCostFor(v); }} onClose={() => setViewing(null)} />

      {costFor && <VendorCostDialog key={costFor._id} vendor={costFor} onClose={() => setCostFor(null)} />}
      <ConfirmDialog
        autoClose
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove the cost?"
        description={removing ? `${removing.name} will leave the list below and the company rate applies. You can add the cost again any time.` : ""}
        confirmLabel="Remove cost"
        destructive
        onConfirm={() => removing && clear.mutate({ contactId: removing.zohoContactId, ratePerShop: null, farRatePerShop: null, skills: [] }, { onSuccess: () => toast("Cost removed"), onError: (e) => toast(errorMessage(e), "error") })}
      />
    </div>
  );
}

/** The search box and what it finds. Nothing is listed until something is typed, so the 500+ vendors never fill the screen. */
function SearchResults({ canWrite, onCost, onView, syncing, empty }: { canWrite: boolean; onCost: (v: ZohoVendorRow) => void; onView: (v: ZohoVendorRow) => void; syncing: boolean; empty: boolean }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const searching = dq.length >= 2;
  const list = useZohoDirectory({ page, limit, q: searching ? dq : undefined, status: "active" }, searching);
  const rows = list.data?.data ?? [];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by vendor ID, name, GST, PAN, phone, email, city…" className="pl-9" aria-label="Search Zoho vendors" autoComplete="off" />
        </div>
      </div>
      {!searching ? (
        <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">{empty && !syncing ? "No Zoho vendors stored yet. Press “Sync from Zoho” first." : ""}</p>
      ) : list.isPending ? (
        <RowsSkeleton rows={4} className="p-4" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No vendor found" description="Check the spelling, or try the vendor ID, GST, PAN or phone number." />
      ) : (
        <>
          <div className={cn("overflow-x-auto border-t border-border transition-opacity", list.isFetching && "opacity-60")}>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr><th className="px-4 py-3">Vendor ID</th><th className="px-4 py-3">Vendor name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">GST / PAN</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((v) => (
                  <tr key={v._id} className="cursor-pointer hover:bg-[#f4f8ff]" onClick={() => onView(v)} title="Click to see all details">
                    <td className="px-4 py-3 font-mono font-semibold text-navy">{v.vendorNo ?? "–"}</td>
                    <td className="max-w-60 px-4 py-3 font-semibold text-navy"><span className="block truncate" title={v.name}>{v.name}</span></td>
                    <td className="whitespace-nowrap px-4 py-3">{v.mobile ?? "–"}</td>
                    <td className="px-4 py-3 text-xs">{v.gstin ?? "–"}<span className="block text-muted-foreground">{v.pan ?? ""}</span></td>
                    <td className="max-w-36 truncate px-4 py-3">{v.city || "–"}</td>
                    <td className="px-4 py-3">{v.price.ratePerShop != null ? <Badge tone="success"><Check className="mr-1 size-3" aria-hidden />{money(v.price.ratePerShop)}</Badge> : <span className="text-xs text-muted-foreground">Not added</span>}</td>
                    <td className="px-4 py-3 text-right">{canWrite && <Button size="sm" {...(v.price.ratePerShop != null ? { variant: "outline" as const } : { className: "bg-vendor hover:bg-vendor/90" })} onClick={(e) => { e.stopPropagation(); onCost(v); }}><BadgeIndianRupee className="size-4" aria-hidden /> {v.price.ratePerShop != null ? "Edit cost" : "Add cost"}</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={list.data?.meta} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} />
        </>
      )}
    </>
  );
}

/** Only vendors whose cost was added. */
function WithCost({ canWrite, onView, onEdit, onRemove }: { canWrite: boolean; onView: (v: ZohoVendorRow) => void; onEdit: (v: ZohoVendorRow) => void; onRemove: (v: ZohoVendorRow) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const list = useZohoDirectory({ page, limit, q: dq || undefined, price: "set" });
  const rows = list.data?.data ?? [];
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#f1e6ff] text-vendor"><BadgeIndianRupee className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-navy">Vendors with cost <span className="font-normal text-muted-foreground">({list.data?.meta.total ?? 0})</span></h2>
          <p className="text-xs text-muted-foreground">Price per shop, far-distance price and skills of the vendors you added.</p>
        </div>
        <div className="relative min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search these vendors…" className="pl-9" aria-label="Search vendors with cost" />
        </div>
        <ExportMenu disabled={!list.data?.meta.total} onExport={(format) => downloadZohoVendors(format, { q: dq || undefined, price: "set" })} />
      </div>
      <div className={cn("overflow-x-auto transition-opacity", list.isFetching && !list.isPending && "opacity-60")}>
        {list.isPending ? (
          <RowsSkeleton rows={4} className="p-4" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No vendor has a cost yet" description="Search a vendor above and press “Add cost”. It will be listed here." />
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#f6f0ff] text-left text-xs uppercase tracking-wide text-navy">
              <tr><th className="px-4 py-3">Vendor ID</th><th className="px-4 py-3">Vendor name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3 text-right">Price / shop</th><th className="px-4 py-3 text-right">Far price</th><th className="px-4 py-3">Skills</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((v) => (
                <tr key={v._id} className="cursor-pointer hover:bg-[#faf6ff]" onClick={() => onView(v)} title="Click to see all details">
                  <td className="px-4 py-3 font-mono font-semibold text-navy">{v.vendorNo ?? "–"}</td>
                  <td className="max-w-60 px-4 py-3 font-semibold text-navy"><span className="block truncate" title={v.name}>{v.name}</span>{v.vendor && <span className="text-xs font-normal text-muted-foreground">Registered · {v.vendor.code}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3">{v.mobile ?? "–"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(v.price.ratePerShop)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(v.price.farRatePerShop)}</td>
                  <td className="px-4 py-3"><div className="flex max-w-60 flex-wrap gap-1">{v.price.skills?.length ? v.price.skills.map((k) => <span key={k} className="rounded-full bg-[#f1e6ff] px-2 py-0.5 text-xs font-medium text-vendor">{k}</span>) : <span className="text-xs text-muted-foreground">–</span>}</div></td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label={`Edit cost of ${v.name}`} onClick={(e) => { e.stopPropagation(); onEdit(v); }}><Pencil className="size-4" aria-hidden /></Button>
                        <Button size="icon" variant="ghost" className="text-loss" aria-label={`Remove cost of ${v.name}`} onClick={(e) => { e.stopPropagation(); onRemove(v); }}><Trash2 className="size-4" aria-hidden /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={list.data?.meta} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} />
    </section>
  );
}

/** Add or change the cost of one vendor: price per shop, far-distance price, skills (pick from the list or add a new one). */
function VendorCostDialog({ vendor, onClose }: { vendor: ZohoVendorRow; onClose: () => void }) {
  const toast = useToast();
  const save = useSetZohoPrice();
  const skills = useVendorSkills();
  const addSkill = useAddVendorSkill();
  const [rate, setRate] = useState(vendor.price.ratePerShop != null ? String(vendor.price.ratePerShop) : "");
  const [far, setFar] = useState(vendor.price.farRatePerShop != null ? String(vendor.price.farRatePerShop) : "");
  const [picked, setPicked] = useState<string[]>(vendor.price.skills ?? []);
  const [newSkill, setNewSkill] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const e: Record<string, string> = {};
    const r = rate.trim() === "" ? null : Number(rate);
    const f = far.trim() === "" ? null : Number(far);
    if (r == null) e.rate = "Enter the price per shop";
    else if (!(r >= 0)) e.rate = "Enter an amount";
    if (f != null && !(f >= 0)) e.far = "Enter an amount";
    else if (r != null && f != null && f < r) e.far = "Far price cannot be lower than the normal price";
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate({ contactId: vendor.zohoContactId, ratePerShop: r, farRatePerShop: f, skills: picked }, { onSuccess: () => { toast(`${vendor.name}: cost saved`); onClose(); }, onError: (err) => toast(errorMessage(err), "error") });
  }
  function createSkill() {
    const name = newSkill.trim();
    if (name.length < 2) return setErrors((x) => ({ ...x, skill: "Enter the skill name" }));
    addSkill.mutate(name, {
      onSuccess: (s) => { setPicked((p) => (p.includes(s.name) ? p : [...p, s.name])); setNewSkill(""); setErrors((x) => ({ ...x, skill: "" })); },
      onError: (err) => setErrors((x) => ({ ...x, skill: errorMessage(err) })),
    });
  }
  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  const all = skills.data ?? [];

  return (
    <Modal
      persistent
      open
      onOpenChange={(o) => !o && onClose()}
      title={vendor.price.ratePerShop != null ? "Edit cost" : "Add cost"}
      description={`${vendor.vendorNo ? `${vendor.vendorNo} · ` : ""}${vendor.name}`}
      className="max-w-xl"
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="bg-vendor hover:bg-vendor/90" loading={save.isPending} onClick={submit}>Save cost</Button></div>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price per shop (₹)" htmlFor="c-rate" required error={errors.rate}><Input id="c-rate" format="decimal" maxLength={7} value={rate} onChange={(e) => { setRate(e.target.value); setErrors((x) => ({ ...x, rate: "" })); }} aria-invalid={!!errors.rate} autoFocus /></Field>
          <Field label="Far distance price (₹)" htmlFor="c-far" error={errors.far} hint="Optional. Not lower than the price per shop"><Input id="c-far" format="decimal" maxLength={7} value={far} onChange={(e) => { setFar(e.target.value); setErrors((x) => ({ ...x, far: "" })); }} aria-invalid={!!errors.far} /></Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-navy">Skills</legend>
          {all.length === 0 ? (
            <p className="text-xs text-muted-foreground">No skills yet. Add the first one below.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {all.map((s) => {
                const on = picked.includes(s.name);
                return <button key={s._id} type="button" aria-pressed={on} onClick={() => toggle(s.name)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", on ? "border-vendor bg-vendor text-white" : "border-border hover:border-vendor/50 hover:bg-[#f6f0ff]")}>{on && <Check className="mr-1 inline size-3" aria-hidden />}{s.name}</button>;
              })}
            </div>
          )}
          <div className="mt-3 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="c-skill" className="sr-only">New skill</label>
              <Input id="c-skill" maxLength={60} value={newSkill} onChange={(e) => { setNewSkill(e.target.value); setErrors((x) => ({ ...x, skill: "" })); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createSkill(); } }} placeholder="New skill, e.g. Flex printing" aria-invalid={!!errors.skill} />
              {errors.skill && <p role="alert" className="mt-1 text-xs text-loss">{errors.skill}</p>}
            </div>
            <Button type="button" variant="outline" loading={addSkill.isPending} disabled={newSkill.trim().length < 2} onClick={createSkill}><Plus className="size-4" aria-hidden /> Add skill</Button>
          </div>
        </fieldset>
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Modal>
  );
}
