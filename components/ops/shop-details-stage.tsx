"use client";

import { BadgeCheck } from "lucide-react";
import { ShopApprovals } from "@/components/approvals/shop-approvals";
import { SitesTab } from "@/components/sites/sites-tab";
import type { Project } from "@/lib/api/projects";
import { AdditionalShops } from "./additional-shops";
import { BdAttachments } from "./bd-attachments";
import { RequirementPanel } from "./requirement-panel";

/**
 * "Client shop details only": the client gives the shop list (no measurements).
 * Open the file BD attached → extract its shops → edit them → verify each one → declare any extra shops found on the
 * ground → start the recce.
 */
export function ShopDetailsStage({ project, canEdit, readOnly }: { project: Project; canEdit: boolean; readOnly: boolean }) {
  return (
    <RequirementPanel
      n={2}
      tone="pink"
      title="Client Shop Details Only"
      tag="Known Shop List"
      description="Client provides the list of shops. Capture and verify shop details before the recce. No board measurements required."
    >
      <BdAttachments project={project} canEdit={canEdit} readOnly={readOnly} />

      <SitesTab project={project} readOnly={readOnly} allowImport={false} />

      <AdditionalShops project={project} canEdit={canEdit} />

      <div className="rounded-xl border border-[#d6c4f5] bg-[#f6f0ff] p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-vendor">
          <span className="flex size-6 items-center justify-center rounded-full bg-vendor text-white"><BadgeCheck className="size-4" aria-hidden /></span>
          Shop verification
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">Check each shop&apos;s details (name, address, phone). The recce can start only when every shop is verified.</p>
        <ShopApprovals projectId={project._id} mode="details" readOnly={readOnly} />
      </div>
    </RequirementPanel>
  );
}
