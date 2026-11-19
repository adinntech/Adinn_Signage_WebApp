"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useMonitor, useProgress, type Monitor, type Perf } from "@/lib/api/recceReview";
import { fmtDate } from "./common";

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? "text-primary"}`}>{value}</p>
    </Card>
  );
}
function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-success transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Shop-wise and project-wise progress, derived on the server from the real submission and review records. */
export function ProgressView() {
  const [projectId, setProjectId] = useState("");
  const valid = !projectId || /^[a-f\d]{24}$/i.test(projectId);
  const q = useProgress(valid && projectId ? projectId : undefined);
  return (
    <div className="flex flex-col gap-4">
      <label className="max-w-md text-sm">
        <span className="text-muted-foreground">Project id (leave empty for all your projects)</span>
        <Input value={projectId} onChange={(e) => setProjectId(e.target.value.trim())} placeholder="All projects" aria-invalid={!valid} />
      </label>
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <ProgressBody d={q.data} />
      )}
    </div>
  );
}

function ProgressBody({ d }: { d: NonNullable<ReturnType<typeof useProgress>["data"]> }) {
  const t = d.totals;
  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Completion (approved shops)</span>
          <span className="tabular-nums">{d.completionPercent}% · {t.completed} of {t.assigned}</span>
        </div>
        <div className="mt-2"><Bar percent={d.completionPercent} /></div>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Assigned" value={t.assigned} />
        <Stat label="Not started" value={t.notStarted} />
        <Stat label="In progress" value={t.inProgress} />
        <Stat label="Submitted" value={t.submitted} />
        <Stat label="Under review" value={t.underReview} />
        <Stat label="Approved" value={t.approved} tone="text-success" />
        <Stat label="Rework" value={t.reworkRequired} tone="text-warning" />
        <Stat label="Rejected" value={t.rejected} tone="text-danger" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pending reviews" value={d.pendingReview} />
        <Stat label="Pending rework" value={d.pendingRework} />
        <Stat label="Overdue reviews" value={d.overdueReviews} tone={d.overdueReviews ? "text-danger" : undefined} />
        <Stat label="Avg review time" value={d.avgReviewHours == null ? "-" : `${d.avgReviewHours} h`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">Media type completion</h3>
          {d.mediaTypes.length === 0 ? (
            <EmptyState title="No media yet" />
          ) : (
            <ul className="flex flex-col gap-3">
              {d.mediaTypes.map((m) => (
                <li key={m.name} className="text-sm">
                  <div className="mb-1 flex justify-between"><span>{m.name}</span><span className="tabular-nums text-muted-foreground">{m.approved}/{m.total}</span></div>
                  <Bar percent={m.percent} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">Reviewer workload</h3>
          {d.reviewerWorkload.length === 0 ? (
            <EmptyState title="No review activity" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">Reviewer</th><th className="font-medium">Pending</th><th className="font-medium">Decided</th></tr></thead>
              <tbody>
                {d.reviewerWorkload.map((r) => (
                  <tr key={r.reviewer} className="border-t border-border"><td className="py-1.5">{r.reviewer}</td><td className="tabular-nums">{r.pending}</td><td className="tabular-nums">{r.decided}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">Average attempts per shop: {d.avgAttempts}. A shop that is revised is counted once, by its current status.</p>
    </>
  );
}

function PerfTable({ title, rows }: { title: string; rows: Perf[] }) {
  return (
    <Card className="overflow-x-auto p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState title="No data yet" />
      ) : (
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>{["Name", "Shops", "Approved", "Pending", "Rework", "Avg attempts", "Done"].map((h) => <th key={h} className="py-1 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-border">
                <td className="py-1.5">{r.name}</td><td>{r.total}</td><td>{r.approved}</td><td>{r.pending}</td><td>{r.rework}</td><td>{r.avgAttempts}</td>
                <td className="w-28"><Bar percent={r.completionPercent} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ShopList({ title, list }: { title: string; list: Monitor["overdue"] }) {
  return (
    <Card className="overflow-x-auto p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {list.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <table className="w-full min-w-[520px] text-sm">
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t border-border first:border-0">
                <td className="py-1.5">
                  <Link className="font-medium text-accent hover:underline" href={`/recce-review/${r.id}`}>{r.shopName ?? r.siteCode}</Link>
                  <span className="block text-xs text-muted-foreground">{r.projectCode} · {r.assignee}</span>
                </td>
                <td>{r.pendingStageLabel ?? "-"}</td>
                <td className="text-xs">Due {fmtDate(r.dueAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Events({ title, list }: { title: string; list: Monitor["approvalHistory"] }) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {list.length === 0 ? (
        <EmptyState title="No events" />
      ) : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
          {list.map((e) => (
            <li key={e.id} className="border-t border-border pt-2 first:border-0 first:pt-0">
              <Link href={`/recce-review/${e.submissionId}`} className="font-medium hover:underline">{e.label}</Link>
              <span className="block text-xs text-muted-foreground">{e.actor} · {fmtDate(e.at)}{e.reason ? ` · ${e.reason}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Admin / Management monitoring. */
export function MonitorView() {
  const q = useMonitor(true);
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const m = q.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Active projects" value={m.activeProjects} />
        <Stat label="Shops tracked" value={m.totals.shops} />
        <Stat label="Awaiting review" value={m.totals.awaitingReview} />
        <Stat label="Overdue" value={m.totals.overdue} tone={m.totals.overdue ? "text-danger" : undefined} />
        <Stat label="Rework backlog" value={m.totals.reworkBacklog} tone="text-warning" />
        <Stat label="Extra photos asked" value={m.totals.pendingAdditionalPhotos} />
        <Stat label="Approved" value={m.totals.approved} tone="text-success" />
        <Stat label="Review SLA met" value={m.slaPercent == null ? "-" : `${m.slaPercent}%`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ShopList title="Overdue reviews" list={m.overdue} />
        <ShopList title="Shops awaiting review" list={m.awaiting} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PerfTable title="Vendor-wise completion" rows={m.vendorCompletion} />
        <PerfTable title="In-house recce completion" rows={m.inHouseCompletion} />
      </div>
      <Card className="overflow-x-auto p-4">
        <h3 className="mb-2 text-sm font-medium">Review performance (average decision time {m.avgDecisionHours == null ? "-" : `${m.avgDecisionHours} h`})</h3>
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">Reviewer</th><th className="font-medium">Approved</th><th className="font-medium">Rework</th><th className="font-medium">Rejected</th></tr></thead>
          <tbody>
            {m.reviewPerformance.map((r) => (
              <tr key={r.reviewer} className="border-t border-border"><td className="py-1.5">{r.reviewer}</td><td>{r.approved}</td><td>{r.rework}</td><td>{r.rejected}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Events title="Approval history" list={m.approvalHistory} />
        <Events title="Deleted and restored photo activity" list={m.deletedPhotoActivity} />
      </div>
    </div>
  );
}
