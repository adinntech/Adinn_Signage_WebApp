"use client";

import { useMemo, useState } from "react";
import { Calculator, ClipboardCheck, Layers, Receipt, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { fetchLegLinks, legToInput, useCost, useRouteLeg, useSavePlan, useSyncPlan, type LegInput, type LegLinks, type PlanStatus, type RouteInfo } from "@/lib/api/costing";
import { useActiveVendors } from "@/lib/api/vendors";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ExpenseClaims } from "./expense-claims";
import { LegCard, inr } from "./plan/leg-card";
import { PlanReview } from "./plan/plan-review";
import { PlanShops } from "./plan/plan-shops";

type Step = "shops" | "compare" | "review" | "bills";
const STATUS: Record<PlanStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "info" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  APPROVAL_PENDING: { label: "Waiting for admin", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  ASSIGNED: { label: "Shops assigned", tone: "info" },
};

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone: string }) {
  return (
    <div className={cn("rounded-xl p-3", tone)}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs opacity-80">{sub}</p>}
    </div>
  );
}

/**
 * Recce plan & cost comparison for one project, in four steps: the shops by district → compare in-house and vendor for each
 * district and choose → final review, approval and assignment → the team's bills.
 */
export function CostComparison({ projectId, closed }: { projectId: string; closed: boolean }) {
  const toast = useToast();
  const { can } = useAuth();
  const q = useCost(projectId);
  const vendors = useActiveVendors(!closed);
  const sync = useSyncPlan(projectId);
  const save = useSavePlan(projectId);
  const routeM = useRouteLeg(projectId);
  const [step, setStep] = useState<Step>("shops");
  const [draft, setDraft] = useState<{ base: string; legs: LegInput[] } | null>(null);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [routes, setRoutes] = useState<Record<string, RouteInfo>>({});
  const [routing, setRouting] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, LegLinks>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(false);

  const view = q.data;
  const serverLegs = useMemo(() => (view?.plan.legs ?? []).map(legToInput), [view]);
  const base = useMemo(() => JSON.stringify(serverLegs), [serverLegs]);
  // The editable copy follows the server; once something is typed it is kept until it is saved or discarded.
  const legs = draft && draft.base === base ? draft.legs : serverLegs;
  const dirty = JSON.stringify(legs) !== base;

  if (q.isPending) return <RowsSkeleton rows={6} />;
  if (q.isError || !view) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the recce plan" />;
  const { plan, totals } = view;
  const canEdit = can("sites:write") && !closed && plan.clientDecision !== "ACCEPTED";
  const st = STATUS[plan.status];
  const changed = new Set(legs.filter((l, i) => JSON.stringify(l) !== JSON.stringify(serverLegs[i])).map((l) => l.key));

  const setLeg = (key: string, patch: Partial<LegInput>) => setDraft({ base, legs: legs.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  function saveAll(then?: () => void) {
    setErrors({});
    save.mutate({ legs, refreshRates: refresh }, {
      onSuccess: () => { toast("Plan saved and recalculated"); setRefresh(false); then?.(); },
      onError: (e) => {
        const fe = fieldErrorsOf(e);
        const next: Record<string, Record<string, string>> = {};
        for (const [path, msg] of Object.entries(fe)) {
          const m = /^legs\.(\d+)\.(.+)$/.exec(path);
          const key = m ? legs[Number(m[1])]?.key : undefined;
          if (m && key) (next[key] ??= {})[m[2]!] = msg;
        }
        if (Object.keys(next).length) { setErrors(next); toast("Some areas need a correction", "error"); } else toast(errorMessage(e), "error");
      },
    });
  }

  async function calcRoute(key: string) {
    setRouting(key);
    try {
      if (dirty) await save.mutateAsync({ legs, refreshRates: refresh });
      const r = await routeM.mutateAsync(key);
      setRoutes((s) => ({ ...s, [key]: r.route }));
      toast(`Route: ${r.route.totalKm} km over ${r.route.days.length} day(s)`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setRouting(null);
    }
  }

  async function showLinks(key: string) {
    setLinking(key);
    try {
      if (dirty) await save.mutateAsync({ legs, refreshRates: refresh });
      const r = await fetchLegLinks(projectId, key);
      setLinks((s) => ({ ...s, [key]: r }));
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLinking(null);
    }
  }

  const pending = plan.legs.filter((l) => !l.channel).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Shops" value={totals.shops || view.shopsRecorded} sub={`${view.districts.length} district(s)`} tone="bg-[#e8f0ff] text-royal" />
        <Tile label="In-house" value={totals.inHouseShops} sub="shops" tone="bg-[#e2f8ea] text-finance" />
        <Tile label="Vendors" value={totals.vendorShops} sub="shops" tone="bg-[#f1e6ff] text-vendor" />
        <Tile label="Plan cost" value={totals.chosenLegs ? inr(totals.chosenTotal) : "–"} sub={totals.perShop ? `${inr(totals.perShop)} per shop` : pending ? `${pending} area(s) not chosen` : ""} tone="bg-[#fff0e0] text-approval" />
        <div className="flex flex-col justify-center gap-1 rounded-xl border border-border bg-surface p-3"><p className="text-xs font-medium text-muted-foreground">Plan status</p><Badge tone={st.tone} className="w-fit">{st.label}</Badge></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <Tabs
          label="Recce plan steps"
          value={step}
          onChange={(k) => setStep(k as Step)}
          tabs={[
            { key: "shops", label: "1 · Shops & districts", icon: Layers },
            { key: "compare", label: "2 · Compare & choose", icon: Calculator, count: plan.legs.length ? `${plan.legs.length - pending}/${plan.legs.length}` : undefined },
            { key: "review", label: "3 · Final review", icon: ClipboardCheck },
            { key: "bills", label: "4 · Bills & expenses", icon: Receipt },
          ]}
        />
        <TabPanel k={step} className="space-y-4 bg-[#f7f9fd] p-4">
          {step === "shops" && <PlanShops projectId={projectId} view={view} canEdit={canEdit} syncing={sync.isPending} onSync={() => sync.mutate(undefined, { onSuccess: (r) => { toast(`${r.plan.legs.length} area(s) in the plan`); setStep("compare"); }, onError: (e) => toast(errorMessage(e), "error") })} />}

          {step === "compare" && (
            plan.legs.length === 0 ? (
              <EmptyState icon={Layers} title="No areas in the plan yet" description="Create the plan from the shops in step 1. Each district becomes one area you can price both ways." action={<Button className="bg-royal hover:bg-royal/90" onClick={() => setStep("shops")}>Go to step 1</Button>} />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-navy">Rates fixed by admin:</span>
                  <span>Stay {inr(view.rates.stayPerNight)}/night</span><span>· Food {inr(view.rates.foodPerDay)}/day (3 meals)</span><span>· Fuel ₹{view.rates.fuelRatePerKm}/km</span><span>· Vendor {inr(view.rates.vendorRatePerShop)}/shop</span><span>· Limit {inr(view.rates.thresholdPerShop)}/shop</span>
                  {canEdit && <label className="ml-auto flex items-center gap-1.5"><input type="checkbox" checked={refresh} onChange={(e) => setRefresh(e.target.checked)} /> Use the latest rates when saving</label>}
                </div>
                {plan.legs.map((leg) => {
                  const d = legs.find((l) => l.key === leg.key) ?? legToInput(leg);
                  return <LegCard key={leg.key} leg={leg} draft={d} rates={view.rates} vendors={vendors.data ?? []} canEdit={canEdit} unsaved={changed.has(leg.key)} routing={routing === leg.key} route={routes[leg.key]} links={links[leg.key]} linking={linking === leg.key} errors={errors[leg.key] ?? {}} onChange={(p) => setLeg(leg.key, p)} onRoute={() => void calcRoute(leg.key)} onLinks={() => void showLinks(leg.key)} />;
                })}
                {canEdit && (
                  <div className={cn("sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 shadow-card", dirty ? "border-royal/40 bg-[#e8f0ff]" : "border-border bg-surface")}>
                    <p className="text-sm text-navy">{dirty ? "You have unsaved changes. The figures update when you save." : "All changes are saved."}</p>
                    <div className="flex gap-2">
                      {dirty && <Button variant="outline" onClick={() => { setDraft(null); setErrors({}); }}><RotateCcw className="size-4" aria-hidden /> Discard</Button>}
                      <Button className="bg-royal hover:bg-royal/90" disabled={!dirty && !refresh} loading={save.isPending && !routing} onClick={() => saveAll()}><Save className="size-4" aria-hidden /> Save &amp; recalculate</Button>
                      <Button className="bg-finance hover:bg-finance/90" disabled={dirty || pending > 0} onClick={() => setStep("review")}>Go to final review</Button>
                    </div>
                  </div>
                )}
              </>
            )
          )}

          {step === "review" && <PlanReview projectId={projectId} view={view} dirty={dirty} closed={closed} />}

          {step === "bills" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Planned in-house cost {inr(view.inHouseByCategory.total)}. Claimed so far {inr(view.actual.all)}{view.actual.all > view.inHouseByCategory.total && view.inHouseByCategory.total > 0 ? " — over the plan" : ""}.</p>
              <ExpenseClaims projectId={projectId} canAdd={can("sites:write") && !closed} estimateByCategory={{ FOOD: view.inHouseByCategory.food, STAY: view.inHouseByCategory.stay, FUEL: view.inHouseByCategory.fuel, OTHER: view.inHouseByCategory.other }} />
            </div>
          )}
        </TabPanel>
      </div>
    </div>
  );
}
