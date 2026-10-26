"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useSaveClient, type Client, type ClientContact } from "@/lib/api/clients";
import { contactToApi, contactToForm, normalizeMobile } from "./company-form";

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

/** Add / edit one contact person; saves the whole contact list on the company (PATCH). `index` null = add. */
export function ContactDialog({
  client,
  index,
  open,
  onOpenChange,
}: {
  client: Pick<Client, "_id" | "name" | "contacts">;
  index: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
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
