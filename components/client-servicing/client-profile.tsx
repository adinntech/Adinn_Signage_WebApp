"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, ClipboardList, Eye, FileText, Users } from "lucide-react";
import { CompanyDetailsCard, ContactsCard } from "@/components/clients/client-info";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailItem, PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useClient } from "@/lib/api/clients";
import { useOrders } from "@/lib/api/sales";
import { formatDate } from "@/lib/format";

type Tab = "overview" | "contacts" | "documents" | "orders";

/** Client Profile: the verified client master record (read-only) with its contacts, documents and the user's own orders. */
export function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const q = useClient(id);
  const orders = useOrders({ clientId: id, limit: 20, sort: "-createdAt" });
  const [tab, setTab] = useState<Tab>("overview");

  if (q.isPending)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  const docs = c.gstCertificates ?? [];
  const orderRows = orders.data?.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/client-servicing/clients">
          <ArrowLeft className="size-4" aria-hidden /> Back to Clients
        </Link>
      </Button>
      <PageHeader icon={Building2} title={c.name} subtitle={[c.clientNo, c.city].filter(Boolean).join(" · ")}>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ClientTypeBadge type={c.clientType} full />
          <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
          <Badge tone="neutral">
            {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </PageHeader>

      <Tabs
        idPrefix="cs-client"
        value={tab}
        onChange={setTab}
        items={[
          { key: "overview", label: "Overview", icon: Building2 },
          { key: "contacts", label: "Contacts", icon: Users, badge: c.contacts.length },
          { key: "documents", label: "Documents", icon: FileText, badge: docs.length },
          { key: "orders", label: "My Orders", icon: ClipboardList, badge: orders.data?.meta.total },
        ]}
      />

      <TabPanel k={tab}>
        {tab === "overview" && (
          <div className="grid gap-5">
            <CompanyDetailsCard client={c} />
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={FileText} title="Tax & Codes" description="Verified details from the client master." />
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Client ID">{c.clientNo}</DetailItem>
                <DetailItem label="GST Number">{c.gstin}</DetailItem>
                <DetailItem label="PAN">{c.onboarding?.pan}</DetailItem>
                <DetailItem label="Approved Client Code">
                  <span className="font-normal text-muted-foreground">Not confirmed yet</span>
                </DetailItem>
              </dl>
            </Card>
          </div>
        )}
        {tab === "contacts" && <ContactsCard contacts={c.contacts} />}
        {tab === "documents" && (
          <Card className="p-5 sm:p-6">
            <SectionTitle icon={FileText} title="Client Documents" description="GST certificates on file." />
            {docs.length === 0 ? (
              <EmptyState icon={FileText} title="No documents on file" description="Documents uploaded at registration appear here." />
            ) : (
              <CompanyDetailsCard client={c} className="border-0 p-0 shadow-none" />
            )}
          </Card>
        )}
        {tab === "orders" && (
          <Card className="overflow-hidden">
            {orders.isError ? (
              <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
            ) : orderRows.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No orders of yours for this client" description="Only orders handed over to you are listed." />
            ) : (
              <ul className="divide-y divide-border">
                {orderRows.map((o) => (
                  <li key={o._id}>
                    <Link href={`/orders/${o._id}?tab=handover`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                      <span className="font-mono text-xs font-semibold text-brand">{o.orderNo}</span>
                      <span className="flex-1 text-xs text-muted-foreground">Handed over {formatDate(o.handover?.assignedAt ?? o.createdAt)}</span>
                      <Eye className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </TabPanel>
    </div>
  );
}
