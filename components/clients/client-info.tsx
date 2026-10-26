"use client";

import { Building2, Star, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DetailItem, SectionTitle } from "@/components/ui/page-header";
import type { Client, ClientContact } from "@/lib/api/clients";

/** Read-only company details (View Client Details, Order Management view). */
export function CompanyDetailsCard({ client: c, className }: { client: Client; className?: string }) {
  const address = [c.address, c.city, c.district, c.state].filter(Boolean).join(", ");
  return (
    <Card className={className ?? "p-5 sm:p-6"}>
      <SectionTitle icon={Building2} title="Company Details" />
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Company Name">{c.name}</DetailItem>
        <DetailItem label="Client Name">{c.clientName}</DetailItem>
        <DetailItem label="Company Email">{c.email}</DetailItem>
        <DetailItem label="Industry">{c.industry}</DetailItem>
        <DetailItem label="GST Number">{c.gstin}</DetailItem>
        <DetailItem label="Pincode">{c.pincode}</DetailItem>
        <DetailItem label="Address" className="sm:col-span-2 lg:col-span-3">
          {address}
        </DetailItem>
        <DetailItem label="City">{c.city}</DetailItem>
        <DetailItem label="District">{c.district}</DetailItem>
        <DetailItem label="State">{c.state}</DetailItem>
      </dl>
    </Card>
  );
}

export function PrimaryPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
      <Star className="size-3" aria-hidden /> Primary
    </span>
  );
}

/** Read-only contact person table. */
export function ContactsCard({ contacts }: { contacts: ClientContact[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <SectionTitle icon={Users} title="Contact Details" description={`${contacts.length} registered contact person${contacts.length === 1 ? "" : "s"}`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
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
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  No contact persons yet.
                </td>
              </tr>
            )}
            {contacts.map((k, i) => (
              <tr key={`${k.name}-${i}`} className="hover:bg-muted/40">
                <td className="px-5 py-3 font-medium">{k.name}</td>
                <td className="px-5 py-3">{k.designation ?? "-"}</td>
                <td className="px-5 py-3 tabular-nums">
                  {k.phone ? `+91 ${k.phone}` : "-"}
                  {k.alternatePhone && <span className="block text-xs text-muted-foreground">Alt: +91 {k.alternatePhone}</span>}
                </td>
                <td className="px-5 py-3">
                  {k.email ?? "-"}
                  {k.alternateEmail && <span className="block text-xs text-muted-foreground">Alt: {k.alternateEmail}</span>}
                </td>
                <td className="px-5 py-3">{k.isPrimary ? <PrimaryPill /> : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
