"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, CircleAlert, Info, LockKeyhole, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import type { LeadDetail } from "@/lib/api/leads";
import { useHandover } from "@/lib/api/sales";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ASSIGN_META } from "./stage-meta";

type Branch = "HANDOVER" | "RECCE";

/**
 * Before any route is taken. Handover details are shared by both routes; the route is taken by the Client Servicing
 * assignment or the first project code request email, and the other route is then disabled.
 */
export function RouteNotice({ branch }: { branch: Branch }) {
  const m = ASSIGN_META[branch];
  const other = ASSIGN_META[branch === "HANDOVER" ? "RECCE" : "HANDOVER"];
  const action = branch === "HANDOVER" ? "Assigning the Client Servicing person" : "Sending the project code request email";
  return (
    <p className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: `${m.color}55`, background: m.soft }}>
      <Info className="mt-0.5 size-4 shrink-0" style={{ color: m.color }} aria-hidden />
      <span>
        {action} continues with the <b>{m.short}</b> route, and the <b>{other.short}</b> route is then disabled. Handover details saved here are shared by both routes.
      </span>
    </p>
  );
}

/**
 * Bottom of a handover details step: what is still missing, or "complete" with Continue to the next step. Reads the
 * handover itself, so it follows every save in the step.
 */
export function StepFooter({ orderId, next, onContinue, missing: given }: { orderId: string; next: string; onContinue: () => void | Promise<void>; missing?: string[] }) {
  const q = useHandover(orderId);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!q.data) return null;
  const go = async () => {
    setBusy(true);
    try {
      await onContinue();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };
  // The Recce team always gets the full handover: its gaps are those of the full handover.
  // `given`: gaps worked out by the caller (Recce route: the full handover, whatever the Client Servicing toggle).
  const missing = given ?? q.data.missing;
  const ready = missing.length === 0;
  return (
    <div className={cn("sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-card backdrop-blur", ready ? "border-success/40 bg-success-soft/90" : "border-warning/40 bg-warning-soft/90")}>
      {ready ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden /> : <CircleAlert className="size-5 shrink-0 text-warning" aria-hidden />}
      <p className="min-w-0 flex-1 text-sm">{ready ? <b>Handover details complete.</b> : <>To continue: {missing[0]}</>}</p>
      <Button variant="brand" disabled={!ready} loading={busy} onClick={() => void go()}>
        Continue: {next} <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/** Project Assign: choose who takes the project. Either branch completes the lead. */
export function AssignChooser({ detail, onOpen }: { detail: LeadDetail; onOpen: (k: Branch) => void }) {
  const chosen: Branch | null = detail.handover.assignee ? "HANDOVER" : detail.recce.assignee ? "RECCE" : (detail.route ?? null);
  const assignedTo = detail.handover.assignee ? "HANDOVER" : detail.recce.assignee ? "RECCE" : null;
  const rows: { k: Branch; assignee: { name: string } | null; at: string | null; available: boolean }[] = [
    { k: "HANDOVER", assignee: detail.handover.assignee, at: detail.handover.assignedAt, available: true },
    { k: "RECCE", assignee: detail.recce.assignee, at: detail.recce.assignedAt, available: detail.recce.available },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Assign the project to <span className="font-semibold text-foreground">Client Servicing</span> or to the <span className="font-semibold text-foreground">Recce team</span>. Assigning either one completes the lead.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r, i) => {
          const m = ASSIGN_META[r.k];
          const assigned = assignedTo === r.k;
          const blocked = (!!chosen && chosen !== r.k) || !r.available;
          return (
            <motion.button
              key={r.k}
              type="button"
              onClick={() => onOpen(r.k)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className={cn("group flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2", blocked && "opacity-70")}
              style={{ borderColor: blocked ? "#cbd5e1" : m.color, background: `linear-gradient(135deg, ${m.soft}, #ffffff 70%)` }}
            >
              <span className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full text-white" style={{ background: blocked ? "#94a3b8" : m.color }}>
                  {assigned ? <UserRoundCheck className="size-6" aria-hidden /> : blocked ? <LockKeyhole className="size-5" aria-hidden /> : <m.icon className="size-6" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-primary">{m.label}</span>
                  <span className="block text-xs font-medium" style={{ color: blocked ? undefined : m.color }}>
                    {assigned
                      ? `Assigned to ${r.assignee!.name}${r.at ? ` · ${formatDateTimeIST(r.at)}` : ""}`
                      : chosen === r.k
                        ? "In progress"
                        : chosen
                          ? assignedTo
                            ? `Not needed · assigned to ${ASSIGN_META[chosen].short}`
                            : `Disabled · ${ASSIGN_META[chosen].short} route in progress`
                          : "Ready: the first save picks this route"}
                  </span>
                </span>
              </span>
              <ul className="space-y-1.5">
                {m.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 shrink-0" style={{ color: blocked ? "#cbd5e1" : m.color }} aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold" style={{ color: blocked ? "#64748b" : m.color }}>
                {assigned ? "View assignment" : "Open"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

