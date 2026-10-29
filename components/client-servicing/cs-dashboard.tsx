"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2, CalendarClock, ClipboardList, Inbox, Search, Sparkles, UserPlus } from "lucide-react";
import { ClientLookup } from "@/components/clients/client-lookup";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHeader } from "@/components/ui/gradient-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useCsSummary } from "@/lib/api/clientServicing";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
};

/** Client Servicing home: counts of the orders handed over to the signed-in user, the newest orders and a client lookup. */
export function CsDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const s = useCsSummary();
  const d = s.data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        icon={Sparkles}
        title={`${greeting()}, ${user?.name?.split(" ")[0] ?? ""}!`}
        subtitle="Your client servicing overview."
        actions={
          <Button variant="brand" asChild>
            <Link href="/orders">
              <ClipboardList className="size-4" aria-hidden /> My Orders
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Orders Handed Over" value={d?.total} icon={ClipboardList} color="blue" loading={s.isPending} />
        <KpiCard label="New (Not Opened)" value={d?.unseen} icon={Inbox} color="rose" delay={0.04} loading={s.isPending} />
        <KpiCard label="New Clients" value={d?.newClient} icon={UserPlus} color="orange" delay={0.08} loading={s.isPending} />
        <KpiCard label="Existing Clients" value={d?.existingClient} icon={Building2} color="teal" delay={0.12} loading={s.isPending} />
        <KpiCard label="Assigned This Week" value={d?.thisWeek} icon={CalendarClock} color="purple" delay={0.16} loading={s.isPending} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <GradientHeader
            title="Recent Orders"
            subtitle="Newest handovers from BD"
            right={
              <Link href="/orders" className="text-xs font-medium text-white/90 hover:underline">
                View all
              </Link>
            }
          />
          {s.isPending ? (
            <RowsSkeleton rows={5} />
          ) : s.isError ? (
            <ErrorState error={s.error} onRetry={() => s.refetch()} />
          ) : s.data.recent.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No orders assigned to you yet" description="Orders appear here when the BD team hands them over to you." />
          ) : (
            <ul className="divide-y divide-border">
              {s.data.recent.map((o, i) => (
                <motion.li key={o._id} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link href={`/orders/${o._id}?tab=handover`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-brand">{o.orderNo}</span>
                        {!o.handover?.seenAt && <Badge className="bg-brand text-white">New</Badge>}
                        <ClientTypeBadge type={o.clientType} />
                      </span>
                      <span className="block truncate text-sm font-medium">{o.client?.name ?? "-"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[o.client?.clientNo, o.owner?.name && `BD: ${o.owner.name}`, formatDate(o.handover?.assignedAt ?? o.createdAt)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-primary">Find a Client</h2>
            <p className="text-xs text-muted-foreground">Client ID, company name, GST number or PAN.</p>
          </div>
          <ClientLookup onSelect={(c) => router.push(`/client-servicing/clients/${c._id}`)} />
          <Button variant="outline" asChild className="mt-auto">
            <Link href="/client-servicing/clients">
              <Search className="size-4" aria-hidden /> Open Client Finder
            </Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
