"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, Handshake, ShieldCheck } from "lucide-react";
import { ShopApprovals, levelsFor } from "@/components/approvals/shop-approvals";
import { SitesTab } from "@/components/sites/sites-tab";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useApproveAll, useApprovalSummary, type ApprovalLevel, type LevelSummary } from "@/lib/api/pipeline";
import type { Project } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdditionalShops } from "./additional-shops";
import { BoardOptions } from "./board-options";
import { RequirementPanel } from "./requirement-panel";

const LEVELS: { level: ApprovalLevel; title: string; icon: typeof ShieldCheck; box: string; chip: string; bar: string }[] = [
  { level: "ops", title: "Recce / Operations Approval", icon: ClipboardCheck, box: "border-[#fcd5a8] bg-[#fff7ed]", chip: "bg-approval", bar: "bg-approval" },
  { level: "bd", title: "BD / Client Servicing Approval", icon: Handshake, box: "border-[#d6c4f5] bg-[#f6f0ff]", chip: "bg-vendor", bar: "bg-vendor" },
];

function ApprovalCard({ cfg, s, mayAct, projectId, readOnly }: { cfg: (typeof LEVELS)[number]; s?: LevelSummary; mayAct: boolean; projectId: string; readOnly: boolean }) {
  const toast = useToast();
  const all = useApproveAll(projectId);
  const done = !!s && s.total > 0 && s.approved === s.total;
  const pct = s && s.total ? Math.round((s.approved / s.total) * 100) : 0;
  return (
    <div className={cn("rounded-xl border p-4", cfg.box)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 items-center justify-center rounded-lg text-white", cfg.chip)}><cfg.icon className="size-4" aria-hidden /></span>
        <h3 className="flex-1 text-sm font-bold text-navy">{cfg.title}</h3>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", done ? "bg-[#e2f8ea] text-finance" : "bg-[#fff0e0] text-approval")}>{done ? "Approved" : "Pending"}</span>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Shops approved</span><span className="font-semibold tabular-nums text-navy">{s?.approved ?? 0} / {s?.total ?? 0}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={`${cfg.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className={cn("h-full rounded-full", cfg.bar)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1 text-xs">
        <dt className="text-muted-foreground">Approved by</dt><dd className="font-medium">{s?.lastBy ?? "-"}</dd>
        <dt className="text-muted-foreground">Approval date</dt><dd className="font-medium">{s?.lastAt ? formatDate(s.lastAt) : "-"}</dd>
        <dt className="text-muted-foreground">Corrections</dt><dd className={cn("font-medium", s?.correction && "text-loss")}>{s?.correction ?? 0}</dd>
        <dt className="text-muted-foreground">Remarks</dt><dd className="font-medium">{s?.note ?? "-"}</dd>
      </dl>
      {s?.correction ? <p className="mt-2 flex items-center gap-1.5 text-xs text-loss"><AlertTriangle className="size-3.5" aria-hidden /> Some shops were sent back for correction.</p> : null}
      {mayAct && !readOnly && (
        <Button
          className={cn("mt-3 w-full text-white", cfg.chip)}
          loading={all.isPending}
          disabled={!s || s.pending === 0}
          onClick={() => all.mutate(cfg.level, { onSuccess: (r) => toast(r.approved ? `Approved ${r.approved} shop(s)` : "Nothing pending to approve"), onError: (e) => toast(errorMessage(e), "error") })}
        >
          <CheckCircle2 className="size-4" aria-hidden /> Approve all pending
        </Button>
      )}
    </div>
  );
}

/**
 * "Client shop with board measurements": shop list + width/height/board type, approved by Operations AND BD
 * (each independently) before the recce, then the boards that fit each shop and the client's decision.
 */
export function MeasurementStage({ project, canEdit, readOnly }: { project: Project; canEdit: boolean; readOnly: boolean }) {
  const { user, can } = useAuth();
  const summary = useApprovalSummary(project._id);
  const mine = levelsFor(user?.role, can);
  return (
    <RequirementPanel
      n={3}
      tone="green"
      title="Client Shop with Board Measurements"
      tag="Detailed Measurement"
      description="Client provides the shop list and board measurements (width & height). Operations and BD both approve before the recce can start."
    >
      <SitesTab project={project} readOnly={readOnly} />
      <AdditionalShops project={project} canEdit={canEdit} />

      <div className="grid gap-4 md:grid-cols-2">
        {LEVELS.map((cfg) => (
          <ApprovalCard key={cfg.level} cfg={cfg} s={summary.data?.[cfg.level]} mayAct={mine.includes(cfg.level)} projectId={project._id} readOnly={readOnly} />
        ))}
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><ShieldCheck className="size-4 text-finance" aria-hidden /> Shop-wise approval</h3>
        <ShopApprovals projectId={project._id} hideSummary readOnly={readOnly} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-navy">Board options &amp; client decision</h3>
        <BoardOptions projectId={project._id} canEdit={canEdit} />
      </div>
    </RequirementPanel>
  );
}
