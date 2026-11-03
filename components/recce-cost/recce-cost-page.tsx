"use client";

import { useState } from "react";
import { BedDouble, Car, Check, History, Plus, ReceiptIndianRupee, ShieldCheck, Utensils, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useProjects } from "@/lib/api/projects";
import { useVendors } from "@/lib/api/vendors";
import { STATUS_LABEL, label, useApplyVendorCost, useRateHistory, useRates, useReport, useReviewTrip, useSaveRates, type RateVersion, useSaveVendorRate, useTrips, useVendorCosts, useVendorRates, type Trip, type TripStatus } from "@/lib/api/recce-cost";
import { cn } from "@/lib/utils";
import { TripEditor } from "./trip-editor";

const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN")}`;
const TONE: Record<TripStatus, "neutral" | "warning" | "success" | "danger"> = { DRAFT: "neutral", SUBMITTED: "warning", UNDER_REVIEW: "warning", APPROVED: "success", REJECTED: "danger", SETTLED: "success" };
const D = (v: string) => v.replace(/[^\d.]/g, "").slice(0, 9);

function TripTable({ rows, onOpen, reviewer, onReview }: { rows: Trip[]; onOpen: (t: Trip) => void; reviewer?: boolean; onReview?: (t: Trip) => void }) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-surface shadow-soft">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-3">Trip date</th><th>Project</th>{reviewer && <th>Employee</th>}<th>Transport</th><th className="text-right">Claim</th><th>Status</th><th>Created / updated</th><th /></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t._id} className="border-t border-border hover:bg-muted/50">
              <td className="p-3 whitespace-nowrap">{formatDate(t.startAt)}</td>
              <td>{t.projectCode} <span className="text-muted-foreground">{t.clientCode}</span></td>
              {reviewer && <td>{t.employeeName}</td>}
              <td>{t.transportType === "PRIVATE" ? `Own vehicle${t.calc.distanceKm ? ` · ${t.calc.distanceKm} km` : ""}` : "Public"}</td>
              <td className="text-right tabular-nums">{inr(t.approved?.total ?? t.calc.total)}{t.flags.length > 0 && <span title={t.flags.join(", ")} className="ml-1 text-approval">⚑</span>}</td>
              <td><Badge tone={TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></td>
              <td className="text-xs text-muted-foreground whitespace-nowrap">{t.createdAt ? formatDate(t.createdAt) : "–"}<br />{t.updatedAt ? `updated ${formatDate(t.updatedAt)}` : ""}</td>
              <td className="pr-3 text-right whitespace-nowrap">
                <Button size="sm" variant="outline" onClick={() => onOpen(t)}>Open</Button>
                {reviewer && onReview && t.status !== "DRAFT" && t.status !== "SETTLED" && <Button size="sm" className="ml-2" onClick={() => onReview(t)}>Review</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const review = useReviewTrip();
  const [remark, setRemark] = useState("");
  const [a, setA] = useState({ transport: String(trip.calc.transport), food: String(trip.calc.food.claimed), stay: String(trip.calc.stay.claimed), misc: String(trip.calc.misc) });
  const [exc, setExc] = useState("");
  const decider = user?.role === "FINANCE" || user?.role === "SUPER_ADMIN";
  const run = (action: "START_REVIEW" | "APPROVE" | "REJECT" | "SETTLE") =>
    review.mutate(
      { id: trip._id, action, remark: remark || undefined, approved: action === "APPROVE" ? { transport: Number(a.transport), food: Number(a.food), stay: Number(a.stay), misc: Number(a.misc) } : undefined, stayException: exc ? { reason: exc } : undefined },
      { onSuccess: () => { toast("Updated"); onClose(); }, onError: (e) => toast(Object.values(fieldErrorsOf(e))[0] ?? errorMessage(e), "error") },
    );
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} persistent title={`Review · ${trip.projectCode} · ${trip.employeeName}`} description={`Claimed ${inr(trip.calc.total)} · ${STATUS_LABEL[trip.status]}`}
      footer={<div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {trip.status === "SUBMITTED" && <Button variant="outline" onClick={() => run("START_REVIEW")}>Take for review</Button>}
        {decider && (trip.status === "SUBMITTED" || trip.status === "UNDER_REVIEW") && <><Button variant="outline" onClick={() => run("REJECT")}><X className="size-4" /> Reject</Button><Button onClick={() => run("APPROVE")}><Check className="size-4" /> Approve</Button></>}
        {decider && trip.status === "APPROVED" && <Button onClick={() => run("SETTLE")}>Mark settled</Button>}
      </div>}>
      <div className="space-y-3 text-sm">
        {trip.flags.length > 0 && <p className="rounded-lg bg-[#fff4e5] p-2 text-approval">Flags: {trip.flags.map(label).join(", ")}</p>}
        {trip.calc.stay.claimed > 0 && !trip.calc.stay.eligible && <Field label="Stay exception reason (Admin)" htmlFor="rv-exc"><Input id="rv-exc" value={exc} onChange={(e) => setExc(e.target.value)} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          {(["transport", "food", "stay", "misc"] as const).map((k) => <Field key={k} label={`${label(k)} approved (₹)`} htmlFor={`rv-${k}`}><Input id={`rv-${k}`} inputMode="decimal" value={a[k]} onChange={(e) => setA({ ...a, [k]: D(e.target.value) })} /></Field>)}
        </div>
        <Field label="Remark" htmlFor="rv-rem" hint="Required to reject, or when you change an amount"><Input id="rv-rem" maxLength={500} value={remark} onChange={(e) => setRemark(e.target.value)} /></Field>
        <ol className="max-h-40 space-y-1 overflow-auto border-t border-border pt-2 text-xs text-muted-foreground">{trip.history.map((h, i) => <li key={i}>{formatDate(h.at)} · {h.byName ?? "System"} · {h.action}{h.to ? ` → ${h.to}` : ""}{h.remark ? ` · ${h.remark}` : ""}</li>)}</ol>
      </div>
    </Modal>
  );
}

const RATE_GROUPS: { title: string; hint: string; icon: LucideIcon; tone: string; fields: [string, string, string][] }[] = [
  { title: "Transport", hint: "Own vehicle claims", icon: Car, tone: "from-[#1d4ed8] to-[#2563eb]", fields: [["kmRate", "Rate per km", "₹ / km"], ["maxTripKm", "Flag trips above", "km"]] },
  { title: "Food", hint: "Meals are suggested from the trip start and end time", icon: Utensils, tone: "from-[#c2410c] to-[#f97316]", fields: [["dailyFoodMax", "Daily maximum", "₹ / day"], ["mealMinOverlapMinutes", "Minimum time inside a meal window", "minutes"]] },
  { title: "Stay", hint: "Eligible when either limit is reached", icon: BedDouble, tone: "from-[#6d28d9] to-[#9333ea]", fields: [["stayDistanceKm", "Distance from", "km"], ["stayDurationHours", "Travel time from", "hours"], ["stayPerNight", "Allowance per night", "₹ / night"], ["stayMaxAmount", "Maximum stay amount", "₹"]] },
  { title: "Bills & approval", hint: "When proof or Admin approval is needed", icon: ShieldCheck, tone: "from-[#047857] to-[#10b981]", fields: [["receiptRequiredAbove", "Bill required above", "₹"], ["adminApprovalAbove", "Admin approval above", "₹"]] },
];
const MEALS = ["breakfast", "lunch", "dinner"] as const;
const FIELD_LABEL: Record<string, string> = Object.fromEntries(RATE_GROUPS.flatMap((g) => g.fields.map(([k, l]) => [k, l])));
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** What changed from the older version to this one, in plain words. */
function changesOf(v: RateVersion, older?: RateVersion): string[] {
  if (!older) return ["First version"];
  const a = v as unknown as Record<string, unknown>;
  const b = older as unknown as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(FIELD_LABEL)) if (a[k] !== b[k]) out.push(`${FIELD_LABEL[k]}: ${b[k]} → ${a[k]}`);
  if (v.stayOrigin !== older.stayOrigin) out.push(`Stay origin: ${label(older.stayOrigin)} → ${label(v.stayOrigin)}`);
  for (const m of MEALS) {
    const x = v[m];
    const y = older[m];
    if (x.amount !== y.amount) out.push(`${label(m)}: ₹${y.amount} → ₹${x.amount}`);
    if (x.from !== y.from || x.to !== y.to) out.push(`${label(m)} window: ${y.from}-${y.to} → ${x.from}-${x.to}`);
  }
  return out.length ? out : ["Saved without changes"];
}

function RatesTab() {
  const toast = useToast();
  const cur = useRates();
  const hist = useRateHistory(true);
  const save = useSaveRates();
  const [f, setF] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (cur.isPending) return <RowsSkeleton rows={6} />;
  if (cur.isError) return <ErrorState error={cur.error} onRetry={() => cur.refetch()} title="Could not load the rates" />;
  const r = cur.data.rates as unknown as Record<string, string | number | Record<string, string | number>>;
  const base = (k: string) => String(r[k]);
  const v = (k: string) => f[k] ?? base(k);
  const mealBase = (m: string, p: string) => String((r[m] as Record<string, string | number>)[p]);
  const mv = (m: string, p: string) => f[`${m}.${p}`] ?? mealBase(m, p);
  const pending = Object.keys(f)
    .filter((k) => !["effectiveFrom", "note", "stayOrigin"].includes(k))
    .flatMap((k) => {
      const [m, p] = k.split(".");
      const was = p ? mealBase(m!, p) : base(k);
      return f[k] === was ? [] : [`${FIELD_LABEL[k] ?? label(k.replace(".", " "))}: ${was} → ${f[k]}`];
    });
  const history = hist.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const currentId = cur.data.version;

  function submit() {
    const meal = (m: string) => ({ from: mv(m, "from"), to: mv(m, "to"), amount: Number(mv(m, "amount")) });
    const body: Record<string, unknown> = { effectiveFrom: f.effectiveFrom || today, stayOrigin: f.stayOrigin ?? r.stayOrigin, breakfast: meal("breakfast"), lunch: meal("lunch"), dinner: meal("dinner"), note: f.note || undefined };
    for (const k of Object.keys(FIELD_LABEL)) body[k] = Number(v(k));
    save.mutate(body, { onSuccess: () => { toast("New rate version saved"); setF({}); setErrors({}); }, onError: (e) => { const fe = fieldErrorsOf(e); setErrors(fe); toast(Object.values(fe)[0] ?? errorMessage(e), "error"); } });
  }
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-[#eef4ff] p-3 text-sm text-navy">
          <b>In force now:</b> ₹{base("kmRate")}/km · food ₹{base("dailyFoodMax")}/day · stay from {base("stayDistanceKm")} km or {base("stayDurationHours")} h · ₹{base("stayPerNight")}/night
          <span className="text-muted-foreground">· A new version never changes claims that are already submitted.</span>
        </div>
        {RATE_GROUPS.map((g) => (
          <section key={g.title} className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
            <header className={cn("flex items-center gap-2.5 bg-gradient-to-r px-3 py-2 text-white", g.tone)}><g.icon className="size-5" /><div><p className="font-semibold">{g.title}</p><p className="text-xs opacity-90">{g.hint}</p></div></header>
            <div className="space-y-2.5 p-3">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {g.fields.map(([k, l, unit]) => <Field key={k} label={l} htmlFor={`rt-${k}`} hint={unit} error={errors[k]}><Input id={`rt-${k}`} inputMode="decimal" value={v(k)} onChange={(e) => setF({ ...f, [k]: D(e.target.value) })} /></Field>)}
                {g.title === "Stay" && <Field label="Trip starts from" htmlFor="rt-or" hint="Where the distance is counted from"><Select id="rt-or" value={f.stayOrigin ?? String(r.stayOrigin)} onChange={(e) => setF({ ...f, stayOrigin: e.target.value })}><option value="OFFICE">Company office</option><option value="CURRENT_LOCATION">Authorised current location</option></Select></Field>}
              </div>
              {g.title === "Food" && MEALS.map((m) => (
                <div key={m} className="grid items-end gap-2.5 rounded-lg bg-muted/60 p-2 sm:grid-cols-3">
                  <Field label={`${label(m)} from`} htmlFor={`rt-${m}f`} error={errors[`${m}.from`]}><Input id={`rt-${m}f`} type="time" value={mv(m, "from")} onChange={(e) => setF({ ...f, [`${m}.from`]: e.target.value })} /></Field>
                  <Field label="to" htmlFor={`rt-${m}t`}><Input id={`rt-${m}t`} type="time" value={mv(m, "to")} onChange={(e) => setF({ ...f, [`${m}.to`]: e.target.value })} /></Field>
                  <Field label="Amount" htmlFor={`rt-${m}a`} hint="₹ per meal"><Input id={`rt-${m}a`} inputMode="decimal" value={mv(m, "amount")} onChange={(e) => setF({ ...f, [`${m}.amount`]: D(e.target.value) })} /></Field>
                </div>
              ))}
            </div>
          </section>
        ))}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft">
          <Field label="Effective from" htmlFor="rt-eff" className="w-44"><Input id="rt-eff" type="date" value={f.effectiveFrom ?? today} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
          <Field label="Reason for change" htmlFor="rt-note" className="min-w-48 flex-1"><Input id="rt-note" maxLength={300} placeholder="e.g. Fuel price revision" value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <Button variant="outline" disabled={!Object.keys(f).length} onClick={() => { setF({}); setErrors({}); }}>Reset</Button>
          <Button onClick={submit} disabled={save.isPending}>{pending.length ? `Save ${pending.length} change${pending.length > 1 ? "s" : ""}` : "Save new version"}</Button>
          {pending.length > 0 && <p className="w-full text-xs text-muted-foreground">Changing: {pending.join(" · ")}</p>}
        </div>
      </div>

      <aside className="rounded-xl border border-border bg-surface p-3 shadow-soft xl:sticky xl:top-0 xl:h-fit">
        <p className="mb-2 flex items-center gap-2 font-semibold text-navy"><History className="size-4" /> Change history</p>
        {hist.isPending ? <RowsSkeleton rows={3} /> : history.length === 0 ? <p className="text-sm text-muted-foreground">Company defaults are in use. Save once to start the history.</p> : (
          <ol className="max-h-[70vh] space-y-2 overflow-auto border-l-2 border-border pl-3">
            {history.map((h, i) => {
              const state = h._id === currentId ? "Current" : h.effectiveFrom.slice(0, 10) > today ? "Scheduled" : "Past";
              return (
                <li key={h._id} className="relative rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span className={cn("absolute -left-[19px] top-3 size-2.5 rounded-full border-2 border-surface", state === "Current" ? "bg-finance" : state === "Scheduled" ? "bg-approval" : "bg-muted-foreground")} />
                  <div className="flex items-center justify-between gap-2"><b>From {formatDate(h.effectiveFrom)}</b><Badge tone={state === "Current" ? "success" : state === "Scheduled" ? "warning" : "neutral"}>{state}</Badge></div>
                  <ul className="mt-0.5 list-disc pl-4 text-xs leading-snug">{changesOf(h, history[i + 1]).map((c) => <li key={c}>{c}</li>)}</ul>
                  {h.note && <p className="text-xs italic leading-snug">“{h.note}”</p>}
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{when(h.createdAt)} · {h.createdBy?.name ?? "system"}{h.updatedAt && new Date(h.updatedAt).getTime() - new Date(h.createdAt).getTime() > 60000 ? ` · updated ${when(h.updatedAt)}` : ""}</p>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </div>
  );
}

function VendorTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const rates = useVendorRates(true);
  const costs = useVendorCosts(true);
  const vendors = useVendors({ limit: 100 });
  const projects = useProjects({ limit: 100 });
  const save = useSaveVendorRate();
  const apply = useApplyVendorCost();
  const [f, setF] = useState<Record<string, string>>({ effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [ap, setAp] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const NUM = ["ratePerShop", "ratePerDay", "ratePerLocation", "fixedProjectRate", "travelCharges", "stayCharges", "otherCharges"];
  const err = (e: unknown) => { const fe = fieldErrorsOf(e); setErrors(fe); toast(Object.values(fe)[0] ?? errorMessage(e), "error"); };
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-soft">
          <p className="font-semibold text-navy">New vendor rate plan</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Vendor" htmlFor="vr-v" error={errors.vendorId}><Select id="vr-v" value={f.vendorId ?? ""} onChange={(e) => set("vendorId", e.target.value)}><option value="">Choose…</option>{(vendors.data?.data ?? []).map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}</Select></Field>
            <Field label="Recce type" htmlFor="vr-t" error={errors.recceType}><Input id="vr-t" maxLength={60} value={f.recceType ?? ""} onChange={(e) => set("recceType", e.target.value)} /></Field>
            <Field label="Effective from" htmlFor="vr-f"><Input id="vr-f" type="date" value={f.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} /></Field>
            <Field label="Effective to" htmlFor="vr-to" error={errors.effectiveTo}><Input id="vr-to" type="date" value={f.effectiveTo ?? ""} onChange={(e) => set("effectiveTo", e.target.value)} /></Field>
            {NUM.map((k) => <Field key={k} label={`${label(k.replace(/([A-Z])/g, "_$1"))} (₹)`} htmlFor={`vr-${k}`} error={errors[k]}><Input id={`vr-${k}`} inputMode="decimal" value={f[k] ?? ""} onChange={(e) => set(k, D(e.target.value))} /></Field>)}
          </div>
          <Button disabled={save.isPending} onClick={() => save.mutate({ body: { ...f, ...Object.fromEntries(NUM.map((k) => [k, Number(f[k] || 0)])), effectiveTo: f.effectiveTo || undefined } }, { onSuccess: () => { toast("Rate plan saved"); setErrors({}); }, onError: err })}>Save rate plan</Button>
        </div>
      )}
      <div className="max-h-[40vh] overflow-auto rounded-xl border border-border bg-surface shadow-soft">
        <table className="w-full text-sm"><thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-3">Vendor</th><th>Type</th><th>/Shop</th><th>/Day</th><th>/Location</th><th>Fixed</th><th>Extras</th><th>From</th><th>To</th></tr></thead>
          <tbody>{(rates.data ?? []).map((r) => <tr key={r._id} className="border-t border-border"><td className="p-3">{r.vendor?.name}</td><td>{r.recceType}</td><td>{inr(r.ratePerShop)}</td><td>{inr(r.ratePerDay)}</td><td>{inr(r.ratePerLocation)}</td><td>{inr(r.fixedProjectRate)}</td><td>{inr(r.travelCharges + r.stayCharges + r.otherCharges)}</td><td>{formatDate(r.effectiveFrom)}</td><td>{r.effectiveTo ? formatDate(r.effectiveTo) : "open"}</td></tr>)}</tbody></table>
        {rates.data?.length === 0 && <EmptyState title="No vendor rate plans yet" />}
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-soft">
        <p className="font-semibold text-navy">Apply a vendor rate to a project</p>
        <div className="grid gap-3 sm:grid-cols-6">
          <Select aria-label="Project" className="sm:col-span-2" value={ap.projectId ?? ""} onChange={(e) => setAp({ ...ap, projectId: e.target.value })}><option value="">Project…</option>{(projects.data?.data ?? []).map((p) => <option key={p._id} value={p._id}>{p.code} · {p.campaign ?? p.name}</option>)}</Select>
          <Select aria-label="Vendor" value={ap.vendorId ?? ""} onChange={(e) => setAp({ ...ap, vendorId: e.target.value })}><option value="">Vendor…</option>{(vendors.data?.data ?? []).map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}</Select>
          <Input aria-label="Recce type" placeholder="Recce type" value={ap.recceType ?? ""} onChange={(e) => setAp({ ...ap, recceType: e.target.value })} />
          <Input aria-label="Shops" placeholder="Shops" inputMode="numeric" value={ap.shops ?? ""} onChange={(e) => setAp({ ...ap, shops: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
          <Button disabled={apply.isPending || !ap.projectId} onClick={() => apply.mutate({ projectId: ap.projectId!, body: { vendorId: ap.vendorId, recceType: ap.recceType, shops: Number(ap.shops || 0) } }, { onSuccess: () => toast("Vendor cost applied"), onError: err })}>Apply</Button>
        </div>
        <ul className="divide-y divide-border text-sm">{(costs.data ?? []).map((c) => <li key={c._id} className="flex justify-between py-2"><span>{c.projectCode} · {c.vendor?.name} · {c.recceType} · {c.shops} shops</span><b className="tabular-nums">{inr(c.total)}</b></li>)}</ul>
      </div>
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: { key: string; total: number }[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-soft"><p className="mb-2 font-semibold text-navy">{title}</p>
      <ul className="max-h-60 space-y-1 overflow-auto text-sm">{rows.map((r) => <li key={r.key} className="flex justify-between"><span>{r.key}</span><b className="tabular-nums">{inr(r.total)}</b></li>)}{rows.length === 0 && <li className="text-muted-foreground">No data yet</li>}</ul></div>
  );
}

function ReportTab() {
  const q = useReport(true);
  if (q.isPending) return <RowsSkeleton rows={5} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the report" />;
  const d = q.data;
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-[#eef4ff] p-3 text-sm text-navy">Internal cost only. These amounts are never added to client invoices, quotations or receivables.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["Total internal cost", d.totals.total], ["In-house recce", d.totals.inHouse], ["Vendor recce", d.totals.vendor], ["Waiting for approval", d.totals.pendingApproval]] as const).map(([l, v]) => <div key={l} className="rounded-xl border border-border bg-surface p-3 shadow-soft"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold tabular-nums text-navy">{inr(v)}</p></div>)}
      </div>
      <div className="flex flex-wrap gap-2">{Object.entries(d.categories).map(([k, v]) => <span key={k} className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-medium text-navy">{label(k)} {inr(v)}</span>)}</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Block title="Client-wise" rows={d.byClient} /><Block title="Project-wise" rows={d.byProject} /><Block title="Employee-wise" rows={d.byEmployee} /><Block title="Vendor-wise" rows={d.byVendor} /><Block title="Date-wise" rows={d.byDate} /></div>
    </div>
  );
}

export function RecceCostPage() {
  const { can } = useAuth();
  const canSubmit = can("recce-cost:submit");
  const canReview = can("recce-cost:review");
  const isAdminish = can("finance:manage");
  const tabs = [
    ...(canSubmit ? [{ key: "mine", label: "My claims" }] : []),
    ...(canReview ? [{ key: "review", label: "Review" }] : []),
    ...(canReview || isAdminish ? [{ key: "vendor", label: "Vendor rates" }, { key: "report", label: "Cost report" }] : []),
    ...(isAdminish ? [{ key: "rates", label: "Rate settings" }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.key ?? "mine");
  const [editing, setEditing] = useState<Trip | null | undefined>(undefined);
  const [reviewing, setReviewing] = useState<Trip | null>(null);
  const mine = useTrips({ mine: true });
  const all = useTrips({}, );
  const list = tab === "review" ? all : mine;

  return (
    <div className="space-y-2.5 p-3">
      <PageHeader icon={ReceiptIndianRupee} title="Recce price management" subtitle="Travel, food, stay and small expenses for recce trips. Internal cost tracking: not billed to clients."
        actions={tab === "mine" && canSubmit ? <Button onClick={() => setEditing(null)}><Plus className="size-4" /> New claim</Button> : undefined} />
      <Tabs label="Recce cost sections" value={tab} onChange={setTab} tabs={tabs} />
      {(tab === "mine" || tab === "review") && (
        list.isPending ? <RowsSkeleton rows={5} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} title="Could not load claims" /> :
        list.data.length === 0 ? <EmptyState title="No claims yet" description={tab === "mine" ? "Start a claim after your recce trip." : "Submitted claims will appear here."} /> :
        <TripTable rows={tab === "review" ? list.data.filter((t) => t.status !== "DRAFT") : list.data} reviewer={tab === "review"} onOpen={(t) => setEditing(t)} onReview={setReviewing} />
      )}
      {tab === "vendor" && <VendorTab canEdit={isAdminish} />}
      {tab === "report" && <ReportTab />}
      {tab === "rates" && <RatesTab />}
      {editing !== undefined && <TripEditor trip={editing} onClose={() => setEditing(undefined)} />}
      {reviewing && <ReviewModal trip={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}
