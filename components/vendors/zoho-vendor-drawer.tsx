"use client";

import { BadgeIndianRupee, Building2, Hash, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ZohoVendorRow } from "@/lib/api/vendors";
import { gstinInfo } from "@/lib/gstin";
import { formatDate } from "@/lib/format";

const Line = ({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) => (
  <div className="flex items-start gap-2"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><dd className="min-w-0 break-words">{children}</dd></div>
);

/** All the details of one Zoho vendor, with its cost. Opens when a row of the vendor master is clicked. */
export function ZohoVendorDrawer({ vendor: v, canWrite, onCost, onClose }: { vendor: ZohoVendorRow | null; canWrite: boolean; onCost: (v: ZohoVendorRow) => void; onClose: () => void }) {
  const gst = v?.gstin ? gstinInfo(v.gstin) : null;
  return (
    <Modal open={!!v} onOpenChange={(o) => !o && onClose()} title={v?.name ?? "Vendor"} description={v ? `${v.vendorNo ? `Vendor ID ${v.vendorNo}` : "No vendor ID"} · Zoho Books` : undefined} variant="drawer" className="max-w-xl">
      {v && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={v.zohoStatus === "active" ? "success" : "neutral"}>{v.zohoStatus === "active" ? "Active in Zoho" : "Inactive in Zoho"}</Badge>
            {v.vendor && <Badge tone="info">Registered · {v.vendor.code}</Badge>}
            {canWrite && <Button size="sm" variant="outline" className="ml-auto" onClick={() => { onCost(v); }}><BadgeIndianRupee className="size-4" aria-hidden /> {v.price.ratePerShop != null ? "Edit cost" : "Add cost"}</Button>}
          </div>

          <dl className="space-y-2 text-sm">
            <Line icon={Phone}>{v.mobile ?? <span className="text-muted-foreground">No phone in Zoho</span>}</Line>
            <Line icon={Mail}>{v.email ?? <span className="text-muted-foreground">No email in Zoho</span>}</Line>
            <Line icon={MapPin}>{[v.address, v.city].filter(Boolean).join(", ") || <span className="text-muted-foreground">No address in Zoho</span>}</Line>
            <Line icon={UserRound}>Created by {v.createdByName ?? "–"}{v.zohoCreatedAt ? ` on ${formatDate(v.zohoCreatedAt)}` : ""}</Line>
            <Line icon={Hash}><span className="font-mono text-xs text-muted-foreground">Zoho contact {v.zohoContactId}</span></Line>
          </dl>

          <section aria-label="Business details" className="rounded-xl border border-border p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><Building2 className="size-4 text-royal" aria-hidden /> Business details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">GST number</p><p className="break-all font-medium">{v.gstin ?? "–"}</p></div>
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">PAN</p><p className="font-medium">{v.pan ?? gst?.pan ?? "–"}</p></div>
              {gst && (
                <>
                  <div className="rounded-lg bg-[#eef4ff] p-3"><p className="text-xs text-muted-foreground">State (from GST)</p><p className="font-medium text-navy">{gst.state}</p></div>
                  <div className="rounded-lg bg-[#eef4ff] p-3"><p className="text-xs text-muted-foreground">Business type (from PAN)</p><p className="font-medium text-navy">{gst.entity}</p></div>
                </>
              )}
            </div>
          </section>

          <section aria-label="Cost" className="rounded-xl border border-border p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy"><BadgeIndianRupee className="size-4 text-vendor" aria-hidden /> Cost</h3>
            {v.price.ratePerShop == null ? (
              <p className="text-sm text-muted-foreground">No cost added yet. The company rate applies.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-[#f6f0ff] p-3"><p className="text-xs text-muted-foreground">Price per shop</p><p className="font-bold text-vendor">₹{v.price.ratePerShop}</p></div>
                  <div className="rounded-lg bg-[#f6f0ff] p-3"><p className="text-xs text-muted-foreground">Travelling cost</p><p className="font-bold text-vendor">{v.price.farRatePerShop != null ? `₹${v.price.farRatePerShop}` : "Company rate"}</p></div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">{(v.price.skills ?? []).length ? v.price.skills.map((k) => <span key={k} className="rounded-full bg-[#f1e6ff] px-2.5 py-0.5 text-xs font-medium text-vendor">{k}</span>) : <span className="text-xs text-muted-foreground">No skills added</span>}</div>
              </>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
