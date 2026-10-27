"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Info, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { CompanyDetailsCard, PrimaryPill } from "@/components/clients/client-info";
import { ContactDialog } from "@/components/clients/contact-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailItem, PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useClient, useSaveClient } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

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
        <CompanyDetailsCard client={c} className="p-5 sm:p-6 xl:col-span-2" />
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={Info} title="Client Information" />
          <dl className="grid grid-cols-2 gap-5">
            <DetailItem label="Client ID">
              <span className="font-mono text-brand">{c.clientNo ?? c.code}</span>
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
                    {k.isPrimary ? <PrimaryPill /> : "-"}
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openContact(i)} aria-label={`Edit ${k.name}`}>
                          <Pencil className="size-4" aria-hidden /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRemoveIdx(i)} aria-label={`Remove ${k.name}`}>
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
