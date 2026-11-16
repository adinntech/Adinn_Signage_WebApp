"use client";

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
export function ShopDetailsStage({ project, canEdit, readOnly, hideAttachments }: { project: Project; canEdit: boolean; readOnly: boolean; hideAttachments?: boolean }) {
  return (
    <RequirementPanel
      n={2}
      tone="soft"
      title="Client Shop Details Only"
      tag="Known Shop List"
      description="Client provides the list of shops. Capture and verify shop details before the recce. No board measurements required."
    >
      {!hideAttachments && <BdAttachments project={project} canEdit={canEdit} readOnly={readOnly} />}

      <SitesTab project={project} readOnly={readOnly} allowImport={false} verification />

      <AdditionalShops project={project} canEdit={canEdit} />
    </RequirementPanel>
  );
}
