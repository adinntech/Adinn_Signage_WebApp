import { formatDateTime } from "@/lib/format";
import type { CostHistory } from "@/lib/api/vendors";

export type RateField = "ratePerShop" | "farRatePerShop";
export type Period = "all" | "yearly" | "monthly";

/** One saved amount over time. `initial` is the first amount known for the vendor. */
export interface RatePoint { at: number; v: number; by: string; initial: boolean }
export interface Revision { no: number; at: number; by: string; from: number; to: number; delta: number; pct: number | null }
/** A point drawn on the chart: one saved amount (all time) or the last amount of a year / month. */
export interface ChartPoint { key: string; label: string; v: number; delta: number | null; changes: number }
export interface RateAnalysis {
  points: RatePoint[];
  revisions: Revision[];
  /** Asked for but not applied (waiting or not approved). */
  openRequests: { at: number; v: number; status: string }[];
  summary: { initial: number | null; initialAt: number | null; current: number | null; currentAt: number | null; increases: number; decreases: number; net: number; netPct: number | null; requests: number; notApproved: number };
}

const pct = (from: number, to: number) => (from ? Math.round(((to - from) / from) * 10000) / 100 : null);

/** Every saved amount of one field, oldest first, and the revisions between them (a save that did not change the amount is not a revision). */
export function analyse(h: CostHistory | undefined, f: RateField): RateAnalysis {
  const points: RatePoint[] = [];
  const revisions: Revision[] = [];
  for (const c of h?.changes ?? []) {
    const ch = c[f];
    if (!ch || ch.to == null) continue;
    const at = new Date(c.at).getTime();
    const last = points[points.length - 1];
    if (!last) {
      if (ch.from != null && ch.from !== ch.to) {
        points.push({ at: at - 1, v: ch.from, by: "", initial: true });
        points.push({ at, v: ch.to, by: c.by, initial: false });
        revisions.push({ no: 1, at, by: c.by, from: ch.from, to: ch.to, delta: ch.to - ch.from, pct: pct(ch.from, ch.to) });
      } else points.push({ at, v: ch.to, by: c.by, initial: true });
    } else if (last.v !== ch.to) {
      points.push({ at, v: ch.to, by: c.by, initial: false });
      revisions.push({ no: revisions.length + 1, at, by: c.by, from: last.v, to: ch.to, delta: ch.to - last.v, pct: pct(last.v, ch.to) });
    }
  }
  const asked = (h?.requests ?? []).filter((r) => r.requested[f] != null);
  const first = points[0];
  const last = points[points.length - 1];
  const net = first && last ? last.v - first.v : 0;
  return {
    points,
    revisions,
    openRequests: asked.filter((r) => r.status !== "APPROVED").map((r) => ({ at: new Date(r.at).getTime(), v: r.requested[f]!, status: r.status })),
    summary: {
      initial: first?.v ?? null, initialAt: first?.at ?? null, current: last?.v ?? null, currentAt: last?.at ?? null,
      increases: revisions.filter((r) => r.delta > 0).length, decreases: revisions.filter((r) => r.delta < 0).length,
      net, netPct: first && last ? pct(first.v, last.v) : null,
      requests: asked.length, notApproved: asked.filter((r) => r.status === "NOT_APPROVED").length,
    },
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Date and time as the rest of the app shows them, e.g. "13 Nov 2026, 11:14 am": amounts can change several times in a day. */
export const stamp = (t: number) => formatDateTime(t);

/** The points of the chart for a filter: All time = every saved amount, Yearly / Monthly = the last amount of each year / month that had a change. */
export function chartPoints(a: RateAnalysis, period: Period): ChartPoint[] {
  if (period === "all") return a.points.map((p, i) => ({ key: `${p.at}-${i}`, label: stamp(p.at), v: p.v, delta: i === 0 ? null : p.v - a.points[i - 1].v, changes: i === 0 ? 0 : 1 }));
  const out: (ChartPoint & { lastIdx: number })[] = [];
  a.points.forEach((p, i) => {
    const d = new Date(p.at);
    const key = period === "yearly" ? `${d.getFullYear()}` : `${d.getFullYear()}-${d.getMonth()}`;
    const label = period === "yearly" ? `${d.getFullYear()}` : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const prev = out[out.length - 1];
    const isChange = i > 0;
    if (prev && prev.key === key) { prev.v = p.v; prev.changes += isChange ? 1 : 0; prev.lastIdx = i; }
    else out.push({ key, label, v: p.v, delta: null, changes: isChange ? 1 : 0, lastIdx: i });
  });
  out.forEach((p, i) => { p.delta = i === 0 ? null : p.v - out[i - 1].v; });
  return out.slice(period === "monthly" ? -12 : -10).map((p) => ({ key: p.key, label: p.label, v: p.v, delta: p.delta, changes: p.changes }));
}

/** Round axis ticks that cover the values: [0, 100, 200, ...]. */
export function niceTicks(min: number, max: number, want = 4): number[] {
  const range = Math.max(max - min, max * 0.2, 1);
  const raw = range / want;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.max(0, Math.floor((min - step * 0.5) / step) * step);
  const hi = Math.ceil((max + step * 0.5) / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}
