"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Save } from "lucide-react";
import { applyServerErrors, CompanyFormFields, companyToApi, companyToForm, EMPTY_COMPANY, FormActionBar, useCompanyForm } from "@/components/clients/company-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useClient, useGstCertificates, useSaveClient } from "@/lib/api/clients";
import { formData } from "@/lib/api/files";

/** Edit Client: same form as Add Client, saved onto the existing company record (no order is created). */
export function EditClientForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const q = useClient(id);
  const save = useSaveClient();
  const { upload } = useGstCertificates();
  const form = useCompanyForm(EMPTY_COMPANY);
  const [pending, setPending] = useState<File[]>([]);
  // Load the saved values once: removing a GST file refreshes the client, and must not wipe what is being typed.
  const [loaded, setLoaded] = useState<string | null>(null);
  if (q.data && loaded !== q.data._id) {
    setLoaded(q.data._id);
    form.reset(companyToForm(q.data));
  }

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id, body: companyToApi(v) });
    } catch (err) {
      if (!applyServerErrors(form, err)) form.setError("root", { message: errorMessage(err) });
      toast(errorMessage(err), "error");
      return;
    }
    if (pending.length) {
      try {
        await upload.mutateAsync({ id, body: formData(pending) });
        setPending([]);
      } catch (err) {
        toast(`Details saved, but the GST certificate could not be uploaded: ${errorMessage(err)}`, "error");
        return;
      }
    }
    toast("Client details updated");
    router.push(`/clients/${id}`);
  });

  if (q.isPending) return <Skeleton className="mx-auto h-96 max-w-7xl" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const busy = save.isPending || upload.isPending;

  return (
    <form noValidate autoComplete="off" onSubmit={onSubmit} className="mx-auto max-w-7xl">
      <PageHeader
        icon={Pencil}
        title={`Edit ${q.data.name}`}
        subtitle={<>Client ID <span className="font-mono font-semibold text-brand">{q.data.clientNo ?? q.data.code}</span> stays the same.</>}
        className="mb-5"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/clients">
              <ArrowLeft className="size-4" aria-hidden /> Back to Client
            </Link>
          </Button>
        }
      />
      <CompanyFormFields form={form} idPrefix="edit" gst={{ clientId: id, saved: q.data.gstCertificates ?? [], pending, onPendingChange: setPending }} />
      <FormActionBar note={<>Fields marked <span className="text-danger">*</span> are required.</>}>
        <Button type="button" variant="outline" onClick={() => router.push(`/clients/${id}`)} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" loading={busy} disabled={busy}>
          <Save className="size-4" aria-hidden /> Save Changes
        </Button>
      </FormActionBar>
    </form>
  );
}
