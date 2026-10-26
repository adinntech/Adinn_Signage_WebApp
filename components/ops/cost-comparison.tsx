"use client";

import { useState } from "react";
import { AlertTriangle, BadgeCheck, Building2, CheckCircle2, Home, Scale, ShieldAlert, ThumbsDown, ThumbsUp, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useChooseChannel, useClientDecision, useCost, useDecideCost, useSaveCost, type Channel, type CostInput, type CostView } from "@/lib/api/costing";
import { useActiveVendors } from "@/lib/api/vendors";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExpenseClaims } from "./expense-claims";
import { RequirementPanel } from "./requirement-panel";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const NUM_FIELDS = [
  ["shops", "Shops to recce", "Total shops in this project"],
  ["shopsCovered", "Shops in-house covers", "Blank = all shops"],
  ["vendorDistanceKm", "Avg distance for vendor (km)", "Far rate applies from the policy distance"],
  ["vendorOther", "Vendor other charges (₹)", ""],
  ["days", "In-house days", "Food is counted per day"],
  ["nights", "Nights of stay", "Stay needs a bill"],
  ["totalKm", "Total travel (km)", "All shops, round trip"],
  ["fuelAmount", "Fuel (₹)", "Only if fuel is spent"],
  ["otherAmount", "Other in-house (₹)", ""],
  ["clientsShared", "Clients on the same trip", "Cost is shared between them"],
] as const;
type NumKey = (typeof NUM_FIELDS)[number][0];

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 py-1.5 text-sm", strong && "border-t border-border pt-2 font-bold")}>
      <span className={strong ? "text-navy" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function PlanForm({ view, projectId, canEdit }: { view: CostView; projectId: string; canEdit: boolean }) {
  const toast = useToast();
  const save = useSaveCost(projectId);
  const p = view.plan;
  const [v, setV] = useState<Record<NumKey, string>>(() => Object.fromEntries(NUM_FIELDS.map(([k]) => [k, p[k] === undefined ? "" : String(p[k])])) as Record<NumKey, string>);
  const [vendorType, setVendorType] = useState(p.vendorType ?? "");
  const [vendorName, setVendorName] = useState(p.vendorName ?? "");
  const [vendorId, setVendorId] = useState(p.vendor ?? "");
  const vendors = useActiveVendors(canEdit);
  const [refresh, setRefresh] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const e: Record<string, string> = {};
    const n = (k: NumKey) => (v[k].trim() === "" ? undefined : Number(v[k]));
    for (const [k, label] of NUM_FIELDS) if (v[k].trim() !== "" && !(Number(v[k]) >= 0)) e[k] = `${label}: enter a number`;
    if (!(Number(v.shops) >= 1)) e.shops = "Enter the number of shops";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body: CostInput = {
      shops: Number(v.shops), vendorDistanceKm: n("vendorDistanceKm") ?? 0, vendorOther: n("vendorOther") ?? 0, days: n("days") ?? 0, nights: n("nights") ?? 0,
      totalKm: n("totalKm") ?? 0, fuelAmount: n("fuelAmount") ?? 0, otherAmount: n("otherAmount") ?? 0, clientsShared: n("clientsShared") ?? 1,
      ...(n("shopsCovered") ? { shopsCovered: n("shopsCovered") as number } : {}), ...(vendorId ? { vendorId } : {}), ...(vendorType ? { vendorType: vendorType as never } : {}), ...(vendorName.trim() ? { vendorName: vendorName.trim() } : {}), refreshRates: refresh,
    };
    save.mutate(body, {
      onSuccess: () => toast("Cost calculated and saved"),
      onError: (err) => { const fe = fieldErrorsOf(err); if (Object.keys(fe).length) setErrors(fe); else toast(errorMessage(err), "error"); },
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-soft">
      <h3 className="mb-3 text-sm font-bold text-navy">Trip &amp; vendor details</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Registered vendor" htmlFor="vendorId" hint="Uses that vendor's rate card" className="sm:col-span-2">
          <Select id="vendorId" value={vendorId} disabled={!canEdit} onChange={(e) => { const id = e.target.value; setVendorId(id); const x = vendors.data?.find((o) => o._id === id); if (x) { setVendorName(x.name); setVendorType(x.type); } }}>
            <option value="">Not selected (company rates)</option>
            {(vendors.data ?? []).map((o) => <option key={o._id} value={o._id}>{o.name} · {o.code}{o.ratePerShop != null ? ` · ₹${o.ratePerShop}/shop` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Vendor type" htmlFor="vendorType">
          <Select id="vendorType" value={vendorType} disabled={!canEdit} onChange={(e) => setVendorType(e.target.value as never)}>
            <option value="">Not decided</option><option value="ONE_MAN">One-man vendor</option><option value="ORGANIZATION">Organization</option>
          </Select>
        </Field>
        <Field label="Vendor name" htmlFor="vendorName"><Input id="vendorName" value={vendorName} disabled={!canEdit} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Balamurugan" /></Field>
        {NUM_FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label} htmlFor={k} hint={hint} error={errors[k]} required={k === "shops"}>
            <Input id={k} inputMode="decimal" value={v[k]} disabled={!canEdit} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} aria-invalid={!!errors[k]} />
          </Field>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={refresh} disabled={!canEdit} onChange={(e) => setRefresh(e.target.checked)} /> Use the latest company rates (otherwise this project keeps the rates it started with)
        </label>
        {canEdit && <Button className="bg-royal hover:bg-royal/90" loading={save.isPending} onClick={submit}><Scale className="size-4" aria-hidden /> Save &amp; compare</Button>}
      </div>
    </div>
  );
}

function Banner({ tone, icon: Icon, title, children }: { tone: "ok" | "warn" | "bad"; icon: typeof CheckCircle2; title: string; children: React.ReactNode }) {
  const c = { ok: "border-[#bbf0d3] bg-[#e7f9ef] text-finance", warn: "border-[#fcd5a8] bg-[#fff7ed] text-approval", bad: "border-[#f5c2c2] bg-[#fdecec] text-loss" }[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3 text-sm", c)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div><p className="font-semibold">{title}</p><div className="text-xs text-foreground/80">{children}</div></div>
    </div>
  );
}

function ChannelCard({ channel, title, tag, icon: Icon, grad, view, canEdit, busy, onPick, children }: { channel: Channel; title: string; tag: string; icon: typeof Home; grad: string; view: CostView; canEdit: boolean; busy: boolean; onPick: (c: Channel) => void; children: React.ReactNode }) {
  const { calc, plan } = view;
  const confirmed = plan.status === "CONFIRMED" || plan.status === "APPROVED";
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-surface shadow-soft", plan.chosen === channel && confirmed ? "border-finance ring-2 ring-finance/40" : "border-border")}>
      <div className={cn("flex items-center gap-2 bg-gradient-to-r px-4 py-2.5 text-white", grad)}>
        <Icon className="size-5" aria-hidden /><h3 className="flex-1 text-sm font-bold">{title}</h3>
        <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-semibold">{tag}</span>
      </div>
      <div className="p-4">
        {children}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {calc.recommended === channel && <Badge tone="success"><BadgeCheck className="size-3" aria-hidden />Recommended</Badge>}
          {calc.needsApproval[channel] && <Badge tone="warning"><ShieldAlert className="size-3" aria-hidden />Needs special approval</Badge>}
          {plan.chosen === channel && confirmed && <Badge tone="info">Chosen</Badge>}
        </div>
        {canEdit && view.saved && (
          <Button className="mt-3 w-full" variant={calc.recommended === channel ? "default" : "outline"} loading={busy} disabled={plan.status === "APPROVAL_PENDING"} onClick={() => onPick(channel)}>
            {calc.needsApproval[channel] ? "Request special approval for " : "Choose "}{channel === "VENDOR" ? "vendor" : "in-house"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function CostComparison({ projectId, closed }: { projectId: string; closed: boolean }) {
  const toast = useToast();
  const { can } = useAuth();
  const q = useCost(projectId);
  const choose = useChooseChannel(projectId);
  const decide = useDecideCost(projectId);
  const client = useClientDecision(projectId);
  const [ask, setAsk] = useState<Channel | null>(null);
  const [text, setText] = useState("");
  const [deciding, setDeciding] = useState<boolean | null>(null);
  const [clientNo, setClientNo] = useState(false);

  if (q.isPending) return <RowsSkeleton rows={5} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the cost comparison" />;
  const view = q.data;
  const { calc, plan, rates, actual } = view;
  const canEdit = can("sites:write") && !closed && plan.clientDecision !== "ACCEPTED";
  const canDecide = can("finance:manage") && plan.status === "APPROVAL_PENDING";
  const confirmed = plan.status === "CONFIRMED" || plan.status === "APPROVED";
  const pct = calc.comparison.inHouseSavingPercent;

  const pick = (c: Channel) => {
    if (calc.needsApproval[c]) { setText(""); setAsk(c); }
    else choose.mutate({ channel: c }, { onSuccess: () => toast(`${c === "VENDOR" ? "Vendor" : "In-house"} recce confirmed`), onError: (e) => toast(errorMessage(e), "error") });
  };

  return (
    <RequirementPanel n={4} tone="green" title="Vendor vs In-House Cost Comparison" tag="Cost control" description={`Per-shop limit ₹${rates.thresholdPerShop} (worst case ₹${rates.worstCasePerShop}). Anything over needs special approval from admin.`}>
      <PlanForm key={view.plan._id ?? "new"} view={view} projectId={projectId} canEdit={canEdit} />

      {!view.saved && <p className="rounded-lg bg-[#eef4ff] p-3 text-sm text-navy">These figures are a starting point from the project. Fill the trip details and press <strong>Save &amp; compare</strong>.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_260px]">
        <ChannelCard channel="VENDOR" view={view} canEdit={canEdit} busy={choose.isPending && ask === null} onPick={pick} title="Vendor cost" tag={plan.vendorType === "ONE_MAN" ? "One-man vendor" : plan.vendorType === "ORGANIZATION" ? "Organization" : "Shop based"} icon={Building2} grad="from-[#6d28d9] to-[#9333ea]">
          <p className="text-2xl font-bold text-navy">{inr(calc.vendor.total)}</p>
          <p className="mb-2 text-xs text-muted-foreground">{plan.vendorName ? `${plan.vendorName} · ` : ""}{inr(calc.vendor.perShop)} per shop</p>
          <Row label={`Shops × ₹${calc.vendor.perShopRate}${calc.vendor.far ? " (far rate)" : ""}`} value={inr(calc.vendor.shopCost)} />
          <Row label="Other charges" value={inr(calc.vendor.other)} />
          <Row label="Total vendor cost" value={inr(calc.vendor.total)} strong />
        </ChannelCard>
        <ChannelCard channel="IN_HOUSE" view={view} canEdit={canEdit} busy={choose.isPending && ask === null} onPick={pick} title="In-house cost" tag="Estimated" icon={Home} grad="from-[#047857] to-[#10b981]">
          <p className="text-2xl font-bold text-navy">{inr(calc.inHouse.total)}</p>
          <p className="mb-2 text-xs text-muted-foreground">{inr(calc.inHouse.perShop)} per shop · {calc.inHouse.shopsCovered} shops</p>
          <Row label={`Food (${plan.days} day × ₹${rates.foodPerDay})`} value={inr(calc.inHouse.food)} />
          <Row label={`Stay (${plan.nights} night)`} value={inr(calc.inHouse.stay)} />
          <Row label={`Travel (${plan.totalKm} km)${calc.inHouse.longDistance ? " · long distance" : ""}`} value={inr(calc.inHouse.travel)} />
          <Row label="Fuel" value={inr(calc.inHouse.fuel)} />
          <Row label="Other" value={inr(calc.inHouse.other)} />
          {plan.clientsShared > 1 && <Row label={`Shared by ${plan.clientsShared} clients`} value={`÷ ${plan.clientsShared}`} />}
          <Row label="Total in-house cost" value={inr(calc.inHouse.total)} strong />
        </ChannelCard>
        <div className="rounded-xl border border-border bg-surface p-4 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Difference</p>
          <div className={cn("mx-auto my-3 flex size-28 flex-col items-center justify-center rounded-full border-8", pct >= 0 ? "border-finance/40 text-finance" : "border-loss/30 text-loss")}>
            <span className="text-2xl font-bold tabular-nums">{Math.abs(pct)}%</span><span className="text-[11px] font-medium">{pct >= 0 ? "in-house saves" : "in-house costs more"}</span>
          </div>
          <p className="text-sm font-semibold text-navy">{pct >= 0 ? "You save" : "Extra cost"} {inr(Math.abs(calc.comparison.difference))}</p>
          <p className="mt-2 rounded-lg bg-[#e7f9ef] px-2 py-1.5 text-xs font-medium text-finance">Recommended: {calc.recommended === "IN_HOUSE" ? "In-house" : "Vendor"}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {!calc.needsApproval.IN_HOUSE && !calc.needsApproval.VENDOR
          ? <Banner tone="ok" icon={CheckCircle2} title="Within threshold">Both options are within ₹{rates.thresholdPerShop} per shop. No special approval needed.</Banner>
          : <Banner tone="warn" icon={AlertTriangle} title="Threshold rule">{calc.reasons.length ? calc.reasons.join(" ") : `Limit is ₹${rates.thresholdPerShop} per shop.`}</Banner>}
        <Banner tone="warn" icon={Scale} title="Rule">In-house over ₹{rates.thresholdPerShop} per shop, or {rates.overVendorPercent}% above the vendor cost, needs special approval.</Banner>
        <Banner tone={calc.flags.inHouseWorstCase ? "bad" : "ok"} icon={ShieldAlert} title="Special approval">{calc.flags.inHouseWorstCase ? `Worst case: in-house is at or above ₹${rates.worstCasePerShop} per shop.` : `Worst-case limit is ₹${rates.worstCasePerShop} per shop.`}</Banner>
      </div>

      {plan.status === "APPROVAL_PENDING" && (
        <div className="space-y-2 rounded-xl border border-[#fcd5a8] bg-[#fff7ed] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-approval"><ShieldAlert className="size-4" aria-hidden /> Waiting for admin: {plan.chosen === "IN_HOUSE" ? "in-house" : "vendor"} recce is over the limit</p>
          {plan.justification && <p className="text-sm text-foreground/80">Reason given: {plan.justification}</p>}
          {canDecide && (
            <div className="flex gap-2">
              <Button className="bg-finance hover:bg-finance/90" onClick={() => { setText(""); setDeciding(true); }}><ThumbsUp className="size-4" aria-hidden /> Approve</Button>
              <Button variant="outline" className="text-loss" onClick={() => { setText(""); setDeciding(false); }}><ThumbsDown className="size-4" aria-hidden /> Reject</Button>
            </div>
          )}
        </div>
      )}
      {plan.status === "REJECTED" && <Banner tone="bad" icon={ThumbsDown} title="Special approval rejected">{plan.reviewRemark ?? ""} Choose another option.</Banner>}
      {plan.status === "APPROVED" && <Banner tone="ok" icon={ThumbsUp} title="Special approval granted">{plan.reviewRemark ?? ""}{plan.reviewedAt ? ` · ${formatDate(plan.reviewedAt)}` : ""}</Banner>}

      {confirmed && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-soft">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><Truck className="size-4 text-royal" aria-hidden /> Cost shown to the client</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{inr(view.clientCost?.total ?? 0)}</p></div>
            <div><p className="text-xs text-muted-foreground">Per shop</p><p className="text-lg font-bold">{inr(view.clientCost?.perShop ?? 0)}</p></div>
            <div><p className="text-xs text-muted-foreground">Per sq.ft ({view.totalSqft} sq.ft)</p><p className="text-lg font-bold">{view.clientCost?.perSqft != null ? inr(view.clientCost.perSqft) : "Add measurements"}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-sm font-medium text-navy">Client decision:</span>
            <Badge tone={plan.clientDecision === "ACCEPTED" ? "success" : plan.clientDecision === "REJECTED" ? "danger" : "neutral"}>{plan.clientDecision === "PENDING" ? "Waiting" : plan.clientDecision === "ACCEPTED" ? "Accepted" : "Rejected"}</Badge>
            {plan.clientRemark && <span className="text-xs text-muted-foreground">{plan.clientRemark}</span>}
            {can("sites:write") && !closed && plan.clientDecision === "PENDING" && (
              <div className="ml-auto flex gap-2">
                <Button size="sm" className="bg-finance hover:bg-finance/90" onClick={() => client.mutate({ decision: "ACCEPTED" }, { onSuccess: () => toast("Client accepted the cost"), onError: (e) => toast(errorMessage(e), "error") })}>Client accepted</Button>
                <Button size="sm" variant="outline" className="text-loss" onClick={() => { setText(""); setClientNo(true); }}>Client rejected</Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold text-navy">Actual in-house expenses vs estimate</h3>
        <p className="mb-3 text-xs text-muted-foreground">Estimate {inr(calc.inHouse.total)} · claimed so far {inr(actual.all)} ({inr(actual.perShop)} per shop){actual.all > calc.inHouse.total ? " — over the estimate" : ""}.</p>
        <ExpenseClaims projectId={projectId} canAdd={can("sites:write") && !closed} estimateByCategory={{ FOOD: calc.inHouse.food, STAY: calc.inHouse.stay, TRAVEL: calc.inHouse.travel, FUEL: calc.inHouse.fuel, OTHER: calc.inHouse.other }} />
      </div>

      <Modal
        open={!!ask}
        onOpenChange={(o) => !o && setAsk(null)}
        title="Special approval needed"
        description={calc.reasons.join(" ")}
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAsk(null)}>Back</Button><Button className="bg-royal hover:bg-royal/90" loading={choose.isPending} disabled={text.trim().length < 5} onClick={() => ask && choose.mutate({ channel: ask, justification: text.trim() }, { onSuccess: () => { toast("Sent to admin for approval"); setAsk(null); }, onError: (e) => toast(errorMessage(e), "error") })}>Send to admin</Button></div>}
      >
        <Field label="Why is this option needed?" htmlFor="why" required><Textarea id="why" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. No vendor is available in this district" /></Field>
      </Modal>

      <Modal
        open={deciding !== null}
        onOpenChange={(o) => !o && setDeciding(null)}
        title={deciding ? "Approve special cost" : "Reject special cost"}
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeciding(null)}>Back</Button><Button className="bg-royal hover:bg-royal/90" loading={decide.isPending} disabled={!deciding && text.trim().length < 3} onClick={() => decide.mutate({ approve: !!deciding, remark: text.trim() || undefined }, { onSuccess: () => { toast(deciding ? "Approved" : "Rejected"); setDeciding(null); }, onError: (e) => toast(errorMessage(e), "error") })}>{deciding ? "Approve" : "Reject"}</Button></div>}
      >
        <Field label={deciding ? "Remark (optional)" : "Reason"} htmlFor="remark" required={!deciding}><Textarea id="remark" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>

      <Modal
        open={clientNo}
        onOpenChange={setClientNo}
        title="Client rejected the cost"
        description="The project moves to LOSS with this reason and becomes read-only."
        className="max-w-md"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setClientNo(false)}>Back</Button><Button className="bg-loss hover:bg-loss/90" loading={client.isPending} disabled={text.trim().length < 3} onClick={() => client.mutate({ decision: "REJECTED", remark: text.trim() }, { onSuccess: () => { toast("Project moved to LOSS"); setClientNo(false); }, onError: (e) => toast(errorMessage(e), "error") })}>Mark as LOSS</Button></div>}
      >
        <Field label="Client's reason" htmlFor="loss" required><Textarea id="loss" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Cost per sq.ft is too high" /></Field>
      </Modal>
    </RequirementPanel>
  );
}
