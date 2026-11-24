"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, DatabaseBackup, Hammer, ListChecks, RefreshCw, Shapes, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useCatalog, useCatalogUsage, useLoadDefaults } from "@/lib/api/catalog";
import { useAuth } from "@/lib/auth";
import { defaultsMessage } from "@/lib/catalog-rules";
import { InstallationsTab } from "./installations-tab";
import { MediaTab } from "./media-tab";
import { QuestionsTab } from "./questions-tab";

type TabKey = "media" | "installations" | "questions";

/**
 * Admin > Media catalog (permission `catalog:manage`, Super Admin only): the media types, installation types and site questions
 * the field person sees on the phone. Anyone else who opens the address sees a clear "not allowed" page and no data is requested.
 */
export function MediaCatalogPage() {
  const { can, user } = useAuth();
  const router = useRouter();
  if (!can("catalog:manage")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You are not allowed to open the Media catalog"
        description="Only a Super Admin can add, edit or delete media types, installation types and site questions."
        action={<Button onClick={() => router.replace(user?.home || "/dashboard")}>Go to my dashboard</Button>}
      />
    );
  }
  return <CatalogWorkspace />;
}

function CatalogWorkspace() {
  const toast = useToast();
  const catalog = useCatalog();
  const usage = useCatalogUsage();
  const defaults = useLoadDefaults();
  const [tab, setTab] = useState<TabKey>("media");
  const [askDefaults, setAskDefaults] = useState(false);
  const data = catalog.data;
  const refreshing = catalog.isFetching || usage.isFetching;

  async function refresh() {
    const [c] = await Promise.all([catalog.refetch(), usage.refetch()]);
    if (c.isError) toast(errorMessage(c.error), "error");
    else toast(`Catalog refreshed (version ${c.data?.version ?? ""})`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        icon={Boxes}
        title="Media catalog"
        subtitle="The media types, installation types and site questions the field person works with on the phone."
        actions={
          <>
            <Badge tone="info" title="Raised by every change" className="px-3 py-1.5 text-sm">{data ? `Catalog version ${data.version}` : "Catalog version -"}</Badge>
            <Button variant="outline" onClick={() => void refresh()} loading={refreshing} disabled={refreshing}>
              {!refreshing && <RefreshCw className="size-4" aria-hidden />} Refresh
            </Button>
            <Button variant="outline" onClick={() => setAskDefaults(true)} disabled={!data}>
              <DatabaseBackup className="size-4" aria-hidden /> Load built-in defaults
            </Button>
          </>
        }
      />
      <p role="note" className="rounded-lg bg-[#eef4ff] px-3 py-2 text-sm text-navy">
        Changes reach the phones the next time they open the app. Boards already recorded keep the names and answers they were saved with.
      </p>

      <Tabs
        label="Media catalog sections"
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "media", label: "Media types", icon: Shapes, ...(data ? { count: data.media.length } : {}) },
          { key: "installations", label: "Installation types", icon: Hammer, ...(data ? { count: data.installations.length } : {}) },
          { key: "questions", label: "Site questions", icon: ListChecks, ...(data ? { count: data.questions.length } : {}) },
        ]}
      />
      <TabPanel k={tab}>
        {catalog.isPending ? (
          <RowsSkeleton rows={8} className="rounded-2xl border border-border bg-surface p-4 shadow-soft" />
        ) : catalog.isError || !data ? (
          <div className="rounded-2xl border border-border bg-surface shadow-soft">
            <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} title="Could not load the catalog" />
          </div>
        ) : (
          <>
            {usage.isError && (
              <p role="status" className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                The number of boards using each entry could not be loaded ({errorMessage(usage.error)}).{" "}
                <button type="button" className="font-semibold underline" onClick={() => void usage.refetch()}>Try again</button>
              </p>
            )}
            {tab === "media" && <MediaTab catalog={data} usage={usage.data} />}
            {tab === "installations" && <InstallationsTab catalog={data} usage={usage.data} />}
            {tab === "questions" && <QuestionsTab catalog={data} />}
          </>
        )}
      </TabPanel>

      <ConfirmDialog
        open={askDefaults}
        onOpenChange={setAskDefaults}
        title="Load built-in defaults?"
        confirmLabel="Load defaults"
        loading={defaults.isPending}
        onConfirm={() =>
          defaults.mutate(undefined, {
            onSuccess: (r) => {
              toast(defaultsMessage(r));
              setAskDefaults(false);
            },
            onError: (e) => toast(errorMessage(e), "error"),
          })
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Any built-in media type, installation type or question that is missing (for example one that was deleted) is added back.</p>
          <p>Entries that exist are never changed, so your edits stay.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
