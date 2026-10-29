"use client";

import { GitBranch, MessageSquare, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { UserSelect } from "@/components/pickers";
import { Card } from "@/components/ui/card";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { STAGE_META, useReassignOwner, type Order } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { OrderTab } from "./order-detail-view";
import { STAGE_ICONS, StageBadge } from "./stage";
import { clientIdOf } from "@/lib/api/clients";

const STAGE_TAB = { COMPANY_PROFILE: "profile", RATE_CARD: "ratecard", CLIENT_APPROVAL: "approval" } as const;

/** Overview tab (shared by every stage). */
export function OrderOverview({ order, onOpenTab }: { order: Order; onOpenTab?: (t: OrderTab) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const reassign = useReassignOwner(order._id);
  const c = order.client;
  const address = [c.address, c.city, c.district, c.state].filter(Boolean).join(", ") + (c.pincode ? ` - ${c.pincode}` : "");

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="p-5 sm:p-6 xl:col-span-2">
        <SectionTitle title="Client Information" />
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Order ID">
            <span className="font-mono text-brand">{order.orderNo}</span>
          </DetailItem>
          <DetailItem label="Client ID">
            <span className="font-mono">{clientIdOf(c, order.clientType)}</span>
          </DetailItem>
          <DetailItem label="Company Name">{c.name}</DetailItem>
          <DetailItem label="Company Email">{c.email}</DetailItem>
          <DetailItem label="GST Number">{c.gstin}</DetailItem>
          <DetailItem label="Client Type">
            <ClientTypeBadge type={order.clientType} />
          </DetailItem>
          <DetailItem label="Company Address" className="sm:col-span-2 lg:col-span-3">
            {address.trim() || undefined}
          </DetailItem>
        </dl>
      </Card>
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Order Status" />
        <dl className="grid gap-5">
          <DetailItem label="Current Stage">
            <StageBadge stage={order.stage} />
          </DetailItem>
          <DetailItem label="Created Date & Time">{formatDateTime(order.createdAt)}</DetailItem>
          <DetailItem label="Created By">{order.createdBy?.name}</DetailItem>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              <label htmlFor="assigned-bd">Assigned BD</label>
            </dt>
            <dd className="mt-1">
              {can("sales:write") ? (
                <UserSelect
                  id="assigned-bd"
                  roles={["BD"]}
                  placeholder="Unassigned"
                  value={order.owner?._id ?? ""}
                  disabled={reassign.isPending}
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    try {
                      await reassign.mutateAsync(e.target.value);
                      toast("Assigned BD updated");
                    } catch (err) {
                      toast(errorMessage(err), "error");
                    }
                  }}
                />
              ) : (
                <span className="text-sm font-medium">{order.owner?.name ?? "Unassigned"}</span>
              )}
            </dd>
          </div>
        </dl>
        {onOpenTab && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Zap className="size-3.5" aria-hidden /> Quick Actions
            </p>
            <div className="grid gap-2">
              {order.stage !== "NEW_ORDER" && (() => {
                const Icon = STAGE_ICONS[order.stage];
                return (
                  <Button variant="brand-outline" className="justify-start" onClick={() => onOpenTab(STAGE_TAB[order.stage as keyof typeof STAGE_TAB])}>
                    <Icon className="size-4" aria-hidden /> Open {STAGE_META[order.stage].label}
                  </Button>
                );
              })()}
              <Button variant="outline" className="justify-start" onClick={() => onOpenTab("comments")}>
                <MessageSquare className="size-4" aria-hidden /> Add Comment
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => onOpenTab("history")}>
                <GitBranch className="size-4" aria-hidden /> Pipeline History
              </Button>
            </div>
          </div>
        )}
      </Card>
      <Card className="overflow-hidden xl:col-span-3">
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <SectionTitle title="Contact Persons" description={`${c.contacts.length} registered`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Designation</th>
                <th className="px-5 py-3">Mobile Number</th>
                <th className="px-5 py-3">Email Address</th>
                <th className="px-5 py-3">Primary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {c.contacts.map((k, i) => (
                <tr key={`${k.name}-${i}`}>
                  <td className="px-5 py-3 font-medium">{k.name}</td>
                  <td className="px-5 py-3">{k.designation ?? "-"}</td>
                  <td className="px-5 py-3 tabular-nums">{k.phone ? `+91 ${k.phone}` : "-"}</td>
                  <td className="px-5 py-3">{k.email ?? "-"}</td>
                  <td className="px-5 py-3">{k.isPrimary ? <Star className="size-4 fill-brand text-brand" aria-label="Primary contact" /> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
