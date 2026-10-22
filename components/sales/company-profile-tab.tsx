"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Mail, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useCompanyProfileDraft, useOrderEmails, useSendEmail } from "@/lib/api/sales";
import { useAuth } from "@/lib/auth";
import { EmailComposer } from "./email-composer";
import { EmailHistory } from "./email-history";

/** Screen 08: Company Profile email, prefilled from the saved master template, plus sent history. */
export function CompanyProfileTab({ orderId }: { orderId: string }) {
  const { can } = useAuth();
  const [view, setView] = useState<"compose" | "history">(can("sales:write") ? "compose" : "history");
  const draft = useCompanyProfileDraft(orderId, can("sales:write"));
  const sent = useOrderEmails(orderId, "COMPANY_PROFILE");
  const send = useSendEmail(orderId, "COMPANY_PROFILE");

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle
        title="Company Profile Email"
        description="Loaded from the saved Company Profile template. Edits here apply to this email only; the master template is not changed."
        action={
          can("templates:manage") && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/email-templates">
                <Settings2 className="size-4" aria-hidden /> Manage Template
              </Link>
            </Button>
          )
        }
      />
      <Tabs
        idPrefix="cp"
        className="mb-5"
        value={view}
        onChange={setView}
        items={[
          ...(can("sales:write") ? [{ key: "compose" as const, label: "Compose Email", icon: Mail }] : []),
          {
            key: "history" as const,
            label: "Sent History",
            icon: History,
            badge: sent.data?.length ? <span className="rounded-full bg-muted px-1.5 text-xs">{sent.data.length}</span> : undefined,
          },
        ]}
      />
      <div id="cp-panel" role="tabpanel">
        {view === "history" ? (
          <EmailHistory orderId={orderId} kind="COMPANY_PROFILE" />
        ) : draft.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-48" />
          </div>
        ) : draft.isError ? (
          <ErrorState error={draft.error} onRetry={() => draft.refetch()} />
        ) : (
          <EmailComposer
            key={`${draft.data.templateVersion}-${draft.dataUpdatedAt}`}
            idPrefix="cp-mail"
            from={draft.data.from}
            mailEnabled={draft.data.mailEnabled}
            draft={draft.data}
            attachments={draft.data.pdf ? [draft.data.pdf] : []}
            attachmentLabel="Company Profile PDF (auto attached from the template)"
            blockedReason={draft.data.pdf ? null : "No Company Profile PDF is attached to the template. Upload it in Email Templates first."}
            showNotes
            sending={send.isPending}
            onSend={async (v) => {
              const r = await send.mutateAsync(v);
              setView("history");
              return r;
            }}
          />
        )}
      </div>
    </Card>
  );
}
