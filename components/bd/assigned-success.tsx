"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BellRing, Building2, CalendarClock, Check, ClipboardCheck, FileText, MessageCircle, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientHeader } from "@/components/ui/gradient-header";
import { NotificationStatus } from "./notification-status";
import { ErrorState } from "@/components/ui/states";
import { useProject } from "@/lib/api/projects";
import { formatDate } from "@/lib/format";

export function AssignedSuccess() {
  const { id } = useParams<{ id: string }>();
  const project = useProject(id);

  if (project.isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not load the project" />;
  const p = project.data;

  const rows = [
    { icon: Building2, label: "Client", value: p.client?.name },
    { icon: FileText, label: "Campaign", value: p.campaign },
    { icon: Store, label: "Total Shops", value: p.requirementType === "ASO" ? "Unknown (ASO)" : (p.expectedShops ?? "-") },
    { icon: UserRound, label: "Assigned To", value: p.assignedTo?.name ?? "Not assigned yet" },
    { icon: CalendarClock, label: "Due Date", value: formatDate(p.targetDate) },
  ];
  const timeline = [
    { icon: ClipboardCheck, label: "Created by BD", at: p.createdAt },
    { icon: Check, label: "Assigned to Operations", at: p.assignedAt ?? p.updatedAt },
    { icon: BellRing, label: "Notification Sent", at: p.assignedAt ?? p.updatedAt },
  ];
  const assigned = !!p.assignedTo;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <GradientHeader code="A3" title={assigned ? "Project Assigned Successfully" : "Project Saved"} subtitle="BD / Client Servicing" />
        <div className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-finance text-white shadow-card"
            >
              <Check className="size-8" strokeWidth={3} aria-hidden />
            </motion.span>
            <div>
              <h1 className="text-lg font-semibold text-navy">
                {assigned ? `Project ${p.code} has been assigned to ${p.assignedTo?.name}` : `Project ${p.code} is saved as a draft`}
              </h1>
              <p className="text-sm text-muted-foreground">{assigned ? "It now appears as a new task on the Operations dashboard." : "Assign it from the dashboard when it is ready."}</p>
            </div>
          </div>

          <dl className="divide-y divide-border rounded-xl border border-border">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-4 py-3 text-sm">
                <r.icon className="size-4 shrink-0 text-royal" aria-hidden />
                <dt className="w-32 shrink-0 text-muted-foreground">{r.label}</dt>
                <dd className="font-medium text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>

          <ol className="grid gap-3 sm:grid-cols-3">
            {timeline.map((t, i) => (
              <li key={t.label} className="relative flex flex-col items-center gap-1 rounded-xl bg-[#eef4ff] p-4 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-royal text-white"><t.icon className="size-5" aria-hidden /></span>
                <span className="text-sm font-semibold text-navy">{t.label}</span>
                <span className="text-xs text-muted-foreground">{formatDate(t.at)}</span>
                {i < timeline.length - 1 && <ArrowRight aria-hidden className="absolute -right-3 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-royal sm:block" />}
              </li>
            ))}
          </ol>

          {assigned && (
            <section aria-label="Who was notified">
              <h2 className="mb-2 text-sm font-semibold text-navy">Who was notified</h2>
              <NotificationStatus project={p} />
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="flex-1 border-royal text-royal">
              <Link href={`/bd/dashboard?view=${p._id}`}>View Project</Link>
            </Button>
            <Button asChild className="flex-1 bg-[#16a34a] hover:bg-[#15803d]">
              <Link href={`/bd/whatsapp?project=${p._id}`}><MessageCircle className="size-4" aria-hidden /> Create WhatsApp Group</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/bd/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
