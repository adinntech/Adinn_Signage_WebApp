"use client";

import { useState } from "react";
import { CloudDownload, ListPlus, Lock, Pencil, Plus, Save, Star, Users } from "lucide-react";
import { ContactDialog } from "@/components/clients/contact-dialog";
import { FileRefPreview, type PreviewTarget } from "@/components/upload/file-ref-preview";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DetailItem } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import type { ClientContact, ClientDetails } from "@/lib/api/clients";
import type { ZohoClientOption } from "@/lib/api/sales";
import { CompanyFormFields, SavedFileChip, useClientEdit } from "./company-form";

type MiniContact = Pick<ClientContact, "name" | "designation" | "phone" | "email" | "isPrimary">;

/** Contact persons as compact rows (pickers and previews); `onEdit` adds a pencil per row. */
export function ContactMiniList({ contacts, onEdit }: { contacts: MiniContact[]; onEdit?: (index: number) => void }) {
  if (!contacts.length) return <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">No contact persons yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {contacts.map((k, i) => (
        <li key={`${k.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{k.name}</span>
              {k.isPrimary && <Star className="size-3.5 shrink-0 fill-brand text-brand" aria-label="Primary contact" />}
              {k.designation && <span className="truncate text-xs font-normal text-muted-foreground">· {k.designation}</span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{[k.phone && `+91 ${k.phone}`, k.email].filter(Boolean).join(" · ") || "No phone or email"}</span>
          </span>
          {onEdit && (
            <button type="button" onClick={() => onEdit(i)} aria-label={`Edit ${k.name}`} title="Edit contact" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-brand">
              <Pencil className="size-3.5" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function SubHeading({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" aria-hidden /> {children}
    </p>
  );
}

/**
 * New Client (Client Management) preview in Order / Lead pickers: every saved detail, GST certificates (View), custom
 * fields and contact persons, with an Edit pencil that opens the Client Edit drawer.
 */
export function CrmClientCard({ client: c, onEdit }: { client: ClientDetails; onEdit?: () => void }) {
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const certs = c.gstCertificates ?? [];
  const custom = c.customFields ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client details · Client Management</p>
        {onEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${c.name}`}>
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Button>
        )}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailItem label="Company Name">{c.name}</DetailItem>
        <DetailItem label="Client ID">{c.clientNo}</DetailItem>
        <DetailItem label="Client Name">{c.clientName}</DetailItem>
        <DetailItem label="Company Email">{c.email}</DetailItem>
        <DetailItem label="Phone Number">{c.phone}</DetailItem>
        <DetailItem label="GST Number">{c.gstin}</DetailItem>
        <DetailItem label="GST Certificate" className="sm:col-span-2">
          {certs.length ? (
            <span className="flex flex-wrap gap-1.5">
              {certs.map((f) => (
                <SavedFileChip key={f.fileId} file={f} onView={() => setPreview({ saved: f, source: { clientId: c._id } })} />
              ))}
            </span>
          ) : null}
        </DetailItem>
      </dl>
      {custom.length > 0 && (
        <div className="border-t border-border pt-3">
          <SubHeading icon={ListPlus}>Custom Fields</SubHeading>
          <dl className="grid max-h-48 gap-4 overflow-y-auto sm:grid-cols-2">
            {custom.map((f) => (
              <DetailItem key={f.label} label={f.label}>
                {f.value}
              </DetailItem>
            ))}
          </dl>
        </div>
      )}
      <div className="border-t border-border pt-3">
        <SubHeading icon={Users}>Contact Persons ({c.contacts?.length ?? 0})</SubHeading>
        <ContactMiniList contacts={c.contacts ?? []} />
      </div>
      <FileRefPreview target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/** Existing Client (Zoho) preview: everything Zoho has, read-only (edits happen in Zoho, not here). */
export function ZohoClientCard({ zoho: z, loadingContacts }: { zoho: ZohoClientOption; loadingContacts?: boolean }) {
  const address = [z.address, z.city, z.state, z.pincode].filter(Boolean).join(", ");
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CloudDownload className="size-3.5" aria-hidden />
          {z.clientNo ? `Zoho customer · in CRM as ${z.clientNo}` : "Zoho customer · added to the CRM with this order"}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <Lock className="size-3" aria-hidden /> Read-only
        </span>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailItem label="Company Name">{z.name}</DetailItem>
        <DetailItem label="Zoho Client ID">{z.zohoCustomerNo}</DetailItem>
        <DetailItem label="Client Name">{z.clientName}</DetailItem>
        <DetailItem label="Company Email">{z.email}</DetailItem>
        <DetailItem label="Phone Number">{z.phone}</DetailItem>
        <DetailItem label="GST Number">{z.gstin}</DetailItem>
        {z.industry && <DetailItem label="Industry">{z.industry}</DetailItem>}
        {address && (
          <DetailItem label="Address" className="sm:col-span-2">
            {address}
          </DetailItem>
        )}
      </dl>
      <div className="border-t border-border pt-3">
        <SubHeading icon={Users}>Contact Persons{z.contacts ? ` (${z.contacts.length})` : ""}</SubHeading>
        {z.contacts ? <ContactMiniList contacts={z.contacts} /> : loadingContacts ? <Skeleton className="h-12" /> : <p className="text-sm text-muted-foreground">Contact persons could not be loaded from Zoho.</p>}
      </div>
    </div>
  );
}

/** Drawer body; mounted only while open, so every opening loads the latest saved client. */
function ClientEditBody({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { q, form, pending, setPending, submit, busy } = useClientEdit(clientId);
  const [contactIdx, setContactIdx] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const openContact = (i: number | null) => {
    setContactIdx(i);
    setContactOpen(true);
  };

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <>
      <form noValidate autoComplete="off" onSubmit={submit(onClose)} className="space-y-5">
        <CompanyFormFields form={form} idPrefix="drawer" gst={{ clientId, saved: q.data.gstCertificates ?? [], pending, onPendingChange: setPending }} />
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SubHeading icon={Users}>Contact Persons ({q.data.contacts.length})</SubHeading>
            <Button type="button" variant="brand-outline" size="sm" onClick={() => openContact(null)}>
              <Plus className="size-3.5" aria-hidden /> Add Contact
            </Button>
          </div>
          <ContactMiniList contacts={q.data.contacts} onEdit={openContact} />
          <p className="mt-2 text-xs text-muted-foreground">Contact changes are saved right away.</p>
        </section>
        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
          <span className="text-xs text-muted-foreground">Saved to the same client in Client Management.</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" loading={busy}>
              <Save className="size-4" aria-hidden /> Save Changes
            </Button>
          </div>
        </div>
      </form>
      {/* Outside the <form>: its own submit must not also submit the company form (React events bubble through portals). */}
      <ContactDialog client={q.data} index={contactIdx} open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
}

/** Edit a Client Management client from Order / Lead Management without leaving the page (the picker state is kept). */
export function ClientEditDrawer({ clientId, open, onOpenChange }: { clientId: string | undefined; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Modal open={open && !!clientId} onOpenChange={onOpenChange} variant="drawer" className="max-w-5xl" title="Edit Client" description="Changes are saved to Client Management and shown here right away.">
      {clientId && <ClientEditBody clientId={clientId} onClose={() => onOpenChange(false)} />}
    </Modal>
  );
}
