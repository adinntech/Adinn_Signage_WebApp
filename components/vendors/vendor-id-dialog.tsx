"use client";

import { useEffect, useRef, useState } from "react";
import { GetReplyButton } from "@/components/mail/get-reply-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ReplyBanner, replyStatus } from "@/components/mail/reply-banner";
import { correctionReply, useSetVendorId, useVendor, type Vendor } from "@/lib/api/vendors";

/** Accounts replied to the registration mail with the vendor ID: type it here, straight from the vendor list. */
export function VendorIdDialog({ vendor: listed, onClose }: { vendor: Pick<Vendor, "_id" | "name" | "code" | "zohoVendorNo" | "registration">; onClose: () => void }) {
  const toast = useToast();
  // Read live: after Get reply the newest reply appears here without reopening the dialog.
  const live = useVendor(listed._id);
  const vendor = live.data ?? listed;
  const setId = useSetVendorId();
  // Newest reply first, by the time the mail was received (not the order it was read in). Only the LATEST reply gives the ID; an older one never fills it in.
  const stamp = (h: { receivedAt?: string; at?: string }) => new Date(h.receivedAt ?? h.at ?? 0).getTime();
  const history = [...(vendor.registration?.replyHistory ?? [])].sort((a, b) => stamp(b) - stamp(a));
  const latest = history[0] ?? vendor.registration?.reply;
  const detected = latest?.detectedVendorNo;
  const changes = [...(vendor.registration?.idHistory ?? [])].reverse();
  // A reply read after the ID was saved is a correction: its ID is filled in (a person still checks and saves it).
  const r = vendor.registration;
  // The mail's own time can be a few seconds (or a minute) before the save even when the mail came after it (mail clocks, Date header without seconds),
  // so a reply also counts as newer when it was READ after the save.
  const fix = correctionReply(r, vendor.zohoVendorNo);
  const [no, setNo] = useState(vendor.zohoVendorNo ? (fix ? fix.vendorNo : vendor.zohoVendorNo) : detected || "");
  // A new reply fills the box only while the person has not typed in it.
  const typed = useRef(false);
  useEffect(() => { if (!typed.current) setNo(vendor.zohoVendorNo ? (fix ? fix.vendorNo : vendor.zohoVendorNo) : detected || ""); }, [vendor.zohoVendorNo, fix?.vendorNo, detected]); // eslint-disable-line react-hooks/exhaustive-deps
  const [error, setError] = useState("");
  const corrected = !!fix;

  function submit() {
    if (!/^\d{2,8}$/.test(no)) return setError("Enter the vendor ID Accounts sent (2 to 8 digits)");
    setId.mutate({ id: vendor._id, vendorNo: no }, { onSuccess: () => { toast(vendor.zohoVendorNo ? `${vendor.name}: vendor ID changed to ${no}` : `${vendor.name}: vendor ID ${no} saved, the vendor is now active`); onClose(); }, onError: (e) => setError(errorMessage(e)) });
  }

  return (
    <Modal
      persistent
      open
      onOpenChange={(o) => !o && onClose()}
      title={vendor.zohoVendorNo ? "Edit the vendor ID" : "Enter the mailed vendor ID"}
      description={`${vendor.code} · ${vendor.name}`}
      className="max-w-md"
      footer={<div className="flex items-center gap-2"><GetReplyButton className="mr-auto" /><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="bg-royal hover:bg-royal/90" loading={setId.isPending} disabled={no.length < 2 || no === (vendor.zohoVendorNo ?? "")} onClick={submit}>Save vendor ID</Button></div>}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {latest && <div className="mb-3"><ReplyBanner from={latest.from} receivedAt={latest.receivedAt ?? latest.at} status={latest.status} reason={latest.reason} value={latest.detectedVendorNo} valueLabel="Vendor ID" since={vendor.zohoVendorNo ? r?.vendorIdAt : r?.mailSentAt} /></div>}
        <Field label="Vendor ID from Accounts" htmlFor="vid-no" required error={error} hint={corrected ? `Saved ID is ${vendor.zohoVendorNo}. The latest reply from ${latest?.from} says ${detected}, filled in below. Check it, then save, or keep the old one.` : detected ? `Read from the latest reply of ${latest?.from}. Check it, then save.` : latest ? `The latest reply from ${latest.from} has no vendor ID I could read. Type it in.` : "The number Accounts replied with after creating the vendor in Zoho Books"}>
          <Input id="vid-no" format="digits" maxLength={8} value={no} onChange={(e) => { typed.current = true; setNo(e.target.value); setError(""); }} placeholder="e.g. 12543" aria-invalid={!!error} autoFocus />
        </Field>
        {changes.length > 0 && (
          <div className="mt-4 rounded-lg border border-border">
            <p className="border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy">ID changes ({changes.length})</p>
            <ul className="max-h-32 divide-y divide-border overflow-y-auto text-xs">
              {changes.map((c, i) => <li key={i} className="px-3 py-2"><span className="font-semibold text-navy">{c.from ? `${c.from} → ${c.to}` : `Set ${c.to}`}</span> <span className="text-muted-foreground">· {c.byName ?? ""} · {formatDateTime(c.at)}</span></li>)}
            </ul>
          </div>
        )}
        {history.length > 0 && (
          <div className="mt-4 rounded-lg border border-border">
            <p className="border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy">Replies read ({history.length})</p>
            <ul className="max-h-40 divide-y divide-border overflow-y-auto text-xs">
              {history.map((h, i) => (
                <li key={i} className="px-3 py-2"><span className="font-semibold text-navy">{h.detectedVendorNo ?? "No ID found"}</span>{replyStatus(h.status) && <Badge tone={replyStatus(h.status)!.tone} className="ml-1">{replyStatus(h.status)!.label}</Badge>} <span className="text-muted-foreground">· {h.from} · {formatDateTime(h.receivedAt ?? h.at)}{h.note ? ` · ${h.note}` : ""}</span>{h.snippet && <span className="block truncate text-muted-foreground" title={h.snippet}>{h.snippet}</span>}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Modal>
  );
}
