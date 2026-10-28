"use client";

import { useMemo, useState } from "react";
import { Crosshair, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useAllocationMap, useAllocationShops, useSetCoords, useSetOrigin, type AllocationOverview } from "@/lib/api/allocation";
import { cn } from "@/lib/utils";
import { LocateShops } from "./locate-shops";
import { AllocationMap } from "./map-loader";
import { IN_HOUSE_COLOR, UNASSIGNED_COLOR, colorFor } from "./team-colors";

type Mode = { kind: "none" } | { kind: "origin" } | { kind: "shop"; id: string; name: string };

/** All shops on the map. Choose "set start point" or a shop without a position, then click the map to place it. */
export function AllocationMapTab({ projectId, overview, canEdit }: { projectId: string; overview: AllocationOverview; canEdit: boolean }) {
  const toast = useToast();
  const map = useAllocationMap(projectId);
  const missing = useAllocationShops(projectId, { view: "no_coords", limit: 30 });
  const setOrigin = useSetOrigin(projectId);
  const setCoords = useSetCoords(projectId);
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const [originName, setOriginName] = useState(overview.origin?.name ?? "Office");

  const pins = useMemo(() => (map.data?.points ?? []).map((p) => ({ id: p.id, name: p.name, sub: p.district ?? "", lat: p.lat, lng: p.lng, color: colorFor(p.channel, p.vendor, overview.teams) })), [map.data, overview.teams]);

  const onPick = (lat: number, lng: number) => {
    if (mode.kind === "origin") setOrigin.mutate({ name: originName.trim() || "Start point", lat, lng }, { onSuccess: () => { toast("Start point saved"); setMode({ kind: "none" }); }, onError: (e) => toast(errorMessage(e), "error") });
    else if (mode.kind === "shop") setCoords.mutate({ id: mode.id, lat, lng }, { onSuccess: () => { toast(`${mode.name} placed`); setMode({ kind: "none" }); }, onError: (e) => toast(errorMessage(e), "error") });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-2">
        {mode.kind !== "none" && <p role="status" className="rounded-lg bg-[#fff7ed] px-3 py-2 text-sm font-medium text-approval">{mode.kind === "origin" ? "Click on the map where the team starts from." : `Click on the map to place “${mode.name}”.`} <button type="button" className="ml-2 underline" onClick={() => setMode({ kind: "none" })}>Cancel</button></p>}
        <AllocationMap pins={pins} origin={map.data?.origin ?? overview.origin} onPick={canEdit && mode.kind !== "none" ? onPick : undefined} height={520} />
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: "#dc2626" }} /> Start point</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: IN_HOUSE_COLOR }} /> In-house</li>
          {overview.teams.filter((t) => t.vendorId).map((t) => <li key={t.key} className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: colorFor("VENDOR", t.vendorId, overview.teams) }} /> {t.name}</li>)}
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: UNASSIGNED_COLOR }} /> Not allocated</li>
        </ul>
      </div>

      <aside className="space-y-4">
        {canEdit && (
          <section className="rounded-xl border border-border bg-surface p-3 shadow-soft">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><Flag className="size-4 text-loss" aria-hidden /> Start point</h3>
            <Input value={originName} onChange={(e) => setOriginName(e.target.value)} aria-label="Start point name" placeholder="Office / hub name" />
            <Button className="mt-2 w-full" variant={mode.kind === "origin" ? "default" : "outline"} onClick={() => setMode({ kind: "origin" })}><Crosshair className="size-4" aria-hidden /> {overview.origin ? "Move start point" : "Set on map"}</Button>
            {overview.origin && <p className="mt-1.5 text-xs text-muted-foreground">{overview.origin.name}: {overview.origin.lat.toFixed(4)}, {overview.origin.lng.toFixed(4)}</p>}
          </section>
        )}
        {canEdit && overview.withoutCoords > 0 && <LocateShops projectId={projectId} missing={overview.withoutCoords} />}
        <section className="rounded-xl border border-border bg-surface p-3 shadow-soft">
          <h3 className="mb-2 text-sm font-bold text-navy">Shops without a position ({overview.withoutCoords})</h3>
          {missing.isPending ? <p className="text-xs text-muted-foreground">Loading…</p> : (missing.data?.data.length ?? 0) === 0 ? <p className="text-xs text-finance">Every shop is on the map.</p> : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {missing.data!.data.map((s) => {
                const name = s.shopName || s.dealerName || s.siteCode;
                const on = mode.kind === "shop" && mode.id === s._id;
                return (
                  <li key={s._id}>
                    <button type="button" disabled={!canEdit} onClick={() => setMode({ kind: "shop", id: s._id, name })} className={cn("w-full rounded-lg border px-2.5 py-1.5 text-left text-sm", on ? "border-royal bg-[#e8f0ff]" : "border-border hover:bg-muted")}>
                      <span className="block truncate font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{[s.location, s.district].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
