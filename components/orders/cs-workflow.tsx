"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, History, LockKeyhole, Route } from "lucide-react";
import { csRecceAssign, nextStepOf, resolveStep } from "@/components/leads/assign-steps";
import { LeadFullDetails } from "@/components/leads/lead-full-details";
import { HistoryList } from "@/components/leads/lead-workspace";
import { RecceFlowMap } from "@/components/leads/lead-mind-map";
import { Button } from "@/components/ui/button";
import { RecceBranchPanel, type RecceStep } from "@/components/leads/recce-panel";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { SectionTitle } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useLead } from "@/lib/api/leads";
import { useRecce } from "@/lib/api/recce";
import type { Order } from "@/lib/api/sales";

/**
 * Client Servicing (My Orders > order): the order continues with Assign to Recce Team, using the BD's Recce steps,
 * map and drawers. Handover sent without details: Handover Type & Details first; with details: straight to the
 * request email. The open step lives in the URL (?tab=workflow&step=), so a refresh resumes it.
 */
export function CsWorkflow({ order, basePath }: { order: Order; /** Page the steps open on (default: My Orders > Workflow). */ basePath?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const q = useRecce(order._id);
  const [celebrate, setCelebrate] = useState(false);
  // Full Details / History: the BD's lead drawer and history list, loaded when first opened (read-only).
  const [view, setView] = useState<"details" | "history" | null>(null);
  const lead = useLead(view ? order._id : undefined);
  const asked = params.get("step");
  const base = basePath ?? `/orders/${order._id}?tab=workflow`;
  const openStep = (s: string | null) => router.replace(`${base}${s ? `${base.includes("?") ? "&" : "?"}step=${encodeURIComponent(s)}` : ""}`, { scroll: false });

  if (q.isPending) return <Skeleton className="h-[520px]" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const a = csRecceAssign(q.data);
  const shown = asked ? resolveStep(a, "RECCE", asked) : null;
  const step = (shown ? (shown.history ? "history" : shown.step.step) : null) as RecceStep | null;

  /** A step was saved: reload, then open the next one (or close and say what is next). */
  const finish = async (from: string, openNext: boolean) => {
    const r = await q.refetch();
    const next = r.data ? nextStepOf(csRecceAssign(r.data), "RECCE", from) : null;
    openStep(openNext && next ? next.step : null);
    if (next) toast(`Next: ${next.label}`);
  };

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        icon={Route}
        title="Workflow"
        action={
          <span className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("details")}>
              <Eye className="size-4" aria-hidden /> Full Details
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView("history")}>
              <History className="size-4" aria-hidden /> History
            </Button>
          </span>
        }
        description={
          q.data.csFlow?.handoverSent
            ? "The BD sent the handover details: send the project code request email, save the codes, then assign the Recce / Operations person."
            : "The BD sent client details only: complete Assign Type & Details, then the request email, the codes and the Recce / Operations person."
        }
      />
      <Modal
        open={!!view}
        onOpenChange={(o) => !o && setView(null)}
        variant={view === "details" ? "drawer" : "dialog"}
        className={view === "details" ? "max-w-6xl" : "max-w-2xl"}
        titleClassName="text-lg"
        title={view === "history" ? "Lead History" : "Full Details"}
        description={view === "history" ? `${order.orderNo} · BD and Client Servicing events, newest first` : `${order.orderNo} · ${order.client.name} · every saved stage, read-only`}
      >
        {lead.isPending ? (
          <Skeleton className="h-64" />
        ) : lead.isError ? (
          <ErrorState error={lead.error} onRetry={() => lead.refetch()} />
        ) : view === "history" ? (
          <HistoryList history={lead.data.history} large />
        ) : (
          <LeadFullDetails detail={lead.data} />
        )}
      </Modal>
      <RecceFlowMap a={a} onOpen={openStep} onBlocked={(why) => toast(why, "info")} celebrate={celebrate} />
      <Modal
        open={!!shown}
        onOpenChange={(o) => !o && openStep(null)}
        variant="drawer"
        className="max-w-6xl"
        title={shown ? `Assign to Recce Team · ${shown.history ? "Email History" : shown.step.label}` : "Assign to Recce Team"}
      >
        {shown && step &&
          (shown.blocked ? (
            <EmptyState icon={LockKeyhole} title="Not open yet" description={shown.blocked} />
          ) : (
            <RecceBranchPanel
              key={step}
              detail={{ order, handover: { assignee: null } }}
              step={step}
              onDone={() => void finish(step, step === "handover" || step === "email" || step === "codes")}
              onAssigned={() => {
                openStep(null);
                void q.refetch().then(() => setCelebrate(true));
              }}
            />
          ))}
      </Modal>
    </Card>
  );
}
