"use client";

import { useState } from "react";
import { BadgeIndianRupee, Check, CloudDownload, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { downloadZohoVendors, useAddVendorSkill, useCompanyRates, useSetZohoPrice, useVendorSkills, useZohoDirectory, type ZohoVendorRow } from "@/lib/api/vendors";
import { cn } from "@/lib/utils";
import { ExportMenu } from "./export-menu";
import { ZohoToggle } from "./zoho-toggle";
import { ZohoVendorDrawer } from "./zoho-vendor-drawer";

const money = (n: number | null) => (n == null ? "–" : `₹${n}`);

/**
 * Vendor master. Search the vendors in Zoho (read live from Zoho Books, nothing of Zoho's list is stored: by vendor name, phone or e-mail), add
 * the cost of the vendor you found (price per shop, travelling cost, skills), and only vendors with a cost are listed
 * below. Only those vendors are stored. A registered vendor keeps its cost on the vendor (used by allocation and costing); a Zoho
 * vendor not registered yet keeps it here and it carries over when it is registered.
 */
export function VendorMaster({ canWrite, signageOnly, onSignageOnly, costed, contactCode, browse, onBrowse }: { canWrite: boolean; signageOnly: boolean; onSignageOnly: (v: boolean) => void; browse: boolean; onBrowse: (v: boolean) => void; costed: number; contactCode?: string }) {
  const toast = useToast();

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
            <p className="text-xs text-muted-foreground">Read live from Zoho Books. Only vendors you add a cost to are saved here ({costed} so far).</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={signageOnly}
            onClick={() => onSignageOnly(!signageOnly)}
            title={signageOnly ? `Showing only ${contactCode ?? "Signage"} vendors. Click to show every Zoho vendor.` : "Showing every vendor in Zoho. Click to show only the Signage creditors."}
            className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-soft focus-visible:outline-2 focus-visible:outline-royal"
          >
            <span className={cn("relative h-5 w-9 rounded-full transition-colors", signageOnly ? "bg-vendor" : "bg-[#cbd5e1]")}><span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", signageOnly ? "left-[18px]" : "left-0.5")} /></span>
            {signageOnly ? "Signage creditors only" : "All Zoho vendors"}
          </button>
        </div>
        <SearchResults canWrite={canWrite} onCost={setCostFor} onView={setViewing} signageOnly={signageOnly} all={browse} onAll={onBrowse} />
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
function SearchResults({ canWrite, onCost, onView, signageOnly, all, onAll }: { canWrite: boolean; onCost: (v: ZohoVendorRow) => void; onView: (v: ZohoVendorRow) => void; signageOnly: boolean; all: boolean; onAll: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  /** Off (the default): Zoho is not called until the toggle is switched on or something is typed. On: the list is read page by page; the search narrows it. */
  const searching = all || dq.length >= 2;
  const list = useZohoDirectory({ page, limit, q: dq.length >= 2 ? dq : undefined, status: "active", signageOnly: signageOnly ? "true" : "false" }, searching);
  const rows = list.data?.data ?? [];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search Zoho by vendor ID, name, phone or e-mail…" className="pl-9" aria-label="Search Zoho vendors" autoComplete="off" />
        </div>
        <ZohoToggle on={all} onChange={(v) => { onAll(v); setPage(1); }} />
      </div>
      {!searching ? (
        <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">Type a vendor name, number, phone or e-mail, or switch on “Zoho vendors” to browse the list (read live from Zoho, page by page; nothing is saved until you add a cost).</p>
      ) : list.isPending ? (
        <RowsSkeleton rows={4} className="p-4" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No vendor found" description="Check the spelling, or try the vendor number, phone number or e-mail. GST and PAN are not searchable in Zoho." />
      ) : (
        <>
          <div className={cn("overflow-x-auto border-t border-border transition-opacity", list.isFetching && "opacity-60")}>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr><th className="sticky left-0 z-20 w-32 min-w-32 bg-[#eef4ff] px-4 py-3">Vendor ID</th><th className="sticky left-32 z-20 bg-[#eef4ff] px-4 py-3 shadow-[2px_0_0_0_var(--color-border,#e5e7eb)]">Vendor name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">GST / PAN</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((v) => (
                  <tr key={v._id} className="group cursor-pointer hover:bg-[#f4f8ff]" onClick={() => onView(v)} title="Click to see all details">
                    <td className={`sticky left-0 z-10 w-32 min-w-32 bg-surface px-4 py-3 font-mono font-semibold text-navy group-hover:bg-[#f4f8ff]`}>{v.vendorNo ?? "–"}</td>
                    <td className="sticky left-32 z-10 max-w-60 bg-surface px-4 py-3 font-semibold text-navy group-hover:bg-[#f4f8ff] shadow-[2px_0_0_0_var(--color-border,#e5e7eb)]"><span className="block truncate" title={v.name}>{v.name}</span></td>
                    <td className="whitespace-nowrap px-4 py-3">{v.mobile ?? "–"}</td>
                    <td className="px-4 py-3 text-xs">{v.gstin ?? "–"}<span className="block text-muted-foreground">{v.pan ?? ""}</span></td>
                    <td className="max-w-36 truncate px-4 py-3">{v.city || "–"}</td>
                    <td className="px-4 py-3">{v.price.ratePerShop != null ? <Badge tone="success"><Check className="mr-1 size-3" aria-hidden />{money(v.price.ratePerShop)}</Badge> : <span className="text-xs text-muted-foreground">Not added</span>}{v.price.pending && <span className="mt-1 block text-xs font-semibold text-approval" title={`Company rate ${money(v.price.pending.limitRate)} / travelling cost ${money(v.price.pending.limitFar)}. Waiting for the approver's reply (${v.price.pending.requestId}).`}>Waiting for approval: {money(v.price.pending.ratePerShop)}{v.price.pending.farRatePerShop != null ? ` / travelling ${money(v.price.pending.farRatePerShop)}` : ""}</span>}</td>
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

/** Cost above the company rate, waiting for the approver's reply (old cost, if any, stays until then). */
function PendingTag({ p }: { p: NonNullable<ZohoVendorRow["price"]["pending"]> }) {
  return <span className="mt-1 block text-xs font-semibold text-approval" title={`Company rate ${money(p.limitRate)} / travelling cost ${money(p.limitFar)}. Request ${p.requestId}`}>Pending approval: {money(p.ratePerShop)}{p.farRatePerShop != null ? ` / ${money(p.farRatePerShop)}` : ""}</span>;
}

/** Only vendors whose cost was added, or is waiting for approval. */
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
          <p className="text-xs text-muted-foreground">Price per shop, travelling cost and skills of the vendors you added.</p>
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
          <EmptyState title="No vendor has a cost yet" description="Search a vendor above and press “Add cost”. It will be listed here, also while its cost waits for approval." />
        ) : (
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-[#f6f0ff] text-left text-xs uppercase tracking-wide text-navy">
              <tr><th className="sticky left-0 z-20 w-32 min-w-32 bg-[#f6f0ff] px-4 py-3">Vendor ID</th><th className="sticky left-32 z-20 bg-[#f6f0ff] px-4 py-3 shadow-[2px_0_0_0_var(--color-border,#e5e7eb)]">Vendor name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">City</th><th className="px-4 py-3 text-right">Price / shop</th><th className="px-4 py-3 text-right">Travelling cost</th><th className="px-4 py-3">Skills</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((v) => (
                <tr key={v._id} className="group cursor-pointer hover:bg-[#faf6ff]" onClick={() => onView(v)} title="Click to see all details">
                  <td className={`sticky left-0 z-10 w-32 min-w-32 bg-surface px-4 py-3 font-mono font-semibold text-navy group-hover:bg-[#faf6ff]`}>{v.vendorNo ?? "–"}</td>
                  <td className="sticky left-32 z-10 max-w-60 bg-surface px-4 py-3 font-semibold text-navy group-hover:bg-[#faf6ff] shadow-[2px_0_0_0_var(--color-border,#e5e7eb)]"><span className="block truncate" title={v.name}>{v.name}</span>{v.vendor && <span className="text-xs font-normal text-muted-foreground">Registered · {v.vendor.code}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3">{v.mobile ?? "–"}</td>
                  <td className="max-w-40 px-4 py-3"><span className="block truncate" title={v.city ?? ""}>{v.city || "–"}</span></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(v.price.ratePerShop)}{v.price.pending && <PendingTag p={v.price.pending} />}</td>
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

/** Add or change the cost of one vendor: price per shop, travelling cost, skills (pick from the list or add a new one). */
function VendorCostDialog({ vendor, onClose }: { vendor: ZohoVendorRow; onClose: () => void }) {
  const toast = useToast();
  const save = useSetZohoPrice();
  const skills = useVendorSkills();
  const addSkill = useAddVendorSkill();
  const company = useCompanyRates().data;
  // Untouched boxes show the vendor's own cost, else the company rate set by the Super Admin.
  const [typedRate, setRate] = useState<string | null>(vendor.price.ratePerShop != null ? String(vendor.price.ratePerShop) : null);
  const [typedFar, setFar] = useState<string | null>(vendor.price.farRatePerShop != null ? String(vendor.price.farRatePerShop) : null);
  const rate = typedRate ?? (company ? String(company.ratePerShop) : "");
  const far = typedFar ?? (company && vendor.price.ratePerShop == null ? String(company.farRatePerShop) : "");
  const over = !!company && ((rate.trim() !== "" && Number(rate) > company.ratePerShop) || (far.trim() !== "" && Number(far) > company.farRatePerShop));
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
    else if (r != null && f != null && f < r) e.far = "Travelling cost cannot be lower than the price per shop";
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate({ contactId: vendor.zohoContactId, ratePerShop: r, farRatePerShop: f, skills: picked }, { onSuccess: (p) => { toast(p.pending ? `${vendor.name}: ${money(p.pending.ratePerShop)} is above the company rate ${money(p.pending.limitRate)}. Sent for approval; the current cost stays until the reply.` : `${vendor.name}: cost saved`); onClose(); }, onError: (err) => toast(errorMessage(err), "error") });
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
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="bg-vendor hover:bg-vendor/90" loading={save.isPending} onClick={submit}>{over ? "Send for approval" : "Save cost"}</Button></div>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price per shop (₹)" htmlFor="c-rate" required error={errors.rate} hint={company ? `Company rate ₹${company.ratePerShop}` : undefined}><Input id="c-rate" format="decimal" maxLength={7} value={rate} onChange={(e) => { setRate(e.target.value); setErrors((x) => ({ ...x, rate: "" })); }} aria-invalid={!!errors.rate} autoFocus /></Field>
          <Field label="Travelling cost (₹)" htmlFor="c-far" error={errors.far} hint={company ? `Company rate ₹${company.farRatePerShop}. Optional, not lower than the price per shop` : "Optional. Not lower than the price per shop"}><Input id="c-far" format="decimal" maxLength={7} value={far} onChange={(e) => { setFar(e.target.value); setErrors((x) => ({ ...x, far: "" })); }} aria-invalid={!!errors.far} /></Field>
        </div>
        {over && company && (
          <p role="status" className="rounded-lg border border-[#fbd9b5] bg-[#fff4e6] px-3 py-2 text-sm text-[#9a3412]">
            This is above the company rate (₹{company.ratePerShop} / travelling cost ₹{company.farRatePerShop}). Saving sends an approval email. The current cost stays until the approver replies: APPROVED applies this amount, NOT APPROVED applies the company rate.
          </p>
        )}
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
