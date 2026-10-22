"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Building2, Info, Pencil, Star, Trash2, UserPlus, Users } from "lucide-react";
import { z } from "zod";
import { ClientTypeBadge } from "@/components/clients/client-type-badge";
import { contactToApi, contactToForm, normalizeMobile } from "@/components/clients/company-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DetailItem, PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useClient, useSaveClient, type ClientContact, type ClientDetails } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

const mobile = (v: string) => /^[6-9]\d{9}$/.test(normalizeMobile(v));
const email = (v: string) => z.email().safeParse(v).success;
const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter the contact person name").max(120),
  designation: z.string().trim().max(120),
  phone: z.string().trim().min(1, "Enter the mobile number").refine(mobile, "Enter a 10-digit mobile number"),
  alternatePhone: z.string().trim().refine((v) => !v || mobile(v), "Enter a 10-digit mobile number"),
  email: z.string().trim().refine((v) => !v || email(v), "Enter a valid email address"),
  alternateEmail: z.string().trim().refine((v) => !v || email(v), "Enter a valid email address"),
  isPrimary: z.boolean(),
});
type ContactValues = z.infer<typeof contactSchema>;
const EMPTY: ContactValues = { name: "", designation: "", phone: "", alternatePhone: "", email: "", alternateEmail: "", isPrimary: false };

/** Add / edit one contact; saves the whole contact list on the company (PATCH). */
function ContactDialog({ client, index, open, onOpenChange }: { client: ClientDetails; index: number | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const save = useSaveClient();
  const editing = index !== null && index >= 0;
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    values: editing ? contactToForm(client.contacts[index]!) : { ...EMPTY, isPrimary: client.contacts.length === 0 },
  });
  const { register, handleSubmit, formState } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    const next: ClientContact[] = client.contacts.map((k) => ({ ...k, isPrimary: v.isPrimary ? false : k.isPrimary }));
    const c = contactToApi(v);
    if (editing) next[index!] = c;
    else next.push(c);
    try {
      await save.mutateAsync({ id: client._id, body: { contacts: next } });
      toast(editing ? "Contact updated" : "Contact added");
      onOpenChange(false);
    } catch (err) {
      const fe = fieldErrorsOf(err);
      const pos = editing ? index! : next.length - 1;
      const own = Object.entries(fe).filter(([p]) => p.startsWith(`contacts.${pos}.`));
      for (const [p, message] of own) form.setError(p.split(".").pop() as keyof ContactValues, { message });
      if (!own.length) toast(errorMessage(err), "error");
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit Contact Person" : "Add Contact Person"}
      description={client.name}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" type="submit" form="contact-form" loading={save.isPending}>
            Save Contact
          </Button>
        </>
      }
    >
      <form id="contact-form" noValidate onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact Person Name" htmlFor="cd-name" required error={e.name?.message}>
          <Input id="cd-name" aria-invalid={!!e.name} {...register("name")} />
        </Field>
        <Field label="Designation" htmlFor="cd-des">
          <Input id="cd-des" {...register("designation")} />
        </Field>
        <Field label="Mobile Number" htmlFor="cd-phone" required error={e.phone?.message}>
          <Input id="cd-phone" inputMode="tel" aria-invalid={!!e.phone} {...register("phone")} />
        </Field>
        <Field label="Alternate Mobile Number" htmlFor="cd-aphone" error={e.alternatePhone?.message}>
          <Input id="cd-aphone" inputMode="tel" {...register("alternatePhone")} />
        </Field>
        <Field label="Email Address" htmlFor="cd-email" error={e.email?.message}>
          <Input id="cd-email" type="email" {...register("email")} />
        </Field>
        <Field label="Alternate Email Address" htmlFor="cd-aemail" error={e.alternateEmail?.message}>
          <Input id="cd-aemail" type="email" {...register("alternateEmail")} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="size-4 accent-[var(--color-brand)]" {...register("isPrimary")} /> Make this the primary contact
        </label>
      </form>
    </Modal>
  );
}

/** Screen 05: View Client Details. */
export function ClientDetailsView() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("clients:write") && can("sales:write");
  const q = useClient(id);
  const save = useSaveClient();
  const [contactIdx, setContactIdx] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [removeIdx, setRemoveIdx] = useState<number | null>(null);

  if (q.isPending)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  const address = [c.address, c.city, c.district, c.state].filter(Boolean).join(", ");

  const openContact = (i: number | null) => {
    setContactIdx(i);
    setContactOpen(true);
  };
  const removeContact = async () => {
    if (removeIdx === null) return;
    const next = c.contacts.filter((_, i) => i !== removeIdx);
    if (c.contacts[removeIdx]?.isPrimary && next[0]) next[0] = { ...next[0], isPrimary: true };
    try {
      await save.mutateAsync({ id: c._id, body: { contacts: next } });
      toast("Contact removed");
      setRemoveIdx(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        icon={Building2}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {c.name}
            <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
          </span>
        }
        subtitle={
          <>
            Client ID <span className="font-mono font-semibold text-brand">{c.clientNo ?? c.code}</span>
          </>
        }
        actions={
          <Button variant="ghost" asChild>
            <Link href="/clients">
              <ArrowLeft className="size-4" aria-hidden /> Back to Client List
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <SectionTitle icon={Building2} title="Company Details" />
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Company Name">{c.name}</DetailItem>
            <DetailItem label="Company Email">{c.email}</DetailItem>
            <DetailItem label="Industry">{c.industry}</DetailItem>
            <DetailItem label="Address" className="sm:col-span-2 lg:col-span-3">
              {address}
            </DetailItem>
            <DetailItem label="City">{c.city}</DetailItem>
            <DetailItem label="District">{c.district}</DetailItem>
            <DetailItem label="State">{c.state}</DetailItem>
            <DetailItem label="Pincode">{c.pincode}</DetailItem>
            <DetailItem label="GST Number">{c.gstin}</DetailItem>
          </dl>
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={Info} title="Client Information" />
          <dl className="grid grid-cols-2 gap-5">
            <DetailItem label="Client ID">
              <span className="font-mono text-brand">{c.clientNo ?? c.code}</span>
            </DetailItem>
            <DetailItem label="Client Type">
              <ClientTypeBadge type={c.clientType} />
            </DetailItem>
            <DetailItem label="Created Date">{formatDate(c.createdAt)}</DetailItem>
            <DetailItem label="Created By">{c.createdBy?.name}</DetailItem>
            <DetailItem label="Last Updated">{formatDateTime(c.updatedAt)}</DetailItem>
            <DetailItem label="Total Related Orders">
              <span className="text-lg font-bold text-primary">{c.orderCount}</span>
            </DetailItem>
          </dl>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <SectionTitle
            icon={Users}
            title="Contact Details"
            description={`${c.contacts.length} registered contact person${c.contacts.length === 1 ? "" : "s"}`}
            action={
              canWrite && (
                <Button variant="brand-outline" size="sm" onClick={() => openContact(null)}>
                  <UserPlus className="size-4" aria-hidden /> Add Contact
                </Button>
              )
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Designation</th>
                <th className="px-5 py-3">Mobile Number</th>
                <th className="px-5 py-3">Email Address</th>
                <th className="px-5 py-3">Primary</th>
                {canWrite && <th className="px-5 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {c.contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    No contact persons yet.
                  </td>
                </tr>
              )}
              {c.contacts.map((k, i) => (
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
                  <td className="px-5 py-3">
                    {k.isPrimary ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                        <Star className="size-3" aria-hidden /> Primary
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openContact(i)} aria-label={`Edit ${k.name}`}>
                          <Pencil className="size-4" aria-hidden /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" disabled={c.contacts.length <= 1} onClick={() => setRemoveIdx(i)} aria-label={`Remove ${k.name}`}>
                          <Trash2 className="size-4 text-danger" aria-hidden /> Remove
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ContactDialog client={c} index={contactIdx} open={contactOpen} onOpenChange={setContactOpen} />
      <ConfirmDialog
        open={removeIdx !== null}
        onOpenChange={(o) => !o && setRemoveIdx(null)}
        title="Remove contact person?"
        description={`${removeIdx !== null ? c.contacts[removeIdx]?.name : ""} will be removed from ${c.name}. Saved quotations and sent emails keep their own copy of the contact.`}
        confirmLabel="Remove"
        destructive
        loading={save.isPending}
        onConfirm={removeContact}
      />
    </div>
  );
}
