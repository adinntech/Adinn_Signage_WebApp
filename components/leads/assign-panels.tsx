"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, LockKeyhole, UserRoundCheck } from "lucide-react";
import type { LeadDetail } from "@/lib/api/leads";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ASSIGN_META } from "./stage-meta";

type Branch = "HANDOVER" | "RECCE";

/** Project Assign: choose who takes the project. Either branch completes the lead. */
export function AssignChooser({ detail, onOpen }: { detail: LeadDetail; onOpen: (k: Branch) => void }) {
  const chosen: Branch | null = detail.handover.assignee ? "HANDOVER" : detail.recce.assignee ? "RECCE" : null;
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
          const assigned = chosen === r.k;
          const blocked = (!!chosen && !assigned) || !r.available;
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
                    {assigned ? `Assigned to ${r.assignee!.name}${r.at ? ` · ${formatDate(r.at)}` : ""}` : chosen ? `Not needed · assigned to ${ASSIGN_META[chosen].short}` : r.available ? "Ready" : "Opens in the next update"}
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

