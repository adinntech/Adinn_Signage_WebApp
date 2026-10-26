"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useGeocode } from "@/lib/api/allocation";

/**
 * Finds the map position of every shop that has none, from its address, area and pincode (OpenStreetMap). It works through
 * a dozen shops per call, so a long list shows progress and can be left to finish.
 */
export function LocateShops({ projectId, missing }: { projectId: string; missing: number }) {
  const toast = useToast();
  const geo = useGeocode(projectId);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ found: number; notFound: string[] } | null>(null);
  const [progress, setProgress] = useState(0);

  async function run() {
    setBusy(true);
    setDone(null);
    setProgress(0);
    let found = 0;
    const notFound: string[] = [];
    try {
      for (let i = 0; i < 400; i++) {
        const r = await geo.mutateAsync(12);
        found += r.found;
        notFound.push(...r.notFound.map((n) => n.name));
        setProgress(found + notFound.length);
        if (r.unavailable) { toast("The address service did not answer. Try again in a minute.", "error"); break; }
        if (r.remaining === 0 || r.tried === 0) break;
      }
      setDone({ found, notFound });
      toast(`${found} shop(s) placed on the map`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-soft">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-navy"><LocateFixed className="size-4 text-royal" aria-hidden /> Find shops on the map</h3>
      <p className="mb-2 text-xs text-muted-foreground">Uses each shop&apos;s address, area and pincode. {missing} shop(s) have no position yet.</p>
      <Button className="w-full" variant="outline" disabled={missing === 0} loading={busy} onClick={run}>{busy ? `Locating… ${progress} done` : "Locate shops from address"}</Button>
      {done && (
        <div role="status" className="mt-2 text-xs">
          <p className="font-medium text-finance">{done.found} placed.</p>
          {done.notFound.length > 0 && <p className="mt-0.5 text-approval">{done.notFound.length} not found — place them by clicking the map: {done.notFound.slice(0, 5).join(", ")}{done.notFound.length > 5 ? "…" : ""}</p>}
        </div>
      )}
    </div>
  );
}
