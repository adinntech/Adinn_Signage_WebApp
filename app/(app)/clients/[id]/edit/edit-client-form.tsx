"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Save } from "lucide-react";
import { CompanyFormFields, FormActionBar, useClientEdit } from "@/components/clients/company-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

/** Edit Client: same form as Add Client, saved onto the existing company record (no order is created). */
export function EditClientForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { q, form, pending, setPending, submit, busy } = useClientEdit(id);
  const onSubmit = submit(() => router.push(`/clients/${id}`));

  if (q.isPending) return <Skeleton className="mx-auto h-96 max-w-7xl" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

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
