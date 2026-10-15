"use client";

import { useEffect } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useSaveClient, type Client } from "@/lib/api/clients";

const PHONE = /^[+\d][\d\s-]{6,15}$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "2-8 letters or digits"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  address: z.string().trim().max(500),
  city: z.string().trim().max(80),
  state: z.string().trim().max(80),
  gstin: z.string().trim().toUpperCase().refine((v) => v === "" || GSTIN.test(v), "Invalid GSTIN (e.g. 27ABCDE1234F1Z5)"),
  notes: z.string().trim().max(2000),
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Name is required"),
        designation: z.string().trim(),
        phone: z.string().trim().refine((v) => v === "" || PHONE.test(v), "Invalid phone number"),
        email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Invalid email"),
        isPrimary: z.boolean(),
      }),
    )
    .max(20),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  code: "",
  status: "ACTIVE",
  address: "",
  city: "",
  state: "",
  gstin: "",
  notes: "",
  contacts: [],
};

const toForm = (c: Client): FormValues => ({
  name: c.name,
  code: c.code,
  status: c.status,
  address: c.address ?? "",
  city: c.city ?? "",
  state: c.state ?? "",
  gstin: c.gstin ?? "",
  notes: c.notes ?? "",
  contacts: (c.contacts ?? []).map((k) => ({
    name: k.name,
    designation: k.designation ?? "",
    phone: k.phone ?? "",
    email: k.email ?? "",
    isPrimary: !!k.isPrimary,
  })),
});

export function ClientFormDrawer({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: Client | null;
}) {
  const toast = useToast();
  const save = useSaveClient();
  const editing = !!client;
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { fields, append, remove } = useFieldArray({ control, name: "contacts" });

  useEffect(() => {
    if (open) {
      reset(client ? toForm(client) : EMPTY);
      save.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: client?._id,
        body: {
          ...v,
          address: v.address || undefined,
          city: v.city || undefined,
          state: v.state || undefined,
          gstin: v.gstin || undefined,
          notes: v.notes || undefined,
          contacts: v.contacts.map((c) => ({
            ...c,
            designation: c.designation || undefined,
            phone: c.phone || undefined,
            email: c.email || undefined,
          })),
        },
      });
      toast(editing ? "Client updated" : "Client created");
      onOpenChange(false);
    } catch (err) {
      const fe = fieldErrorsOf(err);
      let mapped = false;
      for (const [path, message] of Object.entries(fe)) {
        setError(path as FieldPath<FormValues>, { message });
        mapped = true;
      }
      if (!mapped) setError("root", { message: errorMessage(err) });
    }
  });

  const err = (k: FieldPath<FormValues>) =>
    k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], errors) as
      | { message?: string }
      | undefined;

  return (
    <Modal
      variant="drawer"
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${client?.name}` : "New client"}
      description={editing ? "The client code is fixed once created." : "The code appears in every project ID for this client."}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            Cancel
          </Button>
          <Button type="submit" form="client-form" loading={save.isPending}>
            {editing ? "Save changes" : "Create client"}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Client name" htmlFor="c-name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="c-name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field
            label="Code"
            htmlFor="c-code"
            required
            error={errors.code?.message}
            hint={editing ? "Cannot be changed" : "e.g. AMUL"}
          >
            <Input
              id="c-code"
              aria-invalid={!!errors.code}
              disabled={editing}
              className="uppercase"
              {...register("code", { onChange: (e) => setValue("code", e.target.value.toUpperCase()) })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GSTIN" htmlFor="c-gstin" error={errors.gstin?.message}>
            <Input id="c-gstin" aria-invalid={!!errors.gstin} className="uppercase" {...register("gstin")} />
          </Field>
          <Field label="Status" htmlFor="c-status" error={errors.status?.message}>
            <Select id="c-status" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </div>
        <Field label="Address" htmlFor="c-address" error={errors.address?.message}>
          <Textarea id="c-address" className="min-h-16" {...register("address")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="c-city" error={errors.city?.message}>
            <Input id="c-city" {...register("city")} />
          </Field>
          <Field label="State" htmlFor="c-state" error={errors.state?.message}>
            <Input id="c-state" {...register("state")} />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium">Contacts</legend>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: "", designation: "", phone: "", email: "", isPrimary: fields.length === 0 })}
            >
              <Plus className="size-4" aria-hidden /> Add contact
            </Button>
          </div>
          {fields.length === 0 && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
          {fields.map((f, i) => (
            <div key={f.id} className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" htmlFor={`k-${i}-name`} required error={err(`contacts.${i}.name`)?.message}>
                  <Input id={`k-${i}-name`} {...register(`contacts.${i}.name`)} />
                </Field>
                <Field label="Designation" htmlFor={`k-${i}-des`}>
                  <Input id={`k-${i}-des`} {...register(`contacts.${i}.designation`)} />
                </Field>
                <Field label="Phone" htmlFor={`k-${i}-phone`} error={err(`contacts.${i}.phone`)?.message}>
                  <Input id={`k-${i}-phone`} inputMode="tel" {...register(`contacts.${i}.phone`)} />
                </Field>
                <Field label="Email" htmlFor={`k-${i}-email`} error={err(`contacts.${i}.email`)?.message}>
                  <Input id={`k-${i}-email`} type="email" {...register(`contacts.${i}.email`)} />
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    {...register(`contacts.${i}.isPrimary`, {
                      onChange: (e) => {
                        if (e.target.checked)
                          fields.forEach((_, j) => j !== i && setValue(`contacts.${j}.isPrimary`, false));
                      },
                    })}
                  />
                  Primary contact
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label={`Remove contact ${i + 1}`}>
                  <Trash2 className="size-4 text-danger" aria-hidden /> Remove
                </Button>
              </div>
            </div>
          ))}
        </fieldset>

        <Field label="Notes" htmlFor="c-notes" error={errors.notes?.message}>
          <Textarea id="c-notes" {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
