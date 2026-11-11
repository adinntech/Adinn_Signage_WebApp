"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useChangeRateStatus, type RateApproval } from "@/lib/api/vendors";
import { cn } from "@/lib/utils";

const money = (n: number | null) => (n == null ? "–" : `₹${n}`);
export const APPROVAL_LABEL: Record<string, string> = { PENDING: "Waiting for approval", APPROVED: "Approved", NOT_APPROVED: "Not approved" };
const TONE: Record<string, string> = { PENDING: "text-approval", APPROVED: "text-finance", NOT_APPROVED: "text-loss" };

/** The status of a vendor amount request, in the Vendors with cost list. */
export function ApprovalTag({ a }: { a: RateApproval }) {
  const full =
    a.status === "PENDING" ? `Requested ${money(a.ratePerShop)}${a.farRatePerShop != null ? ` / ${money(a.farRatePerShop)}` : ""}`
    : a.status === "NOT_APPROVED" ? `Company rate applied ${money(a.appliedRate)}${a.appliedFar != null ? ` / ${money(a.appliedFar)}` : ""}`
    : `Applied ${money(a.appliedRate)}${a.appliedFar != null ? ` / ${money(a.appliedFar)}` : ""}`;
  return (
    <span className={cn("mt-1 inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", { PENDING: "bg-[#fff0e0] text-approval", APPROVED: "bg-[#e2f8ea] text-finance", NOT_APPROVED: "bg-[#fdecec] text-loss" }[a.status] ?? "bg-muted text-muted-foreground")} title={`${full}. Company rate ${money(a.limitRate)} / travelling cost ${money(a.limitFar)}. Request ${a.requestId}${a.decidedBy ? `. By ${a.decidedBy}` : ""}`}>
      {APPROVAL_LABEL[a.status] ?? a.status}
    </span>
  );
}

/** Operations can change the status by hand (also when the approver's mail was wrong): Approved applies the typed amount, Not approved the company rate. */
export function RateStatusDialog({ name, approval, onClose }: { name: string; approval: RateApproval; onClose: () => void }) {
  const toast = useToast();
  const change = useChangeRateStatus();
  const history = [...approval.history].reverse();
  const set = (decision: "APPROVED" | "NOT_APPROVED") =>
    change.mutate({ requestId: approval.requestId, decision }, { onSuccess: () => { toast(decision === "APPROVED" ? `${name}: approved, the requested amount is applied` : `${name}: not approved, the company rate is applied`); onClose(); }, onError: (e) => toast(errorMessage(e), "error") });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Amount approval status"
      description={`${name} · ${approval.requestId}`}
      className="max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" className="text-loss" loading={change.isPending} disabled={approval.status === "NOT_APPROVED"} onClick={() => set("NOT_APPROVED")}><X className="size-4" aria-hidden /> Not approved</Button>
          <Button className="bg-finance hover:bg-finance/90" loading={change.isPending} disabled={approval.status === "APPROVED"} onClick={() => set("APPROVED")}><Check className="size-4" aria-hidden /> Approved</Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p>Status: <span className={cn("font-bold", TONE[approval.status])}>{APPROVAL_LABEL[approval.status] ?? approval.status}</span>{approval.decidedAt && <span className="text-xs text-muted-foreground"> · {formatDateTime(approval.decidedAt)}{approval.decidedBy ? ` · ${approval.decidedBy}` : ""}</span>}</p>
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-[#f7f9fd] p-3 text-xs">
          <div><dt className="text-muted-foreground">Requested price per shop</dt><dd className="font-semibold">{money(approval.ratePerShop)}</dd></div>
          <div><dt className="text-muted-foreground">Requested travelling cost</dt><dd className="font-semibold">{money(approval.farRatePerShop)}</dd></div>
          <div><dt className="text-muted-foreground">Company rate</dt><dd className="font-semibold">{money(approval.limitRate)}</dd></div>
          <div><dt className="text-muted-foreground">Company travelling cost</dt><dd className="font-semibold">{money(approval.limitFar)}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">Approved applies the requested amount. Not approved applies the company rate. The change is kept in the history below.</p>
        <div className="rounded-lg border border-border">
          <p className="border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy">History ({history.length})</p>
          {history.length ? (
            <ul className="max-h-48 divide-y divide-border overflow-y-auto text-xs">
              {history.map((h, i) => (
                <li key={i} className="px-3 py-2"><span className="font-semibold text-navy">{h.outcome ?? "Reply read"}</span><span className="block text-muted-foreground">{h.from ?? ""} · {formatDateTime(h.receivedAt ?? h.at)}</span>{h.snippet && <span className="block truncate text-muted-foreground" title={h.snippet}>&ldquo;{h.snippet}&rdquo;</span>}</li>
              ))}
            </ul>
          ) : <p className="px-3 py-3 text-xs text-muted-foreground">No reply read yet.</p>}
        </div>
      </div>
    </Modal>
  );
}
