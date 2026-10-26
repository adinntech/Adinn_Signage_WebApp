"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Clock, Home, Send, ShieldAlert, ThumbsDown, ThumbsUp, Truck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useAssignPlan, useClientDecision, useDecidePlan, useSubmitPlan, type CostView, type PlanLeg } from "@/lib/api/costing";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { inr } from "./leg-card";

const who = (l: PlanLeg) => (l.channel === "IN_HOUSE" ? "In-house team" : l.channel === "VENDOR" ? (l.vendorName ?? "Vendor") : null);

function Banner({ tone, icon: Icon, title, children }: { tone: "ok" | "warn" | "bad" | "info"; icon: typeof CheckCircle2; title: string; children?: React.ReactNode }) {
  const c = { ok: "border-[#bbf0d3] bg-[#e7f9ef] text-finance", warn: "border-[#fcd5a8] bg-[#fff7ed] text-approval", bad: "border-[#f5c2c2] bg-[#fdecec] text-loss", info: "border-[#cfe0ff] bg-[#eef4ff] text-royal" }[tone];
  return (
    <div role="status" className={cn("flex gap-3 rounded-xl border p-3 text-sm", c)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div><p className="font-semibold">{title}</p>{children && <div className="text-xs text-foreground/80">{children}</div>}</div>
    </div>
  );
}

/** Step 3: the final plan as one table (which district goes to whom, at what cost), then submit → approve → assign. */
export function PlanReview({ projectId, view, dirty, closed }: { projectId: string; view: CostView; dirty: boolean; closed: boolean }) {
  const toast = useToast();
  const { can } = useAuth();
  const submit = useSubmitPlan(projectId);
  const decide = useDecidePlan(projectId);
  const assign = useAssignPlan(projectId);
  const client = useClientDecision(projectId);
  const [why, setWhy] = useState("");
  const [whyErr, setWhyErr] = useState<string>();
  const [deciding, setDeciding] = useState<boolean | null>(null);
  const [remark, setRemark] = useState("");
  const [clientNo, setClientNo] = useState(false);
  const [lossWhy, setLossWhy] = useState("");

  const { plan, totals } = view;
  const legs = plan.legs;
  const open = legs.filter((l) => !l.channel);
  const canPlan = can("sites:write") && !closed && plan.clientDecision !== "ACCEPTED";
  const canDecide = can("finance:manage") && plan.status === "APPROVAL_PENDING";
  const ready = legs.length > 0 && open.length === 0 && !dirty;
  const submitted = ["APPROVAL_PENDING", "APPROVED", "CONFIRMED", "ASSIGNED"].includes(plan.status);
  const mayAssign = ["APPROVED", "CONFIRMED"].includes(plan.status);

  const doSubmit = () => {
    setWhyErr(undefined);
    submit.mutate({ justification: why.trim() || undefined }, {
      onSuccess: (r) => toast(r.plan.status === "CONFIRMED" ? "Plan confirmed" : "Sent to admin for special approval"),
      onError: (e) => { const fe = fieldErrorsOf(e); if (fe.justification) setWhyErr(fe.justification); else toast(errorMessage(e), "error"); },
    });
  };

  return (
    <div className="space-y-4">
      {legs.length === 0 ? (
        <Banner tone="info" icon={Clock} title="No plan yet">Create the areas in step 1, then compare and choose in step 2.</Banner>
      ) : (
        <>
          {plan.status === "DRAFT" && <Banner tone="info" icon={Clock} title="Draft">{open.length ? `Still to choose: ${open.map((l) => l.name).join(", ")}.` : dirty ? "Save your changes in step 2 first." : "Every area is chosen. Submit the plan below."}</Banner>}
          {plan.status === "APPROVAL_PENDING" && <Banner tone="warn" icon={ShieldAlert} title="Waiting for admin's special approval">{plan.justification ? `Reason given: ${plan.justification}` : ""}</Banner>}
          {plan.status === "REJECTED" && <Banner tone="bad" icon={XCircle} title="Special approval rejected">{plan.reviewRemark ?? ""} Change the plan in step 2 and submit it again.</Banner>}
          {plan.status === "APPROVED" && <Banner tone="ok" icon={ThumbsUp} title="Special approval granted">{plan.reviewRemark ?? ""}{plan.reviewedAt ? ` · ${formatDate(plan.reviewedAt)}` : ""} Now assign the shops.</Banner>}
          {plan.status === "CONFIRMED" && <Banner tone="ok" icon={CheckCircle2} title="Plan confirmed: within all limits">Assign the shops to put it into action.</Banner>}
          {plan.status === "ASSIGNED" && <Banner tone="ok" icon={Truck} title="Shops assigned">{plan.assignedAt ? `On ${formatDate(plan.assignedAt)}. ` : ""}Each district&apos;s shops now belong to the in-house team or vendor shown below.</Banner>}
        </>
      )}

      {legs.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-bold text-navy">Final plan: who does which district</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#eef4ff] text-left text-xs uppercase tracking-wide text-navy">
                <tr><th className="px-4 py-2.5">District</th><th className="px-4 py-2.5 text-right">Shops</th><th className="px-4 py-2.5 text-right">Distance</th><th className="px-4 py-2.5">Recce by</th><th className="px-4 py-2.5">Assigned to</th><th className="px-4 py-2.5 text-right">Days / nights</th><th className="px-4 py-2.5 text-right">Cost</th><th className="px-4 py-2.5 text-right">Per shop</th><th className="px-4 py-2.5">Check</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {legs.map((l) => {
                  const ch = l.channel;
                  const cost = ch === "IN_HOUSE" ? l.calc.inHouse.total : ch === "VENDOR" ? l.calc.vendor.total : null;
                  const per = ch === "IN_HOUSE" ? l.calc.inHouse.perShop : ch === "VENDOR" ? l.calc.vendor.perShop : null;
                  const flag = ch ? l.calc.needsApproval[ch] : false;
                  return (
                    <tr key={l.key}>
                      <td className="px-4 py-2.5 font-semibold text-navy">{l.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{l.shops}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{l.distanceKm ? `${l.distanceKm} km` : "–"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{l.deadline ? formatDate(l.deadline) : "–"}</td>
                      <td className="px-4 py-2.5">{ch ? <span className="inline-flex items-center gap-1.5 font-medium">{ch === "IN_HOUSE" ? <Home className="size-4 text-finance" aria-hidden /> : <Building2 className="size-4 text-vendor" aria-hidden />}{who(l)}</span> : <span className="text-xs font-medium text-approval">Not chosen</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{ch === "IN_HOUSE" ? `${l.calc.inHouse.days} / ${l.calc.inHouse.nights}` : "–"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{cost != null ? inr(cost) : "–"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{per != null ? inr(per) : "–"}</td>
                      <td className="px-4 py-2.5">{!ch ? <span className="text-xs text-muted-foreground">–</span> : flag ? <Badge tone="warning"><AlertTriangle className="size-3" aria-hidden />Needs approval</Badge> : <Badge tone="success">Within limit</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-muted/40 text-sm font-bold">
                <tr><td className="px-4 py-2.5 text-navy">Total</td><td className="px-4 py-2.5 text-right tabular-nums">{totals.shops}</td><td colSpan={3} className="px-4 py-2.5 text-xs font-normal text-muted-foreground">{totals.inHouseShops} in-house · {totals.vendorShops} vendor</td><td /><td className="px-4 py-2.5 text-right tabular-nums">{inr(totals.chosenTotal)}</td><td className="px-4 py-2.5 text-right tabular-nums">{totals.perShop ? inr(totals.perShop) : "–"}</td><td /></tr>
              </tfoot>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {legs.filter((l) => l.channel).map((l) => `${l.shops} ${l.name} → ${who(l)}`).join("  ·  ") || "Choose in-house or a vendor for every district."}
            {totals.chosenLegs === legs.length && view.totals.recommendedTotal < totals.chosenTotal ? `  ·  Cheapest mix would be ${inr(view.totals.recommendedTotal)}` : ""}
          </p>
        </section>
      )}

      {legs.length > 0 && canPlan && ["DRAFT", "REJECTED"].includes(plan.status) && (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-soft">
          {totals.needsApproval && (
            <div className="space-y-2">
              <p className="flex items-start gap-2 rounded-lg bg-[#fff7ed] p-3 text-sm text-approval"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>This plan goes to admin for a special approval.<br /><span className="text-xs">{totals.reasons.join(" ")}</span></span></p>
              <Field label="Why is this needed?" htmlFor="plan-why" required error={whyErr}><Textarea id="plan-why" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. Only this vendor covers Coimbatore" /></Field>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{ready ? "Everything is chosen and saved." : dirty ? "Save your changes in step 2 first." : "Choose in-house or a vendor for every district first."}</p>
            <Button className="bg-royal hover:bg-royal/90" disabled={!ready || (totals.needsApproval && why.trim().length < 5)} loading={submit.isPending} onClick={doSubmit}><Send className="size-4" aria-hidden /> {totals.needsApproval ? "Send for special approval" : "Confirm plan"}</Button>
          </div>
        </section>
      )}

      {canDecide && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-[#fcd5a8] bg-[#fff7ed] p-4">
          <p className="mr-auto self-center text-sm font-semibold text-approval">Your decision</p>
          <Button className="bg-finance hover:bg-finance/90" onClick={() => { setRemark(""); setDeciding(true); }}><ThumbsUp className="size-4" aria-hidden /> Approve</Button>
          <Button variant="outline" className="text-loss" onClick={() => { setRemark(""); setDeciding(false); }}><ThumbsDown className="size-4" aria-hidden /> Reject</Button>
        </div>
      )}

      {canPlan && mayAssign && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#bbf0d3] bg-[#e7f9ef] p-4">
          <p className="text-sm text-finance"><strong>Final review done.</strong> Assigning gives every district&apos;s shops to the team or vendor above.</p>
          <Button className="bg-finance hover:bg-finance/90" loading={assign.isPending} onClick={() => assign.mutate(undefined, { onSuccess: (r) => toast(`${r.assigned} shop(s) assigned${r.skipped.length ? `; not matched: ${r.skipped.join(", ")}` : ""}`), onError: (e) => toast(errorMessage(e), "error") })}><CheckCircle2 className="size-4" aria-hidden /> Confirm &amp; assign shops</Button>
        </div>
      )}
      {plan.status === "ASSIGNED" && <Button asChild variant="outline"><Link href={`/operations/allocation/${projectId}`}>See the allocation <ArrowRight className="size-4" aria-hidden /></Link></Button>}

      {submitted && view.clientCost && (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-soft">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><Truck className="size-4 text-royal" aria-hidden /> Cost shown to the client</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{inr(view.clientCost.total)}</p></div>
            <div><p className="text-xs text-muted-foreground">Per shop</p><p className="text-lg font-bold">{inr(view.clientCost.perShop)}</p></div>
            <div><p className="text-xs text-muted-foreground">Per sq.ft ({view.totalSqft} sq.ft)</p><p className="text-lg font-bold">{view.clientCost.perSqft != null ? inr(view.clientCost.perSqft) : "Add measurements"}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-sm font-medium text-navy">Client decision:</span>
            <Badge tone={plan.clientDecision === "ACCEPTED" ? "success" : plan.clientDecision === "REJECTED" ? "danger" : "neutral"}>{plan.clientDecision === "PENDING" ? "Waiting" : plan.clientDecision === "ACCEPTED" ? "Accepted" : "Rejected"}</Badge>
            {plan.clientRemark && <span className="text-xs text-muted-foreground">{plan.clientRemark}</span>}
            {can("sites:write") && !closed && plan.clientDecision === "PENDING" && (
              <div className="ml-auto flex gap-2">
                <Button size="sm" className="bg-finance hover:bg-finance/90" onClick={() => client.mutate({ decision: "ACCEPTED" }, { onSuccess: () => toast("Client accepted the cost"), onError: (e) => toast(errorMessage(e), "error") })}>Client accepted</Button>
                <Button size="sm" variant="outline" className="text-loss" onClick={() => { setLossWhy(""); setClientNo(true); }}>Client rejected</Button>
              </div>
            )}
          </div>
        </section>
      )}

      <Modal
        open={deciding !== null}
        onOpenChange={(o) => !o && setDeciding(null)}
        title={deciding ? "Approve the plan" : "Reject the plan"}
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeciding(null)}>Back</Button><Button className="bg-royal hover:bg-royal/90" loading={decide.isPending} disabled={!deciding && remark.trim().length < 3} onClick={() => decide.mutate({ approve: !!deciding, remark: remark.trim() || undefined }, { onSuccess: () => { toast(deciding ? "Approved" : "Rejected"); setDeciding(null); }, onError: (e) => toast(errorMessage(e), "error") })}>{deciding ? "Approve" : "Reject"}</Button></div>}
      >
        <Field label={deciding ? "Remark (optional)" : "Reason"} htmlFor="plan-remark" required={!deciding}><Textarea id="plan-remark" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} /></Field>
      </Modal>

      <Modal
        open={clientNo}
        onOpenChange={setClientNo}
        title="Client rejected the cost"
        description="The project moves to LOSS with this reason and becomes read-only."
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setClientNo(false)}>Back</Button><Button className="bg-loss hover:bg-loss/90" loading={client.isPending} disabled={lossWhy.trim().length < 3} onClick={() => client.mutate({ decision: "REJECTED", remark: lossWhy.trim() }, { onSuccess: () => { toast("Project moved to LOSS"); setClientNo(false); }, onError: (e) => toast(errorMessage(e), "error") })}>Mark as LOSS</Button></div>}
      >
        <Field label="Client's reason" htmlFor="loss" required><Textarea id="loss" rows={3} value={lossWhy} onChange={(e) => setLossWhy(e.target.value)} placeholder="e.g. Cost per sq.ft is too high" /></Field>
      </Modal>
    </div>
  );
}
