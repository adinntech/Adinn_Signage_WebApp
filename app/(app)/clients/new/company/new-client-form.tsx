"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, SaveAll, UserPlus } from "lucide-react";
import { applyServerErrors, CompanyFormFields, EMPTY_COMPANY, FormActionBar, useCompanyForm, useCreateClient, type CompanyValues } from "@/components/clients/company-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";

/** Add Client: company details, GST certificate and custom fields. Orders for the client are created in Order Management. */
export function NewClientForm() {
  const router = useRouter();
  const toast = useToast();
  const form = useCompanyForm(EMPTY_COMPANY);
  const { create, busy } = useCreateClient();
  const [pending, setPending] = useState<File[]>([]);
  const [addAnother, setAddAnother] = useState(false);

  const save = async (v: CompanyValues, another: boolean) => {
    let r;
    try {
      r = await create(v, pending);
    } catch (err) {
      if (!applyServerErrors(form, err)) form.setError("root", { message: errorMessage(err) });
      toast(errorMessage(err), "error");
      return;
    }
    const { client: c, uploadError } = r;
    if (uploadError) {
      // The client is saved; let BD attach the certificate again from Edit.
      toast(`${c.name} was saved, but the GST certificate could not be uploaded: ${uploadError}`, "error");
      router.push(`/clients/${c._id}/edit`);
      return;
    }
    toast(`${c.name} registered as ${c.clientNo}.`);
    setPending([]);
    if (another) {
      form.reset(EMPTY_COMPANY);
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/clients");
    }
  };

  const submit = (another: boolean) => {
    setAddAnother(another);
    void form.handleSubmit((v) => save(v, another))();
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="mx-auto max-w-7xl"
    >
      <PageHeader
        icon={UserPlus}
        title="Add Client"
        subtitle="Enter the company details. Orders for this client are created in Order Management."
        className="mb-5"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/clients">
              <ArrowLeft className="size-4" aria-hidden /> Back to Client List
            </Link>
          </Button>
        }
      />
      <CompanyFormFields form={form} idPrefix="new" gst={{ saved: [], pending, onPendingChange: setPending }} />
      <FormActionBar note={<>Fields marked <span className="text-danger">*</span> are required.</>}>
        <Button type="button" variant="outline" onClick={() => router.push("/clients")} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="brand-outline" onClick={() => submit(true)} loading={busy && addAnother} disabled={busy}>
          <SaveAll className="size-4" aria-hidden /> Save &amp; Add Another
        </Button>
        <Button type="submit" variant="brand" loading={busy && !addAnother} disabled={busy}>
          <Save className="size-4" aria-hidden /> Save Client
        </Button>
      </FormActionBar>
    </form>
  );
}
