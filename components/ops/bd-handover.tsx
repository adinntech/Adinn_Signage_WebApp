"use client";

import { Building2, ClipboardList, Hash, Star } from "lucide-react";
import { HandoverChat } from "@/components/handover/handover-chat";
import { ShopTable } from "@/components/handover/shop-table";
import { AttachmentChip } from "@/components/sales/order-comments";
import { Card } from "@/components/ui/card";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import type { ProjectHandover } from "@/lib/api/recce";
import { HANDOVER_TYPES } from "@/lib/api/sales";
import { formatDate } from "@/lib/format";
import { clientIdOf } from "@/lib/api/clients";

/** Operations project > BD Handover: what the BD handed over in Lead Management (read-only). */
export function BdHandover({ projectId, h }: { projectId: string; h: ProjectHandover }) {
  const source = { projectId };
  const c = h.client;
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle icon={Hash} title="Codes & Assignment" description={`From BD order ${h.orderNo}`} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Project Code">
            <span className="font-mono text-base">{h.projectCode}</span>
          </DetailItem>
          <DetailItem label="Estimation Code">
            <span className="font-mono text-base">{h.estimationCode}</span>
          </DetailItem>
          <DetailItem label="Client ID (Zoho)">{h.clientId ? <span className="font-mono text-base">{h.clientId}</span> : null}</DetailItem>
          <DetailItem label="Assigned">{h.assignedAt ? `${formatDate(h.assignedAt)}${h.assignedBy ? ` by ${h.assignedBy}` : ""}` : null}</DetailItem>
          <DetailItem label="Handover Type">{h.type ? HANDOVER_TYPES[h.type].label : null}</DetailItem>
          {h.note && (
            <DetailItem label="Note from BD" className="sm:col-span-2 lg:col-span-4">
              <span className="whitespace-pre-line">{h.note}</span>
            </DetailItem>
          )}
        </dl>
      </Card>

      {c && (
        <Card className="p-5">
          <SectionTitle icon={Building2} title="Client & Contact Persons" />
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Company Name">{c.name}</DetailItem>
            <DetailItem label="Client Name">{c.clientName}</DetailItem>
            <DetailItem label="Client ID">{clientIdOf(c, c.clientType) ?? (c.clientType === "EXISTING" ? h.clientId : undefined)}</DetailItem>
            <DetailItem label="Company Email">{c.email}</DetailItem>
            <DetailItem label="Phone Number">{c.phone}</DetailItem>
            <DetailItem label="GST Number">{c.gstin}</DetailItem>
            {!!c.gstCertificates?.length && (
              <DetailItem label="GST Certificate" className="sm:col-span-2 lg:col-span-3">
                <span className="flex flex-wrap gap-1.5">
                  {c.gstCertificates.map((f) => (
                    <AttachmentChip key={f.fileId} file={f} source={source} />
                  ))}
                </span>
              </DetailItem>
            )}
            {(c.customFields ?? []).map((f) => (
              <DetailItem key={f.label} label={f.label}>
                {f.value}
              </DetailItem>
            ))}
          </dl>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {c.contacts.map((k, i) => (
              <li key={`${k.name}-${i}`} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  {k.name}
                  {k.isPrimary && <Star className="size-3.5 fill-current text-brand" aria-label="Primary" />}
                  {k.designation && <span className="font-normal text-muted-foreground">· {k.designation}</span>}
                </p>
                <p className="text-muted-foreground">{[k.phone ? `+91 ${k.phone}` : null, k.email].filter(Boolean).join(" · ") || "-"}</p>
              </li>
            ))}
          </ul>
          {h.type === "ASO" && !!h.soContacts?.length && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">SO Contacts</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {h.soContacts.map((k, i) => (
                  <li key={`so-${k.phone}-${i}`} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <p className="flex items-center gap-1.5 font-medium">
                      {k.name}
                      {k.isPrimary && <Star className="size-3.5 fill-current text-brand" aria-label="Primary" />}
                    </p>
                    <p className="text-muted-foreground">{[`+91 ${k.phone}`, k.email].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <HandoverChat messages={h.messages ?? []} source={source} canPost={false} />

      {(h.type === "SHOP_DETAILS" || h.type === "SHOP_MEASUREMENT") && (
        <ShopTable orderId="" projectId={projectId} type={h.type} summary={h.shopList} editable={false} canAddImages={false} />
      )}
      {!h.shopList && h.type === "ASO" && <EmptyState icon={ClipboardList} title="ASO handover" description="No shop list: the shops are collected from the client and SO contacts during the survey." />}
    </div>
  );
}
