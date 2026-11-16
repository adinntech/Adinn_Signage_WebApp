"use client";

import { useState } from "react";
import { Building2, Home, Loader2, Smartphone, UserPlus } from "lucide-react";
import { AddVendorLoginModal } from "@/components/vendors/vendor-logins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useAssignLogins, useLegLogins, type LegLogins } from "@/lib/api/costing";
import { formatDateTime } from "@/lib/format";

const label = (u: LegLogins["logins"][number]) => `${u.name}${u.phone ? ` · ${u.phone}` : ""}${u.employeeId ? ` · ${u.employeeId}` : ""}`;

/**
 * Last step of the recce operations login: after the shops are given to the in-house team or a vendor, pick the recce mobile
 * login (the vendor's own logins, or in-house executives) for every area. The shops then show in that login's app as In progress,
 * with the date, time and who assigned them.
 */
export function LoginAssign({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast();
  const q = useLegLogins(projectId, true);
  const assign = useAssignLogins(projectId);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [addFor, setAddFor] = useState<{ _id: string; name: string } | null>(null);
  const rows = q.data ?? [];
  const chosen = rows.map((r) => ({ key: r.key, userId: pick[r.key] || (r.holders.length === 1 && !r.unassigned ? r.holders[0].userId : "") })).filter((x) => x.userId);
  const changed = rows.flatMap((r) => { const u = pick[r.key]; return u && !(r.holders.length === 1 && !r.unassigned && r.holders[0].userId === u) ? [{ key: r.key, userId: u }] : []; });

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Smartphone className="size-4 text-recce" aria-hidden />
        <div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-navy">Give the shops to a recce mobile login</h3><p className="text-xs text-muted-foreground">Pick the login for each area. Its shops appear in that login&apos;s mobile app as In progress.</p></div>
      </div>
      {q.isPending ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading logins…</p>
      ) : q.isError ? (
        <p className="p-4 text-sm text-loss">{errorMessage(q.error)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
              <tr><th className="px-4 py-2.5">District</th><th className="px-4 py-2.5 text-right">Shops</th><th className="px-4 py-2.5">Team</th><th className="px-4 py-2.5">Mobile login</th><th className="px-4 py-2.5">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const holder = r.holders.length === 1 && !r.unassigned ? r.holders[0] : null;
                const mixed = r.holders.length + (r.unassigned ? 1 : 0) > 1;
                return (
                  <tr key={r.key}>
                    <td className="px-4 py-2.5 font-semibold text-navy">{r.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.shops}</td>
                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5">{r.channel === "IN_HOUSE" ? <Home className="size-4 text-finance" aria-hidden /> : <Building2 className="size-4 text-vendor" aria-hidden />}{r.channel === "IN_HOUSE" ? "In-house team" : (r.vendorName ?? "Vendor")}</span></td>
                    <td className="px-4 py-2.5">
                      {r.logins.length === 0 ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="text-xs font-medium text-approval">No login yet.{r.channel === "VENDOR" && r.vendorId ? "" : r.channel === "VENDOR" ? " Add one in the vendor record." : " Create a Recce Executive user."}</span>
                          {canEdit && r.channel === "VENDOR" && r.vendorId && (
                            <Button size="sm" variant="outline" onClick={() => setAddFor({ _id: r.vendorId!, name: r.vendorName ?? "Vendor" })}><UserPlus className="size-3.5" aria-hidden /> Add login</Button>
                          )}
                        </div>
                      ) : (
                        <Select aria-label={`Mobile login for ${r.name}`} disabled={!canEdit} value={pick[r.key] ?? holder?.userId ?? ""} onChange={(e) => setPick((p) => ({ ...p, [r.key]: e.target.value }))}>
                          <option value="">Select a login…</option>
                          {r.logins.map((u) => <option key={u.id} value={u.id}>{label(u)}</option>)}
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.holders.length === 0 && r.unassigned > 0 ? <Badge tone="neutral">Not given yet</Badge> : r.holders.map((h) => (
                        <div key={h.userId} className="mb-1 last:mb-0"><Badge tone="warning">In progress</Badge> <span className="text-muted-foreground">{r.logins.find((u) => u.id === h.userId)?.name ?? "Login"} · {h.shops} shop{h.shops === 1 ? "" : "s"}{h.assignedAt ? ` · ${formatDateTime(h.assignedAt)}` : ""}{h.assignedBy ? ` · by ${h.assignedBy}` : ""}</span></div>
                      ))}
                      {mixed && r.unassigned > 0 && r.holders.length > 0 && <span className="text-approval">{r.unassigned} not given yet</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">{changed.length ? `${changed.length} area${changed.length === 1 ? "" : "s"} to give.` : chosen.length === rows.length ? "Every area is given to a login." : "Select a login for each area."}</p>
          <Button className="bg-recce hover:bg-recce/90" disabled={!changed.length} loading={assign.isPending}
            onClick={() => assign.mutate({ legs: changed }, { onSuccess: (r) => { toast(`${r.given} shop(s) given. They are In progress in the mobile app now`); setPick({}); }, onError: (e) => toast(errorMessage(e), "error") })}>
            <Smartphone className="size-4" aria-hidden /> Assign shops to logins
          </Button>
        </div>
      )}
      {addFor && <AddVendorLoginModal key={addFor._id} vendor={addFor} open onOpenChange={(o) => { if (!o) setAddFor(null); }} onCreated={() => q.refetch()} />}
    </section>
  );
}
