"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Bell, Building2, CheckCircle2, ChevronRight, Clock, Eye, Home, MapPin, Search, Send, Store, Users, XCircle, type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useApprovalOverview, useApprovalShops, type ApprovalOverview, type ApprovalShop, type ShopTab } from "@/lib/api/projectApproval";
import { cn } from "@/lib/utils";
import { DECISION_LOOK, fmtDateTime, fmtGps, Pill, Progress, Section, VISIT_LOOK } from "./common";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

/* ------------------------------------------------ KPI tiles ------------------------------------------------ */

const KPI_TONE = {
  red: { card: "from-[#FFF1F1] border-[#FDE2E2]", icon: "bg-[#FEE2E2] text-loss" },
  green: { card: "from-[#EEFBF3] border-[#D5F3E1]", icon: "bg-[#D1FAE5] text-finance" },
  teal: { card: "from-[#EDFAF7] border-[#CFF2EA]", icon: "bg-[#CCFBF1] text-recce" },
  amber: { card: "from-[#FFF8EC] border-[#FDECC8]", icon: "bg-[#FEF3C7] text-[#D97706]" },
  blue: { card: "from-[#EFF5FF] border-[#DBE7FE]", icon: "bg-[#DBEAFE] text-royal" },
  purple: { card: "from-[#F6F1FF] border-[#E9DDFD]", icon: "bg-[#EDE9FE] text-vendor" },
} as const;

function Kpi({ label, value, icon: Icon, tone, hint }: { label: string; value: number; icon: LucideIcon; tone: keyof typeof KPI_TONE; hint?: string }) {
  const t = KPI_TONE[tone];
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-2xl border bg-gradient-to-br to-white p-3.5 sm:p-4", t.card)}>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl sm:size-12", t.icon)}><Icon className="size-5 sm:size-6" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight text-[#334155]">{label}</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold leading-none tabular-nums text-[#172B4D]">{value}</p>
          {hint && <span className="text-xs font-semibold tabular-nums text-[#64748B]">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ charts ------------------------------------------------ */

function Muted({ icon: Icon = Clock, text }: { icon?: LucideIcon; text: string }) {
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 text-center text-sm text-[#64748B]">
      <span className="grid size-10 place-items-center rounded-full bg-[#F1F5F9] text-[#94A3B8]"><Icon className="size-5" aria-hidden /></span>
      {text}
    </div>
  );
}

function Trend({ data }: { data: ApprovalOverview["trend"] }) {
  if (data.length < 2) return <Muted text="Trend appears after submissions on two or more days." />;
  const W = 320, H = 150, L = 26, R = 10, T = 12, B = 22;
  const max = Math.max(1, ...data.map((d) => d.submitted));
  const x = (i: number) => L + (i * (W - L - R)) / (data.length - 1);
  const y = (v: number) => H - B - (v * (H - T - B)) / max;
  const line = (k: "submitted" | "approved") => data.map((d, i) => `${x(i)},${y(d[k])}`).join(" ");
  const last = data.at(-1)!;
  const day = (s: string) => new Date(`${s}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return (
    <div>
      <div className="mb-1 flex flex-wrap justify-end gap-3 text-[11px] text-[#475569]">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-royal" />Submitted: <b>{last.submitted}</b></span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-finance" />Approved: <b>{last.approved}</b></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={`Cumulative submitted ${last.submitted}, approved ${last.approved}`}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke="#EEF2F7" />
            <text x={L - 6} y={y(max * t) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{Math.round(max * t)}</text>
          </g>
        ))}
        <polygon points={`${x(0)},${y(0)} ${line("approved")} ${x(data.length - 1)},${y(0)}`} fill="#059669" opacity="0.08" />
        <polyline points={line("submitted")} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={line("approved")} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => <circle key={d.date} cx={x(i)} cy={y(d.submitted)} r="2.5" fill="#fff" stroke="#2563EB" strokeWidth="1.5" />)}
        <text x={L} y={H - 6} fontSize="9" fill="#64748B">{day(data[0]!.date)}</text>
        <text x={W - R} y={H - 6} fontSize="9" fill="#64748B" textAnchor="end">{day(last.date)}</text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------ shop list ------------------------------------------------ */

const TABS: { key: ShopTab; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "Shop List", icon: Store },
  { key: "inhouse", label: "Inhouse", icon: Users },
  { key: "vendor", label: "Vendor", icon: Building2 },
  { key: "submitted", label: "Submitted", icon: Send },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
  { key: "pending", label: "Pending", icon: Clock },
];

function Channel({ s }: { s: ApprovalShop }) {
  if (s.channel === "VENDOR") return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[11px] font-semibold text-vendor"><Building2 className="size-3" aria-hidden />Vendor</span>;
  if (s.channel === "IN_HOUSE") return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#F0FDFA] px-2 py-0.5 text-[11px] font-semibold text-recce"><Users className="size-3" aria-hidden />Inhouse</span>;
  return <span className="whitespace-nowrap text-[11px] text-[#94A3B8]">Not allocated</span>;
}
const Boards = ({ s }: { s: ApprovalShop }) => (
  <div className="flex flex-wrap gap-1">{s.boardTypes.length ? s.boardTypes.map((b) => <span key={b} className="whitespace-nowrap rounded-md bg-[#FEF2F2] px-1.5 py-0.5 text-[11px] font-semibold text-[#B91C1C]">{b}</span>) : <span className="text-xs text-[#94A3B8]">-</span>}</div>
);
function Thumb({ s, size = "size-11" }: { s: ApprovalShop; size?: string }) {
  return s.thumb ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed storage link
    <img src={s.thumb} alt="" loading="lazy" className={cn(size, "shrink-0 rounded-lg border border-[#E2E8F0] object-cover")} />
  ) : (
    <span className={cn(size, "grid shrink-0 place-items-center rounded-lg bg-[#F1F5F9] text-[#94A3B8]")}><Store className="size-4" aria-hidden /></span>
  );
}
const Stage = ({ c }: { c: ApprovalShop["cs"] }) => (c ? <Pill look={DECISION_LOOK[c.decision]} title={c.reviewer ? `${c.reviewer} · ${fmtDateTime(c.decidedAt)}` : undefined} /> : <span className="text-[#94A3B8]">–</span>);

function ShopTable({ projectId, hasVendor, hasInhouse }: { projectId: string; hasVendor: boolean; hasInhouse: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<ShopTab>("all");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useEffect(() => {
    const t = setTimeout(() => { setQ(text.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [text]);
  const shops = useApprovalShops(projectId, { tab, q: q || undefined, page, limit });
  const rows = shops.data?.items ?? [];
  const tabs = TABS.filter((t) => (t.key !== "vendor" || hasVendor) && (t.key !== "inhouse" || hasInhouse));
  const href = (siteId: string) => `/project-approval/${projectId}/shops/${siteId}`;
  const start = shops.data ? (shops.data.meta.page - 1) * shops.data.meta.limit : 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#EEF2F7] p-3 sm:p-4 xl:flex-row xl:items-center">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Shop filter">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => { setTab(t.key); setPage(1); }}
                className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors", on ? "border-loss bg-loss text-white shadow-sm" : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]")}
              >
                <Icon className="size-3.5" aria-hidden />
                {t.label}
                {shops.data && <span className={cn("tabular-nums", on ? "text-white/90" : "text-[#64748B]")}>({shops.data.tabs[t.key]})</span>}
              </button>
            );
          })}
        </div>
        <label className="relative w-full xl:ml-auto xl:w-72">
          <span className="sr-only">Search shops</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search shop name, location..." className="pl-9" />
        </label>
      </div>

      {shops.isPending ? (
        <RowsSkeleton className="p-4" />
      ) : shops.isError ? (
        <ErrorState error={shops.error} onRetry={() => shops.refetch()} title="Could not load shops" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Store} title="No shops here" description="Try another filter or search." />
      ) : (
        <>
          {/* Desktop table (scrolls inside its own box only when the screen is narrower than the table) */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-[#F8FAFC] text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="w-10 py-3 pl-4">#</th>
                  <th className="px-3 py-3">Shop</th>
                  <th className="px-3 py-3">Assigned To</th>
                  <th className="px-3 py-3">Board Types</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3">Visit Status</th>
                  <th className="px-3 py-3">Ver.</th>
                  <th className="px-3 py-3">Client Approval</th>
                  <th className="px-3 py-3">Operations Approval</th>
                  <th className="px-3 py-3">GPS / Timestamp</th>
                  <th className="py-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {rows.map((s, i) => (
                  <tr key={s.siteId} className="cursor-pointer transition-colors hover:bg-[#F8FAFC]" onClick={() => router.push(href(s.siteId))}>
                    <td className="py-3 pl-4 text-xs text-[#64748B] tabular-nums">{start + i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Thumb s={s} />
                        <div className="min-w-0 max-w-56">
                          <p className="truncate font-semibold text-[#172B4D]" title={s.shopName ?? s.siteCode}>{s.shopName ?? s.siteCode}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-[#64748B]"><MapPin className="size-3 shrink-0 text-loss" aria-hidden />{s.location ?? s.siteCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Channel s={s} />{s.team && <p className="mt-1 max-w-36 truncate text-xs text-[#475569]" title={s.team}>{s.team}</p>}</td>
                    <td className="px-3 py-3"><div className="max-w-44"><Boards s={s} /></div></td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{s.quantity ?? "-"}</td>
                    <td className="px-3 py-3"><Pill look={VISIT_LOOK[s.visitStatus]} /></td>
                    <td className="px-3 py-3 font-semibold text-[#334155]">{s.version ? `V${s.version}` : "–"}</td>
                    <td className="px-3 py-3"><Stage c={s.cs} /></td>
                    <td className="px-3 py-3"><Stage c={s.ops} /></td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[#475569]">{s.gps ? <><p className="tabular-nums">{fmtGps(s.gps.lat, s.gps.lng)}</p><p className="text-[#64748B]">{fmtDateTime(s.gps.at ?? s.submittedAt)}</p></> : <span className="text-[#94A3B8]">–</span>}</td>
                    <td className="py-3 pr-4 text-right">
                      <Link href={href(s.siteId)} onClick={(e) => e.stopPropagation()} aria-label={`Review ${s.shopName ?? s.siteCode}`} className="inline-grid size-8 place-items-center rounded-lg border border-[#E2E8F0] text-[#334155] hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-royal focus-visible:outline-2 focus-visible:outline-ring">
                        <Eye className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tablet / mobile cards */}
          <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">
            {rows.map((s) => (
              <li key={s.siteId}>
                <Link href={href(s.siteId)} className="flex h-full min-w-0 flex-col gap-3 rounded-xl border border-[#E2E8F0] p-3.5 transition-colors hover:border-[#BFDBFE] focus-visible:outline-2 focus-visible:outline-ring">
                  <div className="flex min-w-0 items-start gap-3">
                    <Thumb s={s} size="size-14" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#172B4D]">{s.shopName ?? s.siteCode}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-[#64748B]"><MapPin className="size-3 shrink-0 text-loss" aria-hidden />{s.location ?? s.siteCode}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><Channel s={s} />{s.team && <span className="truncate text-xs text-[#475569]">{s.team}</span>}</div>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-xs font-semibold text-[#334155]">{s.version ? `V${s.version}` : "–"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2"><Boards s={s} /><span className="shrink-0 text-xs text-[#64748B]">Qty <b className="text-[#172B4D]">{s.quantity ?? "-"}</b></span></div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#F8FAFC] p-2 text-[11px] text-[#64748B]">
                    <div className="min-w-0"><p className="mb-1">Visit</p><Pill look={VISIT_LOOK[s.visitStatus]} /></div>
                    <div className="min-w-0"><p className="mb-1">Client</p><Stage c={s.cs} /></div>
                    <div className="min-w-0"><p className="mb-1">Operations</p><Stage c={s.ops} /></div>
                  </div>
                  {s.gps && <p className="text-[11px] text-[#64748B]">{fmtGps(s.gps.lat, s.gps.lng)} · {fmtDateTime(s.gps.at ?? s.submittedAt)}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Pagination meta={shops.data?.meta} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} sizes={[10, 25, 50]} />
    </section>
  );
}

/* ------------------------------------------------ page ------------------------------------------------ */

/** Project Approval > one project: summary cards, analytics from real submissions, and every shop with both stages' decisions. */
export function ApprovalProjectOverview({ projectId }: { projectId: string }) {
  const q = useApprovalOverview(projectId);
  if (q.isPending) return <div className="space-y-4"><Skeleton className="h-16" /><div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div><Skeleton className="h-64 rounded-2xl" /></div>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this project" />;
  const d = q.data;
  const c = d.counts;
  const hasVendor = c.vendor > 0;
  const hasInhouse = c.inhouse > 0;
  const perfTitle = hasVendor && hasInhouse ? "Vendor / Inhouse Performance" : hasVendor ? "Vendor Performance" : hasInhouse ? "Inhouse Performance" : "Team Performance";

  return (
    <div className="min-w-0 space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
        <Home className="size-3.5" aria-hidden /><ChevronRight className="size-3" aria-hidden />
        <Link href="/project-approval" className="hover:text-royal">Project Approval</Link><ChevronRight className="size-3" aria-hidden />
        <span className="font-semibold text-[#172B4D]">{d.project.code}</span>
      </nav>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-stretch gap-3">
          <span className="w-1.5 shrink-0 rounded-full bg-loss" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#172B4D] sm:text-2xl">Project Overview</h1>
            <p className="break-words text-sm text-[#475569]"><b className="font-semibold text-[#334155]">{d.project.code}</b> – {d.project.name}</p>
            {d.project.client && <p className="text-xs text-[#64748B]">Client: {d.project.client}</p>}
          </div>
        </div>
        <Link href="/project-approval" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]">
          <ArrowLeft className="size-4" aria-hidden /> All projects
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3">
        <Kpi label="Total Shops" value={c.total} icon={Store} tone="red" />
        <Kpi label="Submitted" value={c.submitted} icon={Send} tone="green" hint={`${pct(c.submitted, c.total)}%`} />
        <Kpi label="Approved (Completed)" value={c.approved} icon={CheckCircle2} tone="teal" hint={`${pct(c.approved, c.total)}%`} />
        <Kpi label="Pending Review" value={c.pending} icon={Clock} tone="amber" hint={`${pct(c.pending, c.total)}%`} />
        <Kpi label="Rejected" value={c.rejected} icon={XCircle} tone="red" hint={`${pct(c.rejected, c.total)}%`} />
        {hasInhouse && <Kpi label="Inhouse Assigned Shops" value={c.inhouse} icon={Users} tone="purple" />}
        {hasVendor && <Kpi label="Vendor Assigned Shops" value={c.vendor} icon={Building2} tone="blue" />}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Section title="Team Allocation">
          {d.team.length === 0 ? <Muted icon={Users} text={c.total ? `${c.total} shops are not allocated yet.` : "No shops yet."} /> : (
            <div className="space-y-4">
              {d.team.map((t) => (
                <div key={t.channel} className="flex items-center gap-3">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", t.channel === "VENDOR" ? "bg-[#F5F3FF] text-vendor" : "bg-[#F0FDFA] text-recce")}>{t.channel === "VENDOR" ? <Building2 className="size-4" aria-hidden /> : <Users className="size-4" aria-hidden />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#172B4D]">{t.channel === "VENDOR" ? "Vendors" : "Inhouse"} <span className="font-normal text-[#64748B]">· {t.allocated} shops</span></p>
                    <Progress value={pct(t.approved, t.allocated)} color="bg-finance" />
                    <p className="text-[11px] text-[#64748B]">{t.submitted} submitted · {t.approved} approved</p>
                  </div>
                </div>
              ))}
              {c.unallocated > 0 && <p className="rounded-lg bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#64748B]">{c.unallocated} shop{c.unallocated > 1 ? "s" : ""} not allocated.</p>}
            </div>
          )}
        </Section>
        <Section title={perfTitle} extra="(Top 6)">
          {d.performance.length === 0 ? <Muted icon={Building2} text="No allocation yet." /> : (
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-[#64748B]"><tr><th className="pb-2">Team</th><th className="pb-2 text-right">Alloc.</th><th className="pb-2 text-right">Appr.</th><th className="w-[38%] pb-2 pl-2">Progress</th></tr></thead>
              <tbody>
                {d.performance.map((p) => (
                  <tr key={`${p.group}-${p.name}`} className="border-t border-[#EEF2F7]">
                    <td className="max-w-24 truncate py-2 font-medium text-[#172B4D]" title={p.name}>{p.name}</td>
                    <td className="py-2 text-right tabular-nums">{p.allocated}</td>
                    <td className="py-2 text-right tabular-nums">{p.approved}</td>
                    <td className="py-2 pl-2"><Progress value={p.percent} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        <Section title="Project Progress Trend" className="md:col-span-2 xl:col-span-1"><Trend data={d.trend} /></Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Section title="SLA & Alerts">
          <ul className="divide-y divide-[#EEF2F7] text-sm">
            {([[d.alerts.overdue, "Shops – overdue approvals", "bg-loss"], [d.alerts.repeatedRejection, "Shops – repeated rejection (≥ 2 times)", "bg-planning"], [d.alerts.pendingVisit, "Shops – pending site visit (> 3 days)", "bg-planning"]] as const).map(([n, l, dot]) => (
              <li key={l} className="flex items-center gap-2.5 py-2 text-[#334155]"><span className={cn("size-2.5 shrink-0 rounded-full", dot)} aria-hidden /><b className="tabular-nums">{n}</b><span className="min-w-0">{l}</span></li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {(["CS", "OPS"] as const).map((st) => (
              <div key={st} className="rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-2.5">
                <p className="font-semibold text-[#172B4D]">{st === "CS" ? "Client Servicing" : "Operations"}</p>
                <p className="mt-1 flex flex-wrap gap-x-2 text-[#64748B]"><span className="text-[#047857]">{d.stages[st].approved} approved</span><span className="text-[#B45309]">{d.stages[st].pending} pending</span><span className="text-[#B91C1C]">{d.stages[st].rejected} rejected</span></p>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Approval Queue" extra={`(${d.queueTotal ?? d.queue.length})`}>
          {d.queue.length === 0 ? <Muted icon={CheckCircle2} text={c.submitted ? "All submitted shops are decided. Nothing waiting." : "No shop recce submitted yet."} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead className="text-left text-[10px] uppercase tracking-wide text-[#64748B]"><tr><th className="pb-2">Shop</th><th className="pb-2">Ver.</th><th className="pb-2">Waiting For</th><th className="pb-2 text-right">Age</th></tr></thead>
                <tbody>
                  {d.queue.map((r) => (
                    <tr key={r.submissionId} className="border-t border-[#EEF2F7]">
                      <td className="max-w-36 truncate py-2"><Link href={`/project-approval/${projectId}/shops/${r.siteId}`} className="font-medium text-[#172B4D] hover:text-royal">{r.shopName}</Link></td>
                      <td className="py-2 text-xs">V{r.version}</td>
                      <td className="py-2 text-xs"><span className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 font-medium", r.kind === "RESUBMIT" ? "bg-[#FEF2F2] text-[#B91C1C]" : "bg-[#FFFBEB] text-[#B45309]")}>{r.waitingFor.join(", ") || "-"}</span></td>
                      <td className="py-2 text-right"><span className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold", r.overdue || r.ageDays >= 2 ? "bg-[#FEF2F2] text-[#B91C1C]" : "bg-[#F1F5F9] text-[#475569]")}>{r.ageDays} day{r.ageDays === 1 ? "" : "s"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section title="Notifications / Activity Feed" className="lg:col-span-2 2xl:col-span-1">
          {d.activity.length === 0 ? <Muted icon={Bell} text="No activity yet." /> : (
            <ul className="divide-y divide-[#EEF2F7]">
              {d.activity.map((a) => {
                const bad = /REJECT|REWORK/.test(a.type);
                const good = /APPROV/.test(a.type);
                const Icon = bad ? XCircle : good ? CheckCircle2 : a.type.includes("OVERDUE") ? AlertTriangle : Bell;
                return (
                  <li key={a.id} className="flex gap-2.5 py-2 text-xs">
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", bad ? "bg-[#FEF2F2] text-loss" : good ? "bg-[#ECFDF5] text-finance" : "bg-[#EFF6FF] text-royal")}><Icon className="size-3.5" aria-hidden /></span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#172B4D]">{a.label}{a.shopName ? ` – ${a.shopName}` : ""}</p>
                      <p className="line-clamp-2 text-[#64748B]" title={a.reason}>{a.actor} · {fmtDateTime(a.at)}{a.reason ? ` · ${a.reason}` : ""}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <ShopTable projectId={projectId} hasVendor={hasVendor} hasInhouse={hasInhouse} />
    </div>
  );
}
