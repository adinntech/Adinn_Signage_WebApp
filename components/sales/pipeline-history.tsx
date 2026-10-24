"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, GitBranch, Handshake, PlusCircle, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/components/ui/role-badge";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useOrderHistory } from "@/lib/api/sales";
import { formatDateTime } from "@/lib/format";
import { StageBadge } from "./stage";

/** Pipeline History tab: every stage change with who and when. */
export function PipelineHistory({ orderId }: { orderId: string }) {
  const q = useOrderHistory(orderId);
  if (q.isPending) return <RowsSkeleton rows={4} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data.length) return <EmptyState icon={GitBranch} title="No history yet" />;

  return (
    <Card className="p-5 sm:p-6">
      <ol className="relative space-y-5 border-l-2 border-border pl-6">
        {q.data.map((h, i) => {
          const Icon = h.action === "APPROVAL_COMPLETE" ? CheckCircle2 : h.action === "ASSIGN" ? UserCog : h.action === "HANDOVER" ? Handshake : h.action === "CREATE" ? PlusCircle : GitBranch;
          return (
            <motion.li key={h.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }} className="relative">
              <span className="absolute -left-[37px] flex size-7 items-center justify-center rounded-full border-2 border-surface bg-brand text-white">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="rounded-xl border border-border bg-background p-3.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {h.action === "STAGE_CHANGE" && h.fromStage && h.toStage ? (
                    <>
                      <span className="text-xs text-muted-foreground">Previous</span>
                      <StageBadge stage={h.fromStage} />
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                      <span className="text-xs text-muted-foreground">New</span>
                      <StageBadge stage={h.toStage} />
                    </>
                  ) : h.action === "CREATE" ? (
                    <>
                      <span className="font-medium">Order created</span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                      <StageBadge stage="NEW_ORDER" />
                    </>
                  ) : (
                    <span className="font-medium">{h.action === "APPROVAL_COMPLETE" ? "Client approval completed" : (h.note ?? h.action)}</span>
                  )}
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Changed by <span className="font-semibold text-foreground">{h.changedBy || "-"}</span>
                  {h.role && <RoleBadge role={h.role} />}
                  <span>· {formatDateTime(h.at)}</span>
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Card>
  );
}
