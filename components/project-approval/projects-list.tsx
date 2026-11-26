"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck, CheckCircle2, ChevronRight, Clock, House, Layers, RotateCcw, Search, Store, Upload, UserRound, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useApprovalProjects, type ApprovalProject, type ProjectStatusFilter } from "@/lib/api/projectApproval";
import { cn } from "@/lib/utils";
import { Progress } from "./common";

const FILTERS: { key: ProjectStatusFilter; label: string }[] = [
  { key: "all", label: "All Projects" },
  { key: "pending", label: "Pending Approval" },
  { key: "rejected", label: "Has Rejections" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];
const SIZES = [10, 25, 50] as const;

const chip = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";

function Allocation({ p }: { p: ApprovalProject }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {p.vendor > 0 && <span className={cn(chip, "bg-[#F5F3FF] text-vendor")}><UserRound className="size-3" aria-hidden />Vendor {p.vendor}</span>}
      {p.inhouse > 0 && <span className={cn(chip, "bg-[#ECFDF5] text-[#047857]")}><House className="size-3" aria-hidden />Inhouse {p.inhouse}</span>}
      {p.allocated === 0 && <span className={cn(chip, "bg-[#F1F5F9] font-medium text-[#475569]")}><Layers className="size-3" aria-hidden />Not allocated</span>}
    </div>
  );
}

/** Submitted / Pending / Approved / Rejected as four icon tiles. */
function Counters({ p, className }: { p: ApprovalProject; className?: string }) {
  const items = [
    { l: "Submitted", n: p.submitted, icon: Upload, cls: "bg-[#EFF6FF] text-[#1D4ED8]" },
    { l: "Pending", n: p.pending, icon: Clock, cls: "bg-[#FFF7E6] text-[#B45309]" },
    { l: "Approved", n: p.approved, icon: CheckCircle2, cls: "bg-[#ECFDF5] text-[#047857]" },
    { l: "Rejected", n: p.rejected, icon: XCircle, cls: "bg-[#FEF2F2] text-[#B91C1C]" },
  ];
  return (
    <div className={cn("grid grid-cols-4 gap-1.5", className)}>
      {items.map((i) => (
        <div key={i.l} className={cn("flex min-w-0 flex-col items-center rounded-lg px-1 py-1.5 text-center", i.cls)} title={`${i.n} ${i.l}`}>
          <i.icon className="size-3.5" aria-hidden />
          <p className="text-sm font-bold leading-tight tabular-nums">{i.n}</p>
          <p className="w-full truncate text-[10px] font-medium opacity-90">{i.l}</p>
        </div>
      ))}
    </div>
  );
}

function ProjectCell({ p }: { p: ApprovalProject }) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-[#1E3A8A]">{p.code}</p>
      <p className="truncate text-sm font-semibold uppercase text-[#172B4D]" title={p.name}>{p.name}</p>
      {p.client && <p className="truncate text-xs uppercase text-[#64748B]" title={p.client}>{p.client}</p>}
    </div>
  );
}

const Shops = ({ p }: { p: ApprovalProject }) => (
  <p className="text-sm text-[#334155]"><b className="text-lg tabular-nums text-[#172B4D]">{p.total}</b> shops</p>
);

const viewLink = "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[#BFDBFE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E40AF] shadow-sm transition-colors hover:bg-[#EFF6FF] focus-visible:outline-2 focus-visible:outline-ring";

/** Project Approval: projects the signed-in Client Servicing / Operations user may review, with allocation and approval counts. */
export function ApprovalProjectsList() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useEffect(() => {
    const t = setTimeout(() => { setQ(text.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [text]);
  const list = useApprovalProjects({ q: q || undefined, status, page, limit });
  const rows = list.data?.data ?? [];
  const sno = (i: number) => (page - 1) * limit + i + 1;

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader icon={BadgeCheck} title="Project Approval" subtitle="Review submitted shop recce. Client Servicing and Operations approve independently." />
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_4px_16px_rgba(16,36,73,0.06)]">
        <div className="flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center">
          <label className="relative w-full xl:max-w-md">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search project number, name, client..." className="h-11 rounded-xl pl-10" />
          </label>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:ml-auto xl:w-auto">
            <label className="w-full sm:w-56">
              <span className="sr-only">Project status</span>
              <Select value={status} onChange={(e) => { setStatus(e.target.value as ProjectStatusFilter); setPage(1); }} className="h-11 rounded-xl font-medium">
                {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </Select>
            </label>
            {/* Reset: clears search and status filter, back to page 1. */}
            <Button variant="outline" className="h-11 shrink-0 rounded-xl" disabled={!text && status === "all" && page === 1} onClick={() => { setText(""); setQ(""); setStatus("all"); setPage(1); }}>
              <RotateCcw className="size-4" aria-hidden /> Reset
            </Button>
          </div>
        </div>

        {list.isPending ? (
          <RowsSkeleton className="p-4" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} title="Could not load projects" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Store} title="No projects found" description={q || status !== "all" ? "Try another search or filter." : "Projects with shops appear here."} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden px-3 pb-1 sm:px-4 lg:block">
              <table className="w-full table-fixed text-sm">
                <thead className="text-left text-[11px] font-bold uppercase tracking-wide text-[#334155]">
                  <tr className="[&>th]:bg-[#EEF2F8] [&>th:first-child]:rounded-l-xl [&>th:last-child]:rounded-r-xl">
                    <th className="w-[6%] px-4 py-3">S.No</th>
                    <th className="w-[27%] px-3 py-3">Project</th>
                    <th className="w-[13%] px-3 py-3">Shops</th>
                    <th className="w-[27%] px-3 py-3">Approval Status</th>
                    <th className="w-[15%] px-3 py-3">Progress</th>
                    <th className="w-[12%] px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {rows.map((p, i) => (
                    <tr key={p.id} className="transition-colors hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3.5 font-semibold tabular-nums text-[#475569]">{sno(i)}</td>
                      <td className="px-3 py-3.5"><ProjectCell p={p} /></td>
                      <td className="px-3 py-3.5"><Shops p={p} /><div className="mt-1"><Allocation p={p} /></div></td>
                      <td className="px-3 py-3.5"><Counters p={p} /></td>
                      <td className="px-3 py-3.5"><Progress value={p.progress} /></td>
                      <td className="px-3 py-3.5 text-right">
                        <Link href={`/project-approval/${p.id}`} className={viewLink}>View <span className="hidden xl:inline">Details</span> <ChevronRight className="size-3.5" aria-hidden /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tablet / mobile cards */}
            <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">
              {rows.map((p, i) => (
                <li key={p.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-[#E2E8F0] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#EEF2F8] text-xs font-bold tabular-nums text-[#334155]">{sno(i)}</span>
                      <ProjectCell p={p} />
                    </div>
                    <span className="shrink-0"><Shops p={p} /></span>
                  </div>
                  <Allocation p={p} />
                  <Counters p={p} />
                  <Progress value={p.progress} />
                  <Link href={`/project-approval/${p.id}`} className={cn(viewLink, "w-full")}>View Details <ChevronRight className="size-3.5" aria-hidden /></Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination meta={list.data?.meta} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} sizes={SIZES} />
      </div>
    </div>
  );
}
