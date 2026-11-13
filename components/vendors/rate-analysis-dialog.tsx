"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Car, Layers, LineChart, Repeat, Send, Store, TrendingDown, TrendingUp, User, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { analyse, chartPoints, stamp, niceTicks, type ChartPoint, type Period, type RateAnalysis, type RateField } from "@/lib/rate-analysis";
import type { CostHistory } from "@/lib/api/vendors";
import { cn } from "@/lib/utils";

const money = (n: number | null) => (n == null ? "–" : `₹${n}`);
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}₹${Math.abs(n)}`;
const signedPct = (p: number | null) => (p == null ? "" : ` (${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(2)}%)`);
/** An amount going up is a cost for the company (orange); going down is a saving (green). */
const toneOf = (d: number) => (d > 0 ? "text-approval" : d < 0 ? "text-finance" : "text-muted-foreground");

const FIELDS: { key: RateField; label: string; icon: LucideIcon }[] = [{ key: "ratePerShop", label: "Price per shop", icon: Store }, { key: "farRatePerShop", label: "Travelling cost", icon: Car }];
const PERIODS: { key: Period; label: string }[] = [{ key: "all", label: "All time" }, { key: "yearly", label: "Yearly" }, { key: "monthly", label: "Monthly" }];

function Segmented<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; icon?: LucideIcon }[]; label: string }) {
  return (
    <div className="inline-flex rounded-full bg-secondary p-0.5" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={value === it.key} onClick={() => onChange(it.key)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors", value === it.key ? "bg-royal text-white shadow-sm" : "text-muted-foreground hover:text-navy")}>
          {it.icon && <it.icon className="size-3.5" aria-hidden />}{it.label}
        </button>
      ))}
    </div>
  );
}

function SummaryCards({ a, fieldLabel }: { a: RateAnalysis; fieldLabel: string }) {
  const s = a.summary;
  const cards: { icon: LucideIcon; value: string; title: string; sub: string; cls: string }[] = [
    { icon: Layers, value: money(s.initial), title: "Initial amount", sub: s.initialAt ? stamp(s.initialAt) : "–", cls: "bg-[#eef3ff] text-royal" },
    { icon: TrendingUp, value: money(s.current), title: "Current amount", sub: s.currentAt ? stamp(s.currentAt) : "–", cls: "bg-[#e9f9ef] text-finance" },
    { icon: Repeat, value: `${a.revisions.length}`, title: "Revisions", sub: `${s.increases} increased · ${s.decreases} decreased`, cls: "bg-[#fff4e5] text-approval" },
    { icon: s.net < 0 ? TrendingDown : TrendingUp, value: s.net === 0 ? "₹0" : signed(s.net), title: "Net change", sub: s.net === 0 ? "No change" : signedPct(s.netPct).trim().replace(/[()]/g, ""), cls: "bg-[#f3ecfd] text-vendor" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={`${fieldLabel} summary`}>
      {cards.map((c) => (
        <div key={c.title} className={cn("flex min-w-0 flex-col items-center rounded-xl px-3 py-3 text-center", c.cls)}>
          <c.icon className="size-5" aria-hidden />
          <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          <p className="text-xs font-semibold text-navy">{c.title}</p>
          <p className="max-w-full truncate text-[11px] text-muted-foreground" title={c.sub}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

const W = 640, H = 252, PL = 46, PR = 34, PT = 30, PB = 46;

/** Area chart of the saved amount over time. Orange / green tags show how much each step rose or fell. Hollow dots: asked for, not applied. */
function TrendChart({ a, period, fieldLabel }: { a: RateAnalysis; period: Period; fieldLabel: string }) {
  const pts: ChartPoint[] = chartPoints(a, period);
  if (pts.length === 0) return <p className="px-3 py-8 text-center text-sm text-muted-foreground">No saved amount is recorded for this vendor yet.</p>;
  const values = pts.map((p) => p.v);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (i: number) => (pts.length < 2 ? (PL + W - PR) / 2 : PL + (i * (W - PL - PR)) / (pts.length - 1));
  const y = (v: number) => H - PB - ((v - lo) / (hi - lo || 1)) * (H - PT - PB);
  const line = pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ");
  const area = `${x(0)},${H - PB} ${line} ${x(pts.length - 1)},${H - PB}`;
  const every = Math.ceil(pts.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${fieldLabel} over time: ${pts.map((p) => `${p.label} ${money(p.v)}`).join(", ")}`}>
      <defs><linearGradient id="rate-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" /><stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t === lo ? undefined : "3 4"} /><text x={PL - 8} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{t}</text></g>
      ))}
      <text x={12} y={H / 2} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle" className="fill-muted-foreground text-[10px]">Rate (₹)</text>
      {pts.length > 1 && <polygon points={area} fill="url(#rate-area)" />}
      {pts.length > 1 && <polyline points={line} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-royal" />}
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        return (
          <g key={p.key}>
            <title>{`${p.label}: ${money(p.v)}${p.delta ? ` (${signed(p.delta)})` : ""}${p.changes > 1 ? ` · ${p.changes} changes` : ""}`}</title>
            <circle cx={x(i)} cy={y(p.v)} r={5} strokeWidth={2.5} className={cn("stroke-royal", last ? "fill-royal" : "fill-white")} />
            <text x={x(i)} y={y(p.v) - 18} textAnchor="middle" className={cn("text-[11px] font-bold", p.delta ? (p.delta > 0 ? "fill-approval" : "fill-finance") : "fill-navy")}>{money(p.v)}</text>
            {p.delta ? <text x={x(i)} y={y(p.v) - 7} textAnchor="middle" className={cn("text-[9px] font-semibold", p.delta > 0 ? "fill-approval" : "fill-finance")}>{p.delta > 0 ? "▲" : "▼"} {signed(p.delta)}</text> : null}
            {(i % every === 0 || last) && (() => { const cut = p.label.lastIndexOf(", "); const [d1, t1] = period === "all" && cut > 0 ? [p.label.slice(0, cut), p.label.slice(cut + 2)] : [p.label, ""]; const anchor = i === 0 && pts.length > 1 ? "start" : last && pts.length > 1 ? "end" : "middle"; return <text x={x(i)} y={H - 26} textAnchor={anchor} className="fill-muted-foreground text-[10px]"><tspan x={x(i)}>{d1}</tspan>{t1 && <tspan x={x(i)} dy={12}>{t1}</tspan>}</text>; })()}
          </g>
        );
      })}
    </svg>
  );
}

function RevisionList({ a }: { a: RateAnalysis }) {
  const rows = [...a.revisions].reverse();
  const initial = a.points[0];
  if (!initial) return <p className="px-3 py-4 text-sm text-muted-foreground">No revision yet.</p>;
  return (
    <ol className="space-y-2 p-3">
      {rows.map((r, i) => (
        <li key={r.no} className={cn("rounded-xl border p-3", i === 0 ? "border-royal/30 bg-[#f4f8ff]" : "border-border")}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="inline-flex flex-wrap items-center gap-2 text-sm font-bold text-navy">Revision #{r.no}{i === 0 && <span className="rounded-full bg-royal px-2 py-0.5 text-[10px] font-bold text-white">Latest</span>}</span>
            <span className="text-base font-bold tabular-nums text-navy">{money(r.to)}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{stamp(r.at)}</span>
            {r.by && <span className="inline-flex items-center gap-1"><User className="size-3.5" aria-hidden />{r.by}</span>}
          </p>
          <p className="mt-1 text-xs text-navy">{money(r.from)} → {money(r.to)} <span className={cn("ml-1 inline-flex items-center gap-0.5 font-semibold", toneOf(r.delta))}>{r.delta > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}{signed(r.delta)}{signedPct(r.pct)}</span></p>
        </li>
      ))}
      <li className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between"><span className="rounded-full bg-[#e8f0ff] px-2.5 py-0.5 text-xs font-bold text-royal">Initial amount</span><span className="text-base font-bold tabular-nums text-navy">{money(initial.v)}</span></div>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden />{stamp(initial.at)}</p>
      </li>
    </ol>
  );
}

const REQUEST_TONE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Waiting for approval", cls: "bg-[#fff0e0] text-approval" },
  APPROVED: { label: "Approved", cls: "bg-[#e2f8ea] text-finance" },
  NOT_APPROVED: { label: "Not approved", cls: "bg-[#fdecec] text-loss" },
};

/** Every amount request of the vendor (newest first): what was asked, against the company rate, when it was sent and when it was answered. */
function RequestList({ requests }: { requests: CostHistory["requests"] }) {
  const rows = [...requests].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <h3 className="flex items-center gap-2 bg-[#e8eefb] px-3 py-2.5 text-base font-bold text-navy"><Send className="size-5 text-royal" aria-hidden />Approval requests ({rows.length})</h3>
      {rows.length === 0 ? <p className="px-3 py-3 text-xs text-muted-foreground">No approval request yet.</p> : (
        <ul className="max-h-72 space-y-2 overflow-y-auto p-3 text-xs">
          {rows.map((r) => {
            const t = REQUEST_TONE[r.status] ?? { label: r.status, cls: "bg-secondary text-muted-foreground" };
            return (
              <li key={r.requestId} className="space-y-1.5 rounded-xl border border-border p-3">
                <span className="flex flex-wrap items-center justify-between gap-2"><span className={cn("rounded-full px-2.5 py-1 font-bold", t.cls)}>{t.label}</span><span className="font-mono text-[11px] text-muted-foreground">{r.requestId}</span></span>
                <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-navy"><span>Price per shop <b className="tabular-nums">{money(r.requested.ratePerShop)}</b> <span className="text-muted-foreground">(company {money(r.limit.ratePerShop)})</span></span><span>Travelling cost <b className="tabular-nums">{money(r.requested.farRatePerShop)}</b> <span className="text-muted-foreground">(company {money(r.limit.farRatePerShop)})</span></span></span>
                <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground"><span className="inline-flex items-center gap-1"><Send className="size-3.5" aria-hidden />Requested {stamp(new Date(r.at).getTime())}</span>{r.decidedAt && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />Answered {stamp(new Date(r.decidedAt).getTime())}</span>}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Rate History & Analysis of one vendor: when and how many times each amount rose or fell, by all time, year or month. */
export function RateAnalysisDialog({ name, history, loading, onClose }: { name: string; history: CostHistory | undefined; loading: boolean; onClose: () => void }) {
  const [field, setField] = useState<RateField>("ratePerShop");
  const [period, setPeriod] = useState<Period>("all");
  const a = analyse(history, field);
  const fieldLabel = FIELDS.find((f) => f.key === field)!.label;
  const s = a.summary;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Rate History & Analysis" description={name} className="max-w-4xl" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      {loading && !history ? <p className="py-10 text-center text-sm text-muted-foreground">Loading the rate history…</p> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented value={field} onChange={setField} items={FIELDS} label="Amount" />
            <Segmented value={period} onChange={setPeriod} items={PERIODS} label="Period" />
          </div>
          <SummaryCards a={a} fieldLabel={fieldLabel} />
          <section className="rounded-xl border border-border p-3">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-navy"><LineChart className="size-5 text-royal" aria-hidden />Rate trend <span className="text-sm font-normal text-muted-foreground">({fieldLabel})</span></h3>
            <TrendChart a={a} period={period} fieldLabel={fieldLabel} />
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="font-bold text-approval">▲</span>Increased</span>
              <span className="inline-flex items-center gap-1"><span className="font-bold text-finance">▼</span>Decreased</span>
              {period !== "all" && <span>{period === "yearly" ? "Last amount of each year" : "Last amount of each month (latest 12 with a change)"}</span>}
              {s.requests > 0 && <span>{s.requests} approval request{s.requests > 1 ? "s" : ""}{s.notApproved ? `, ${s.notApproved} not approved` : ""}</span>}
            </p>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-border">
              <h3 className="flex items-center gap-2 bg-[#e8eefb] px-3 py-2.5 text-base font-bold text-navy"><Repeat className="size-5 text-royal" aria-hidden />Revision history</h3>
              <div className="max-h-72 overflow-y-auto"><RevisionList a={a} /></div>
            </section>
            <RequestList requests={history?.requests ?? []} />
          </div>
        </div>
      )}
    </Modal>
  );
}
