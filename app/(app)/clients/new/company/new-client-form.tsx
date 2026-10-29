"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileClock, Save, SaveAll, UserPlus } from "lucide-react";
import {
  applyServerErrors,
  CompanyFormFields,
  companyToDraft,
  companyToForm,
  EMPTY_COMPANY,
  FormActionBar,
  useCompanyForm,
  useCreateClient,
  type CompanyValues,
} from "@/components/clients/company-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useClient, useGstCertificates, useSaveClientDraft } from "@/lib/api/clients";
import { formData } from "@/lib/api/files";
import { formatDateTime } from "@/lib/format";

/**
 * Add Client: company details, GST certificate and custom fields. Orders for the client are created in Order Management.
 * "Save Draft" keeps a part-filled form (no checks) and moves to `?draft=<id>`, so later saves update the same draft and a
 * refresh resumes it; "Save Client" on a draft runs the full checks and turns that draft into the client.
 */
export function NewClientForm() {
  const router = useRouter();
  const toast = useToast();
  const draftId = useSearchParams().get("draft") ?? undefined;
  const form = useCompanyForm(EMPTY_COMPANY, draftId);
  const { create, busy: saving } = useCreateClient();
  const saveDraft = useSaveClientDraft();
  const { upload } = useGstCertificates();
  const draft = useClient(draftId);
  const [pending, setPending] = useState<File[]>([]);
  const [action, setAction] = useState<"draft" | "client" | "another">("client");
  // Resume: load the draft once (removing a GST file refreshes it, and must not wipe what is being typed).
  const [loaded, setLoaded] = useState<string | null>(null);
  if (draft.data && draft.data.status === "DRAFT" && loaded !== draft.data._id) {
    setLoaded(draft.data._id);
    form.reset(companyToForm(draft.data));
  }
  const busy = saving || saveDraft.isPending || upload.isPending;

  const save = async (v: CompanyValues, another: boolean) => {
    let r;
    try {
      r = await create(v, pending, draftId);
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
      if (draftId) router.replace("/clients/new", { scroll: false });
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/clients");
    }
  };

  const submit = (another: boolean) => {
    setAction(another ? "another" : "client");
    void form.handleSubmit((v) => save(v, another))();
  };

  /** Save Draft: what is typed so far, without the required-field checks. */
  const onSaveDraft = async () => {
    setAction("draft");
    form.clearErrors();
    const v = form.getValues();
    let c;
    try {
      c = await saveDraft.mutateAsync({ id: draftId, body: companyToDraft(v) });
    } catch (err) {
      toast(`Draft not saved: ${errorMessage(err)}`, "error");
      return;
    }
    // Saved values are now the clean state (no "unsaved changes" prompt); later saves update this draft.
    form.reset(v);
    if (!draftId) {
      setLoaded(c._id);
      router.replace(`/clients/new?draft=${c._id}`, { scroll: false });
    }
    if (pending.length) {
      try {
        await upload.mutateAsync({ id: c._id, body: formData(pending) });
        setPending([]);
      } catch (err) {
        toast(`Draft saved, but the GST certificate could not be uploaded: ${errorMessage(err)}. Choose the file again.`, "error");
        return;
      }
    }
    toast("Draft saved. Resume it any time from Client Management > Drafts.");
  };

  if (draftId && draft.isPending) return <Skeleton className="mx-auto h-96 max-w-7xl" />;
  if (draftId && draft.isError) return <ErrorState error={draft.error} onRetry={() => draft.refetch()} title="Could not load this draft" />;
  if (draftId && draft.data && draft.data.status !== "DRAFT")
    return (
      <EmptyState
        icon={FileClock}
        title="This draft is already a client"
        description={`${draft.data.name} was saved as ${draft.data.clientNo ?? "a client"}.`}
        action={
          <Button variant="brand" asChild>
            <Link href={`/clients/${draft.data._id}`}>Open Client</Link>
          </Button>
        }
      />
    );

  return (
    <form
      noValidate
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="mx-auto max-w-7xl"
    >
      <PageHeader
        icon={UserPlus}
        title={draftId ? "Resume Client Draft" : "Add Client"}
        subtitle={
          draftId && draft.data ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge tone="warning">Draft</Badge> Last saved {formatDateTime(draft.data.updatedAt)}. Save Client when the details are complete.
            </span>
          ) : (
            "Enter the company details. Orders for this client are created in Order Management."
          )
        }
        className="mb-5"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/clients">
              <ArrowLeft className="size-4" aria-hidden /> Back to Client List
            </Link>
          </Button>
        }
      />
      <CompanyFormFields form={form} idPrefix="new" gst={{ clientId: draftId, saved: draft.data?.gstCertificates ?? [], pending, onPendingChange: setPending }} />
      <FormActionBar note={<>Fields marked <span className="text-danger">*</span> are required. Save Draft keeps an incomplete form.</>}>
        <Button type="button" variant="outline" onClick={() => router.push("/clients")} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={() => void onSaveDraft()} loading={busy && action === "draft"} disabled={busy}>
          <FileClock className="size-4" aria-hidden /> Save Draft
        </Button>
        <Button type="button" variant="brand-outline" onClick={() => submit(true)} loading={busy && action === "another"} disabled={busy}>
          <SaveAll className="size-4" aria-hidden /> Save &amp; Add Another
        </Button>
        <Button type="submit" variant="brand" loading={busy && action === "client"} disabled={busy}>
          <Save className="size-4" aria-hidden /> Save Client
        </Button>
      </FormActionBar>
    </form>
  );
}
