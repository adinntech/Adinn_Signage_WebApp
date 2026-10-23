"use client";

import { useState } from "react";
import { AlertTriangle, Check, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useApprovalSites, useApproveAll, useSetApproval, type ApprovalLevel, type ApprovalSite, type ApprovalState } from "@/lib/api/pipeline";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const TONE: Record<ApprovalState, "neutral" | "success" | "danger"> = { PENDING: "neutral", APPROVED: "success", CORRECTION: "danger" };
const LABEL: Record<ApprovalState, string> = { PENDING: "Pending", APPROVED: "Approved", CORRECTION: "Correction" };

/** Which level the signed-in person may act on (Super Admin may act on both). */
export function levelsFor(role: string | undefined, can: (p?: string) => boolean): ApprovalLevel[] {
  if (role === "SUPER_ADMIN") return ["ops", "bd"];
  const out: ApprovalLevel[] = [];
  if (can("verification:manage")) out.push("ops");
  if (can("approvals:client")) out.push("bd");
  return out;
}

/**
 * Independent two-level approval of shop details and board measurements before the recce:
 * Operations approves its own level, BD approves theirs. Used on the Operations project page and in the BD drawer.
 */
export function ShopApprovals({ projectId, compact, readOnly }: { projectId: string; compact?: boolean; readOnly?: boolean }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const sites = useApprovalSites(projectId);
  const set = useSetApproval(projectId);
  const all = useApproveAll(projectId);
  const mine = readOnly ? [] : levelsFor(user?.role, can);
  const [correcting, setCorrecting] = useState<{ site: ApprovalSite; level: ApprovalLevel } | null>(null);
  const [note, setNote] = useState("");

  if (sites.isError) return <ErrorState error={sites.error} onRetry={() => sites.refetch()} title="Could not load shops" />;
  const rows = sites.data?.data ?? [];
  if (sites.isPending) return <p className="text-sm text-muted-foreground">Loading shops…</p>;
  if (rows.length === 0) return <EmptyState title="No shops yet" description="Import or add shops first; each one then needs both approvals." />;

  const count = (l: ApprovalLevel) => rows.filter((s) => (l === "ops" ? s.opsApproval : s.bdApproval) === "APPROVED").length;
  const corrections = rows.filter((s) => s.opsApproval === "CORRECTION" || s.bdApproval === "CORRECTION").length;

  const act = (site: ApprovalSite, level: ApprovalLevel, value: ApprovalState, n?: string) =>
    set.mutate(
      { siteId: site._id, level, value, note: n },
      { onError: (e) => toast(errorMessage(e), "error") },
    );

  const cell = (s: ApprovalSite, level: ApprovalLevel) => {
    const v = (level === "ops" ? s.opsApproval : s.bdApproval) ?? "PENDING";
    const may = mine.includes(level);
    return (
      <div className="flex items-center gap-1">
        <Badge tone={TONE[v]}>{LABEL[v]}</Badge>
        {may && v !== "APPROVED" && (
          <button type="button" aria-label={`Approve ${s.shopName ?? s.siteCode}`} title="Approve" onClick={() => act(s, level, "APPROVED")} className="rounded p-1 text-finance hover:bg-[#e2f8ea]">
            <Check className="size-4" aria-hidden />
          </button>
        )}
        {may && v === "PENDING" && (
          <button type="button" aria-label={`Request correction for ${s.shopName ?? s.siteCode}`} title="Request correction" onClick={() => { setNote(""); setCorrecting({ site: s, level }); }} className="rounded p-1 text-approval hover:bg-[#fff0e0]">
            <AlertTriangle className="size-4" aria-hidden />
          </button>
        )}
        {may && v !== "PENDING" && (
          <button type="button" aria-label={`Reset approval for ${s.shopName ?? s.siteCode}`} title="Reset to pending" onClick={() => act(s, level, "PENDING")} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <Undo2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ["Operations approval", "ops"],
          ["BD approval", "bd"],
        ] as const).map(([label, level]) => (
          <div key={level} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold tabular-nums text-navy">
                {count(level)} <span className="text-sm font-medium text-muted-foreground">/ {rows.length}</span>
              </p>
            </div>
            {mine.includes(level) && (
              <Button
                size="sm"
                variant="outline"
                loading={all.isPending}
                onClick={() =>
                  all.mutate(level, {
                    onSuccess: (r) => toast(r.approved ? `Approved ${r.approved} shop(s)` : "Nothing pending to approve"),
                    onError: (e) => toast(errorMessage(e), "error"),
                  })
                }
              >
                Approve all pending
              </Button>
            )}
          </div>
        ))}
        <div className={cn("rounded-xl border p-3", corrections ? "border-[#ffd9b0] bg-[#fff0e0]" : "border-border bg-surface")}>
          <p className="text-xs text-muted-foreground">Corrections requested</p>
          <p className={cn("text-lg font-bold tabular-nums", corrections ? "text-approval" : "text-navy")}>{corrections}</p>
        </div>
      </div>

      <div className={cn("overflow-auto rounded-xl border border-border bg-surface", compact ? "max-h-64" : "max-h-[460px]")}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
            <tr>
              <th className="px-3 py-2 font-semibold">Shop</th>
              <th className="px-3 py-2 font-semibold">Board</th>
              <th className="px-3 py-2 font-semibold">Operations</th>
              <th className="px-3 py-2 font-semibold">BD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => (
              <tr key={s._id}>
                <td className="px-3 py-2 font-medium text-navy">
                  {s.shopName || s.dealerName || s.siteCode}
                  <span className="block text-xs font-normal text-muted-foreground">{[s.dealerName && s.shopName ? s.dealerName : "", s.district].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-3 py-2">
                  {s.width && s.height ? <span className="font-semibold tabular-nums">{s.width} × {s.height} {s.unit ?? "ft"}</span> : <span className="text-xs text-approval">No size</span>}
                  <span className="block text-xs text-muted-foreground">{s.boardType || "-"}</span>
                </td>
                <td className="px-3 py-2">{cell(s, "ops")}</td>
                <td className="px-3 py-2">{cell(s, "bd")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!correcting}
        onOpenChange={(o) => !o && setCorrecting(null)}
        title="Request a correction"
        description={correcting ? `${correcting.site.shopName ?? correcting.site.siteCode}: tell the team what to fix.` : undefined}
        className="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCorrecting(null)}>Cancel</Button>
            <Button
              disabled={note.trim().length < 3}
              onClick={() => {
                if (!correcting) return;
                act(correcting.site, correcting.level, "CORRECTION", note.trim());
                setCorrecting(null);
              }}
            >
              Request correction
            </Button>
          </div>
        }
      >
        <Input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Width looks wrong, please re-measure" aria-label="Correction note" />
      </Modal>
    </div>
  );
}
