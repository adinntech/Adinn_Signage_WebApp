"use client";

import { useState } from "react";
import { Shuffle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useApplySplit, usePreviewSplit, type AllocationOverview, type SplitPreview } from "@/lib/api/allocation";
import { useActiveVendors } from "@/lib/api/vendors";
import { cn } from "@/lib/utils";

const BY = [["district", "District"], ["distance", "Distance"], ["count", "No. of shops"]] as const;

/** Split the not-yet-allocated shops between several vendors and / or the in-house team, review it, then apply. */
export function AllocationSplit({ projectId, overview }: { projectId: string; overview: AllocationOverview }) {
  const toast = useToast();
  const vendors = useActiveVendors();
  const preview = usePreviewSplit(projectId);
  const apply = useApplySplit(projectId);
  const [by, setBy] = useState<"district" | "distance" | "count">("district");
  const [max, setMax] = useState("");
  const [teams, setTeams] = useState<string[]>([]);
  const [result, setResult] = useState<SplitPreview | null>(null);
  const toggle = (id: string) => { setResult(null); setTeams((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id])); };
  const maxErr = max.trim() !== "" && !/^[1-9]\d*$/.test(max.trim());

  const run = () =>
    preview.mutate({ by, ...(max.trim() ? { maxPerTeam: Number(max) } : {}), teams: teams.map((t) => ({ vendorId: t === "IN_HOUSE" ? null : t })), onlyUnassigned: true }, { onSuccess: setResult, onError: (e) => toast(errorMessage(e), "error") });

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-soft">
        <h3 className="flex items-center gap-2 text-sm font-bold text-navy"><Shuffle className="size-4 text-vendor" aria-hidden /> Split assignment</h3>
        <p className="text-xs text-muted-foreground">{overview.unassigned} shop(s) are not allocated yet. Pick the teams; order matters — the first team gets the first group.</p>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-navy">Auto split by</legend>
          <div className="flex gap-1.5">{BY.map(([k, l]) => <button key={k} type="button" aria-pressed={by === k} onClick={() => { setBy(k); setResult(null); }} className={cn("flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium", by === k ? "border-royal bg-[#e8f0ff] text-royal" : "border-border text-muted-foreground")}>{l}</button>)}</div>
        </fieldset>
        <Field label="Max shops per team" htmlFor="split-max" hint="Blank = divide evenly" error={maxErr ? "Whole number, 1 or more" : undefined}><Input id="split-max" format="digits" value={max} onChange={(e) => { setMax(e.target.value); setResult(null); }} /></Field>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-navy">Teams</legend>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            <li><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm"><input type="checkbox" checked={teams.includes("IN_HOUSE")} onChange={() => toggle("IN_HOUSE")} /> In-house team</label></li>
            {(vendors.data ?? []).map((v) => <li key={v._id}><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm"><input type="checkbox" checked={teams.includes(v._id)} onChange={() => toggle(v._id)} /> <span className="truncate">{v.name}</span><span className="ml-auto text-xs text-muted-foreground">{v.code}</span></label></li>)}
            {vendors.data?.length === 0 && <li className="text-xs text-muted-foreground">No active vendors yet. Activate a vendor after KYC.</li>}
          </ul>
        </fieldset>
        <Button className="w-full bg-royal hover:bg-royal/90" disabled={!teams.length || maxErr || overview.unassigned === 0} loading={preview.isPending} onClick={run}><Wand2 className="size-4" aria-hidden /> Generate split</Button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-soft">
        {!result ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Choose the teams and press <strong>Generate split</strong> to see the suggestion. Nothing is saved until you apply it.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-navy">{result.totalShops} shop(s) divided into {result.groups.length} group(s)</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {result.groups.map((g, i) => (
                <li key={`${g.vendorId}-${i}`} className="rounded-xl border border-border p-3" style={{ borderLeft: `4px solid ${g.vendorId ? "#9333ea" : "#059669"}` }}>
                  <p className="font-semibold text-navy">{g.name}</p>
                  <p className="text-2xl font-bold tabular-nums">{g.shops} <span className="text-sm font-medium text-muted-foreground">shops</span></p>
                  <p className="text-xs text-muted-foreground">{g.districts.length} district(s): {g.districts.slice(0, 4).join(", ")}{g.districts.length > 4 ? "…" : ""}</p>
                  <p className="text-xs text-muted-foreground">≈ {g.approxKm} km from the start point</p>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setResult(null)}>Discard</Button>
              <Button className="bg-finance hover:bg-finance/90" loading={apply.isPending} onClick={() => apply.mutate(result.groups.map((g) => ({ vendorId: g.vendorId, siteIds: g.siteIds })), { onSuccess: (r) => { toast(`${(r as { affected: number }).affected} shop(s) allocated`); setResult(null); }, onError: (e) => toast(errorMessage(e), "error") })}>Apply split</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
