"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Inbox, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { RowsSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { useInbox, type InboxFilters, type InboxRow } from "@/lib/api/recceReview";
import { DecisionBadge, OverdueBadge, StatusBadge, fmtDate } from "./common";

const VIEWS: { key: NonNullable<InboxFilters["view"]>; label: string }[] = [
  { key: "pending", label: "Awaiting review" },
  { key: "mine", label: "My turn" },
  { key: "all", label: "All submissions" },
];

/** Shared Review Inbox for Recce Operations, Client Servicing and Admin: a clean table with an expandable details drawer. */
export function ReviewInbox({ projectId }: { projectId?: string }) {
  const [f, setF] = useState<InboxFilters>({ view: "pending", page: 1, ...(projectId ? { projectId } : {}) });
  const [open, setOpen] = useState<InboxRow | null>(null);
  const q = useInbox(f);
  const set = (patch: Partial<InboxFilters>) => setF((p) => ({ ...p, ...patch, page: patch.page ?? 1 }));
  const rows = q.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Review views" className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <button key={v.key} role="tab" aria-selected={f.view === v.key} onClick={() => set({ view: v.key })} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${f.view === v.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground hover:bg-muted"}`}>
            {v.label}
          </button>
        ))}
      </div>

      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2">
          <span className="sr-only">Search shop, project code or dealer</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search shop, project code, dealer" value={f.q ?? ""} onChange={(e) => set({ q: e.target.value })} />
        </label>
        <Input aria-label="Client" placeholder="Client" value={f.client ?? ""} onChange={(e) => set({ client: e.target.value })} />
        <Input aria-label="District" placeholder="District" value={f.district ?? ""} onChange={(e) => set({ district: e.target.value })} />
        <Input aria-label="Media type" placeholder="Media type (e.g. GSB)" value={f.mediaType ?? ""} onChange={(e) => set({ mediaType: e.target.value })} />
        <Select aria-label="Review status" value={f.status ?? ""} onChange={(e) => set({ status: e.target.value as InboxFilters["status"], view: e.target.value ? "all" : f.view })}>
          <option value="">Any status</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="APPROVED">Approved</option>
          <option value="REWORK_REQUIRED">Rework required</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <Select aria-label="Priority" value={f.priority ?? ""} onChange={(e) => set({ priority: e.target.value })}>
          <option value="">Any priority</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </Select>
        <Select aria-label="Due" value={f.overdue ?? ""} onChange={(e) => set({ overdue: e.target.value as "true" | "" })}>
          <option value="">Any due date</option>
          <option value="true">Overdue only</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          From <Input type="date" value={f.from ?? ""} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          To <Input type="date" value={f.to ?? ""} onChange={(e) => set({ to: e.target.value })} />
        </label>
        <div className="flex items-end">
          <Button variant="ghost" size="sm" onClick={() => setF({ view: f.view ?? "pending", page: 1, ...(projectId ? { projectId } : {}) })}>Clear filters</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {q.isPending ? (
          <RowsSkeleton rows={6} className="p-4" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Inbox} title="Nothing to review here" description="Submitted shop recces will appear here as soon as a vendor or in-house recce person sends them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <caption className="sr-only">Shop recce submissions waiting for review</caption>
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Shop", "Project / Client", "Recce person", "Submitted", "Photos", "Media types", "Stage", "SLA", "Status", ""].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{r.shopName ?? r.siteCode}</p>
                      <p className="text-xs text-muted-foreground">{r.siteCode}{r.district ? ` · ${r.district}` : ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{r.projectCode}</p>
                      <p className="text-xs text-muted-foreground">{r.client ?? "-"}</p>
                    </td>
                    <td className="px-3 py-3">
                      {r.assignee ?? "-"}
                      <p className="text-xs text-muted-foreground">{r.channel === "VENDOR" ? "Vendor" : "In-house"}</p>
                    </td>
                    <td className="px-3 py-3">{fmtDate(r.submittedAt)}<p className="text-xs text-muted-foreground">v{r.version}{r.attempts > 1 ? ` · attempt ${r.attempts}` : ""}</p></td>
                    <td className="px-3 py-3 tabular-nums">{r.photoCount}</td>
                    <td className="max-w-[180px] px-3 py-3"><span className="line-clamp-2">{r.mediaTypes.join(", ") || "-"}</span></td>
                    <td className="px-3 py-3">
                      {r.pendingStageLabel ? (<><p>{r.pendingStageLabel}</p><p className="text-xs text-muted-foreground">{r.pendingReviewer}</p></>) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-3">
                      {r.overdue ? <OverdueBadge /> : r.dueAt && ["SUBMITTED", "UNDER_REVIEW"].includes(r.status) ? <span className="text-xs">Due {fmtDate(r.dueAt)}</span> : <span className="text-muted-foreground">-</span>}
                      {r.pendingDays > 0 && <p className="text-xs text-muted-foreground">{r.pendingDays} day{r.pendingDays > 1 ? "s" : ""} pending</p>}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={r.status} />{r.priority === "HIGH" && <Badge tone="danger" className="ml-1">High</Badge>}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setOpen(r)} aria-label={`Details of ${r.shopName ?? r.siteCode}`}>Details <ChevronRight className="size-3.5" aria-hidden /></Button>
                        <Button asChild size="sm"><Link href={`/recce-review/${r.id}`}>Review</Link></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={q.data?.meta} onPage={(page) => setF((p) => ({ ...p, page }))} />
      </Card>

      <Modal open={!!open} onOpenChange={(o) => !o && setOpen(null)} variant="drawer" title={open?.shopName ?? open?.siteCode ?? "Submission"} description={open ? `${open.projectCode} · ${open.client ?? ""}` : undefined}
        footer={open && <Button asChild><Link href={`/recce-review/${open.id}`}><ExternalLink className="size-4" aria-hidden /> Open review workspace</Link></Button>}>
        {open && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap gap-2"><StatusBadge status={open.status} />{open.overdue && <OverdueBadge />}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[["Recce person", open.assignee ?? "-"], ["Submitted", fmtDate(open.submittedAt)], ["Version", `v${open.version} (attempt ${open.attempts})`], ["Photos", String(open.photoCount)], ["Media types", open.mediaTypes.join(", ") || "-"], ["Due", fmtDate(open.dueAt)]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Review stages</p>
              <ul className="flex flex-col gap-1.5">
                {open.stages.map((s) => (
                  <li key={s.stage} className="flex items-center justify-between rounded-lg border border-border px-3 py-2"><span>{s.label}{s.reviewer ? ` · ${s.reviewer}` : ""}</span><DecisionBadge decision={s.decision} /></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
