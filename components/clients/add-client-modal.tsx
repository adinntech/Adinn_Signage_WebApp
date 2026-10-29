"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import type { Client } from "@/lib/api/clients";
import { applyServerErrors, CompanyFormFields, EMPTY_COMPANY, useCompanyForm, useCreateClient, type ZohoGstMatch } from "./company-form";

/** Body of the drawer; mounted only while open, so every opening starts with an empty form. */
function AddClientForm({
  initialName,
  onCancel,
  onSaved,
  onUseZohoClient,
}: {
  initialName?: string;
  onCancel: () => void;
  onSaved: (c: Client) => void;
  onUseZohoClient?: (z: ZohoGstMatch) => void;
}) {
  const toast = useToast();
  const form = useCompanyForm({ ...EMPTY_COMPANY, name: initialName ?? "" });
  const { create, busy } = useCreateClient();
  const [pending, setPending] = useState<File[]>([]);

  const submit = form.handleSubmit(async (v) => {
    try {
      const { client, uploadError } = await create(v, pending);
      if (uploadError) toast(`${client.name} was saved, but the GST certificate could not be uploaded: ${uploadError}. Attach it from Client Management.`, "error");
      else toast(`${client.name} registered as ${client.clientNo}.`);
      onSaved(client);
    } catch (err) {
      if (!applyServerErrors(form, err)) form.setError("root", { message: errorMessage(err) });
      toast(errorMessage(err), "error");
    }
  });

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <CompanyFormFields form={form} idPrefix="inline" gst={{ saved: [], pending, onPendingChange: setPending }} onUseZohoClient={onUseZohoClient} />
      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
        <span className="text-xs text-muted-foreground">
          Fields marked <span className="text-danger">*</span> are required. The client is saved to Client Management.
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" loading={busy}>
            <Save className="size-4" aria-hidden /> Save Client
          </Button>
        </div>
      </div>
    </form>
  );
}

/** "+ Add Company" from Order Management / New Lead: the Add Client form in a drawer; the saved client is handed back. */
export function AddClientModal({
  open,
  onOpenChange,
  initialName,
  onSaved,
  onUseZohoClient,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialName?: string;
  onSaved: (c: Client) => void;
  /** The GSTIN typed belongs to a Zoho customer: pick it under Existing Client instead. */
  onUseZohoClient?: (z: ZohoGstMatch) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} variant="drawer" className="max-w-5xl" title="Add New Client" description="Saved to Client Management, then selected for this order.">
      <AddClientForm initialName={initialName} onCancel={() => onOpenChange(false)} onSaved={onSaved} onUseZohoClient={onUseZohoClient} />
    </Modal>
  );
}
