"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, SaveAll, UserPlus } from "lucide-react";
import { applyServerErrors, CompanyFormFields, companyToApi, EMPTY_COMPANY, FormActionBar, useCompanyForm, type CompanyValues } from "@/components/clients/company-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { newRequestKey, useRegisterClient } from "@/lib/api/sales";

/** Screen 03: New Client Creation -> company + contacts + first New Order card. */
export function NewClientForm() {
  const router = useRouter();
  const toast = useToast();
  const form = useCompanyForm(EMPTY_COMPANY);
  const registerClient = useRegisterClient();
  // One key per filled-in form: a double click or retry returns the same order instead of creating another.
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const [addAnother, setAddAnother] = useState(false);

  const save = async (v: CompanyValues, another: boolean) => {
    try {
      const r = await registerClient.mutateAsync({ ...companyToApi(v), requestKey });
      toast(`${r.client.name} registered as ${r.client.clientNo}. Order ${r.order.orderNo} added to New Order.`);
      if (another) {
        setRequestKey(newRequestKey());
        form.reset(EMPTY_COMPANY);
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push("/clients");
      }
    } catch (err) {
      if (!applyServerErrors(form, err)) form.setError("root", { message: errorMessage(err) });
      toast(errorMessage(err), "error");
    }
  };

  const submit = (another: boolean) => {
    setAddAnother(another);
    void form.handleSubmit((v) => save(v, another))();
  };
  const busy = registerClient.isPending;

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
        title="New Client Creation"
        subtitle="Enter company and contact details. Saving creates the client and its first order."
        className="mb-5"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/clients">
              <ArrowLeft className="size-4" aria-hidden /> Back to Client List
            </Link>
          </Button>
        }
      />
      <CompanyFormFields form={form} idPrefix="new" />
      <FormActionBar note={<>Fields marked <span className="text-danger">*</span> are required.</>}>
        <Button type="button" variant="outline" onClick={() => router.push("/clients/new")} disabled={busy}>
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
