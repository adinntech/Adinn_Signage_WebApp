"use client";

import { useState } from "react";
import { Building2, ClipboardList, Hash, MessageSquareText, Star, Store } from "lucide-react";
import { TabPanel, Tabs } from "@/components/ui/tabs";
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
export function BdHandover({ projectId, h, tabbed = true }: { projectId: string; h: ProjectHandover; /** true: sections as tabs (popup). false: every section one below the other in a single scroll (side panel). */ tabbed?: boolean }) {
  const source = { projectId };
  const c = h.client;
  const shops = h.type === "SHOP_DETAILS" || h.type === "SHOP_MEASUREMENT";
  const [tab, setTab] = useState("overview");
  const on = (k: string) => !tabbed || tab === k;
  const chats = h.messages?.length ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gradient-to-r from-navy to-royal px-4 py-3 text-xs text-white">
        <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-sm">{h.projectCode}</span>
        {h.type && <span className="rounded-full bg-white/15 px-3 py-1 font-medium">{HANDOVER_TYPES[h.type].label}</span>}
        <span className="ml-auto text-white/80">{h.assignedAt ? `Assigned ${formatDate(h.assignedAt)}${h.assignedBy ? ` by ${h.assignedBy}` : ""}` : ""}</span>
      </div>
      {tabbed && <Tabs
        label="Handover sections"
        value={tab}
        onChange={setTab}
        className="border-b border-border"
        tabs={[
          { key: "overview", label: "Overview", icon: Hash },
          ...(c ? [{ key: "client", label: "Client & contacts", icon: Building2 }] : []),
          { key: "chat", label: "Messages", icon: MessageSquareText, count: chats },
          ...(shops || (!h.shopList && h.type === "ASO") ? [{ key: "shops", label: shops ? "Shops" : "SO handover", icon: Store }] : []),
        ]}
      />}
      <TabPanel k={tabbed ? tab : "all"} className="space-y-5">
      {on("overview") && (<Card className="p-5">
        <SectionTitle icon={Hash} title="Codes & Assignment" description={`From BD order ${h.orderNo}`} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Project Code">
            <span className="font-mono text-base">{h.projectCode}</span>
          </DetailItem>
          <DetailItem label="Estimation Code">
            <span className="font-mono text-base">{h.estimationCode || "Not added"}</span>
          </DetailItem>
          <DetailItem label="Client ID (Zoho)">{h.clientId ? <span className="font-mono text-base">{h.clientId}</span> : null}</DetailItem>
          <DetailItem label="Assigned">{h.assignedAt ? `${formatDate(h.assignedAt)}${h.assignedBy ? ` by ${h.assignedBy}` : ""}` : null}</DetailItem>
          <DetailItem label="Assign Type">{h.type ? HANDOVER_TYPES[h.type].label : null}</DetailItem>
          {h.note && (
            <DetailItem label="Note from BD" className="sm:col-span-2 lg:col-span-4">
              <span className="whitespace-pre-line">{h.note}</span>
            </DetailItem>
          )}
        </dl>
      </Card>)}

      {on("client") && c && (
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
          {h.type === "ASO" && !!h.soDocuments?.length && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Documents ({h.soDocuments.length})</p>
              <span className="flex flex-wrap gap-1.5">
                {h.soDocuments.map((f) => (
                  <AttachmentChip key={f.fileId} file={f} source={source} />
                ))}
              </span>
            </div>
          )}
        </Card>
      )}

      {!tabbed && <h3 className="pt-2 text-sm font-semibold text-navy">Messages</h3>}
      {on("chat") && <HandoverChat messages={h.messages ?? []} source={source} canPost={false} />}

      {!tabbed && shops && <h3 className="pt-2 text-sm font-semibold text-navy">Shops</h3>}
      {on("shops") && shops && h.type && (
        <ShopTable orderId="" projectId={projectId} type={h.type} summary={h.shopList} editable={false} canAddImages={false} />
      )}
      {on("shops") && !h.shopList && h.type === "ASO" && <EmptyState icon={ClipboardList} title="SO handover" description="No shop list: the shops are collected from the client and SO contacts during the survey." />}
      </TabPanel>
    </div>
  );
}
