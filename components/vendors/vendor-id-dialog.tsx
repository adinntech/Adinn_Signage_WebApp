"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useSetVendorId, type Vendor } from "@/lib/api/vendors";

/** Accounts replied to the registration mail with the vendor ID: type it here, straight from the vendor list. */
export function VendorIdDialog({ vendor, onClose }: { vendor: Pick<Vendor, "_id" | "name" | "code" | "zohoVendorNo">; onClose: () => void }) {
  const toast = useToast();
  const setId = useSetVendorId();
  const [no, setNo] = useState(vendor.zohoVendorNo ?? "");
  const [error, setError] = useState("");

  function submit() {
    if (!/^\d{2,8}$/.test(no)) return setError("Enter the vendor ID Accounts sent (2 to 8 digits)");
    setId.mutate({ id: vendor._id, vendorNo: no }, { onSuccess: () => { toast(`${vendor.name}: vendor ID ${no} saved, the vendor is now active`); onClose(); }, onError: (e) => setError(errorMessage(e)) });
  }

  return (
    <Modal
      persistent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Enter the mailed vendor ID"
      description={`${vendor.code} · ${vendor.name}`}
      className="max-w-md"
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="bg-royal hover:bg-royal/90" loading={setId.isPending} disabled={no.length < 2} onClick={submit}>Save vendor ID</Button></div>}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Vendor ID from Accounts" htmlFor="vid-no" required error={error} hint="The number Accounts replied with after creating the vendor in Zoho Books">
          <Input id="vid-no" format="digits" maxLength={8} value={no} onChange={(e) => { setNo(e.target.value); setError(""); }} placeholder="e.g. 12543" aria-invalid={!!error} autoFocus />
        </Field>
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Modal>
  );
}
