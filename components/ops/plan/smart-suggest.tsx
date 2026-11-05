"use client";

import { useState } from "react";
import { AlertTriangle, Building2, Sparkles, Store, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useReadiness, useSuggestPlan, type SuggestResult } from "@/lib/api/costing";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Smart suggestion: reads the project's shops by district and recommends, for each area, the in-house team or the cheapest
 * active vendor that works there (district / service area, skills). Nothing is saved until "Use this plan" is pressed.
 */
export function SmartSuggest({ projectId, canEdit, onApplied }: { projectId: string; canEdit: boolean; onApplied: () => void }) {
  const toast = useToast();
  const suggest = useSuggestPlan(projectId);
  const ready = useReadiness(projectId).data;
  const [skills, setSkills] = useState("");
  const [require, setRequire] = useState(false);
  const [groupBy, setGroupBy] = useState<"area" | "district">("area");
  const [result, setResult] = useState<SuggestResult | null>(null);
  const list = skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);

  const run = (apply: boolean) =>
    suggest.mutate({ skills: list, requireSkills: require, apply, groupBy }, {
      onSuccess: (r) => { setResult(r); if (apply) { toast("Plan saved as a draft. Check it in the next step"); onApplied(); } },
      onError: (e) => toast(errorMessage(e), "error"),
    });

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <header className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-[#0f766e] to-[#0d9488] px-4 py-3 text-white">
        <Sparkles className="size-5" aria-hidden />
        <div className="min-w-0 flex-1"><p className="font-semibold">Smart plan</p><p className="text-xs opacity-90">Finds the best team for every district from the shops, vendor areas, skills and cost.</p></div>
        {canEdit && <Button variant="outline" className="bg-white text-navy hover:bg-white/90" loading={suggest.isPending && !suggest.variables?.apply} onClick={() => run(false)}><Wand2 className="size-4" aria-hidden /> {result ? "Analyse again" : "Analyse shops"}</Button>}
      </header>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm font-medium">Skills needed (optional, comma separated)
            <Input className="mt-1" maxLength={200} placeholder="e.g. Measurement, Board fitting" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </label>
          <label className="text-sm font-medium">Group shops by
            <select className="mt-1 block h-10 rounded-lg border border-border bg-surface px-2 text-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value as "area" | "district")}><option value="area">Nearby area (one trip per group)</option><option value="district">Whole district</option></select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={require} onChange={(e) => setRequire(e.target.checked)} /> Only vendors with these skills</label>
        </div>

        {ready && (
          <div className={cn("rounded-lg border px-3 py-2 text-sm", ready.allVerified ? "border-[#9fdcc3] bg-[#ecfaf3] text-finance" : "border-[#f5c77e] bg-[#fff8ec] text-approval")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><strong>Shop verification: {ready.verified} of {ready.total} shops verified.</strong>{" "}
                {ready.allVerified ? "All shops are verified, so the whole list is planned." : `The smart plan works on the ${ready.verified} verified shops; ${ready.unverified} still wait${ready.noAddress ? ` (${ready.noAddress} have no address: fill it, then verify)` : ""}.`}
              </span>
              <span className="h-2 w-40 overflow-hidden rounded-full bg-white/70"><span className="block h-full bg-current" style={{ width: `${ready.total ? Math.round((ready.verified / ready.total) * 100) : 0}%` }} /></span>
            </div>
            {!ready.allVerified && <p className="mt-1 text-xs">Next: open <b>Shop verification</b> in the Details tab, fix the details, press <b>Verify all pending</b>, then come back and analyse.</p>}
          </div>
        )}
        {!result && <p className="text-sm text-muted-foreground">Set the start point and locate the shops first for correct distances, then press Analyse shops.</p>}

        {result && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {([["Best mix (suggested)", inr(result.totals.suggested)], ["If all in-house", inr(result.totals.allInHouse)], ["If all vendor", inr(result.totals.allVendor)], [`${result.totals.areas} areas`, `${result.totals.inHouseShops} in-house · ${result.totals.vendorShops} vendor`]] as const).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-[#eef4ff] px-3 py-2"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold tabular-nums text-navy">{v}</p></div>
              ))}
            </div>
            {(result.verification?.unverified ?? 0) > 0 && (
              <p className="flex gap-2 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-approval"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{result.verification?.unverified} shops are not verified, so they are not planned yet. Verify them in Shop verification and analyse again.</p>
            )}
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-2">Area</th><th>Shops</th><th>From start</th><th>In-house (travel, food, stay)</th><th>Best vendors</th><th>Suggestion</th></tr></thead>
                <tbody>
                  {result.proposals.map((p) => (
                    <tr key={p.key} className="border-t border-border align-top">
                      <td className="p-2 font-medium">{p.name}<br /><span className="text-xs font-normal text-muted-foreground">{p.towns.slice(0, 3).join(", ") || p.district}</span></td>
                      <td>{p.shops}<br /><span className="text-xs text-muted-foreground">{p.located} on map</span></td>
                      <td className="whitespace-nowrap">{p.distanceKm ? `${Math.round(p.distanceKm)} km` : "–"}<br /><span className="text-xs text-muted-foreground">tour {Math.round(p.routeKm)} km</span></td>
                      <td className="whitespace-nowrap">{inr(p.inHouse.total)}<br /><span className="text-xs text-muted-foreground">{inr(p.inHouse.travel)} + {inr(p.inHouse.food)} + {inr(p.inHouse.stay)}<br />{p.inHouse.days} day{p.inHouse.days > 1 ? "s" : ""} · {inr(p.inHouse.perShop)}/shop</span></td>
                      <td className="text-xs">{p.vendors.length || p.zohoNearby?.length ? p.vendors.map((v) => <div key={v.vendorId} className={cn(v.vendorId === p.recommended.vendorId && "font-semibold text-navy")}>{v.name} {inr(v.total)}{v.local ? " · local" : ""}{v.skillMatch && list.length ? " · skilled" : ""}</div>) : <span className="text-muted-foreground">No registered vendor covers this area</span>}
                        {(p.zohoNearby?.length ?? 0) > 0 && <div className="mt-1 border-t border-border pt-1 text-muted-foreground"><b>Zoho, near ({p.zohoNearby!.length}):</b>{p.zohoNearby!.slice(0, 3).map((z) => <div key={z.zohoContactId}>{z.name} · {z.city || z.match.toLowerCase()}{z.ratePerShop ? ` · ₹${z.ratePerShop}/shop` : ""} · not registered</div>)}</div>}</td>
                      <td>
                        <Badge tone={p.recommended.channel === "IN_HOUSE" ? "info" : "success"}>{p.recommended.channel === "IN_HOUSE" ? <><Building2 className="mr-1 inline size-3" />In-house</> : <><Store className="mr-1 inline size-3" />{p.recommended.vendorName}</>}</Badge>
                        <p className="mt-1 text-xs font-semibold tabular-nums">{inr(p.recommended.total)}</p>
                        <ul className="mt-1 list-disc pl-4 text-[11px] leading-snug text-muted-foreground">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                        {p.warnings.map((w) => <p key={w} className="mt-1 flex gap-1 text-[11px] text-approval"><AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />{w}</p>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && <div className="flex justify-end"><Button className="bg-royal hover:bg-royal/90" loading={suggest.isPending && !!suggest.variables?.apply} onClick={() => run(true)}>Use this plan</Button></div>}
          </>
        )}
      </div>
    </section>
  );
}
