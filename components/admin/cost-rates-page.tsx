"use client";

import { useState } from "react";
import { BedDouble, Gauge, IndianRupee, Save, Store, Utensils, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { usePolicy, useSavePolicy, type CostRates } from "@/lib/api/costing";
import { useAuth } from "@/lib/auth";

interface Item { key: keyof CostRates; label: string; hint: string; unit: string }
const GROUPS: { title: string; icon: LucideIcon; tone: string; items: Item[] }[] = [
  {
    title: "In-house team", icon: BedDouble, tone: "from-[#047857] to-[#10b981]",
    items: [
      { key: "stayPerNight", label: "Stay per night", hint: "Hotel / room rent. Usually ₹400 to ₹500", unit: "₹ / night" },
      { key: "foodPerDay", label: "Food per day", hint: "Three meals together. Each meal is a third, counted from the trip's start and end time", unit: "₹ / day" },
      { key: "fuelRatePerKm", label: "Fuel", hint: "For every km of the route", unit: "₹ / km" },
    ],
  },
  {
    title: "Vendor", icon: Store, tone: "from-[#6d28d9] to-[#9333ea]",
    items: [
      { key: "vendorRatePerShop", label: "Price per shop", hint: "Standard price when the vendor has no rate card", unit: "₹ / shop" },
      { key: "vendorFarRatePerShop", label: "Far-area price per shop", hint: "Used when the area is far from the start point", unit: "₹ / shop" },
      { key: "vendorFarKm", label: "Counts as far from", hint: "One-way distance from the start point", unit: "km" },
    ],
  },
  {
    title: "Limits (special approval)", icon: Gauge, tone: "from-[#c2410c] to-[#f97316]",
    items: [
      { key: "thresholdPerShop", label: "Limit per shop", hint: "Above this (vendor bargained too high, or in-house too costly) admin must approve", unit: "₹ / shop" },
      { key: "worstCasePerShop", label: "Worst case per shop", hint: "In-house at or above this is flagged as the worst case", unit: "₹ / shop" },
      { key: "overVendorPercent", label: "In-house over vendor", hint: "In-house costing more than this % above the vendor needs approval", unit: "%" },
    ],
  },
];

/** Admin fixes the company rates every recce plan is priced with. */
export function CostRatesPage() {
  const toast = useToast();
  const { can } = useAuth();
  const q = usePolicy();
  const save = useSavePolicy();
  const [typed, setTyped] = useState<Partial<Record<keyof CostRates, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = can("finance:manage");

  if (q.isPending) return <RowsSkeleton rows={6} className="p-4" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the rates" />;
  const rates = q.data;
  const value = (k: keyof CostRates) => typed[k] ?? String(rates[k]);
  const dirty = Object.entries(typed).some(([k, v]) => v !== String(rates[k as keyof CostRates]));

  function submit() {
    const e: Record<string, string> = {};
    const body: Partial<CostRates> = {};
    for (const [k, v] of Object.entries(typed) as [keyof CostRates, string][]) {
      if (v.trim() === "" || !(Number(v) >= 0)) e[k] = "Enter a number, 0 or more";
      else body[k] = Number(v);
    }
    const num = (k: keyof CostRates) => body[k] ?? rates[k];
    if (num("vendorFarRatePerShop") < num("vendorRatePerShop")) e.vendorFarRatePerShop = "The far price cannot be lower than the standard price";
    if (num("thresholdPerShop") < num("vendorRatePerShop")) e.thresholdPerShop = "The limit cannot be below the vendor price";
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate(body, {
      onSuccess: () => { toast("Rates saved. New plans use them; existing plans keep theirs until refreshed"); setTyped({}); },
      onError: (err) => { const fe = fieldErrorsOf(err); if (Object.keys(fe).length) setErrors(fe); else toast(errorMessage(err), "error"); },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-navy"><IndianRupee className="size-5 text-royal" aria-hidden /> Cost rates</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Fixed by admin. Operations cannot change them; every recce plan is priced with these rates. A plan keeps the rates it started with until Operations chooses &ldquo;use the latest rates&rdquo;.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <section key={g.title} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
            <div className={`flex items-center gap-2 bg-gradient-to-r px-4 py-3 text-white ${g.tone}`}><g.icon className="size-5" aria-hidden /><h2 className="text-sm font-bold">{g.title}</h2></div>
            <div className="space-y-4 p-4">
              {g.items.map((it) => (
                <Field key={it.key} label={`${it.label} (${it.unit})`} htmlFor={`rate-${it.key}`} hint={it.hint} error={errors[it.key]}>
                  <Input id={`rate-${it.key}`} format="decimal" disabled={!canEdit} value={value(it.key)} onChange={(e) => setTyped((t) => ({ ...t, [it.key]: e.target.value }))} aria-invalid={!!errors[it.key]} />
                </Field>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4 text-sm shadow-soft">
        <span className="flex items-center gap-2 font-semibold text-navy"><Utensils className="size-4 text-finance" aria-hidden /> Meal times used</span>
        <span className="text-muted-foreground">Breakfast 8:00 · Lunch 1:00 pm · Dinner 8:00 pm. A meal counts when it falls between the trip&apos;s start and end.</span>
      </section>

      {canEdit ? (
        <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
          <p className="text-sm text-muted-foreground">{dirty ? "You have unsaved changes." : "All rates are saved."}</p>
          <div className="flex gap-2">
            {dirty && <Button variant="outline" onClick={() => { setTyped({}); setErrors({}); }}>Discard</Button>}
            <Button className="bg-royal hover:bg-royal/90" disabled={!dirty} loading={save.isPending} onClick={submit}><Save className="size-4" aria-hidden /> Save rates</Button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-[#eef4ff] p-3 text-sm text-navy">Only an administrator can change these rates.</p>
      )}
    </div>
  );
}
