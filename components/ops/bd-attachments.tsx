"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileSpreadsheet, Paperclip, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { FileTypeIcon } from "@/components/upload/file-drop";
import { FilePreviewDialog } from "@/components/upload/file-preview-dialog";
import { isSheet } from "@/components/upload/sheet-preview";
import { ImportWizard } from "@/components/sites/import-wizard";
import { errorMessage } from "@/lib/api";
import { downloadFile, useProjectFiles, type StoredFile } from "@/lib/api/pipeline";
import type { Project } from "@/lib/api/projects";
import { formatBytes, formatDateTime } from "@/lib/format";

/**
 * The files BD attached to the project. Operations opens the Excel right here, and "Extract shops" turns its rows into
 * editable shop records in one step (the columns are matched automatically). No download and re-upload.
 */
export function BdAttachments({ project, canEdit, readOnly }: { project: Project; canEdit: boolean; readOnly: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const files = useProjectFiles(project._id, "BD_CLIENT_DETAILS");
  const [preview, setPreview] = useState<StoredFile | null>(null);
  const [extract, setExtract] = useState<StoredFile | null>(null);
  const list = files.data ?? [];
  const sheets = list.filter((f) => isSheet(f.originalName));

  return (
    <section aria-label="Attachments from BD" className="rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-navy"><Paperclip className="size-4 text-royal" aria-hidden /> Attachments from BD <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-xs font-semibold text-royal">{list.length}</span></h3>
        {canEdit && !readOnly && sheets.length > 0 && <p className="text-xs text-muted-foreground">Open a sheet, then press <strong>Extract shops</strong> to edit its rows here.</p>}
      </div>
      {files.isPending ? (
        <RowsSkeleton rows={2} className="p-4" />
      ) : files.isError ? (
        <ErrorState error={files.error} onRetry={() => files.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="BD has not attached any files" description="When BD attaches the client's shop list it appears here." />
      ) : (
        <ul className="divide-y divide-border">
          {list.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <FileTypeIcon kind={f.kind} name={f.originalName} />
              <button type="button" onClick={() => setPreview(f)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-foreground hover:underline">{f.originalName}</span>
                <span className="block text-xs text-muted-foreground">{formatBytes(f.size)} · {formatDateTime(f.createdAt)}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setPreview(f)}><Eye className="size-4" aria-hidden /> View</Button>
                <Button size="icon" variant="ghost" aria-label={`Download ${f.originalName}`} onClick={() => downloadFile(f.id).catch((e) => toast(errorMessage(e), "error"))}><Download className="size-4" aria-hidden /></Button>
                {canEdit && !readOnly && isSheet(f.originalName) && (
                  <Button size="sm" className="bg-finance hover:bg-finance/90" onClick={() => setExtract(f)}><Wand2 className="size-4" aria-hidden /> Extract shops</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {sheets.length === 0 && list.length > 0 && <p className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground"><FileSpreadsheet className="size-4" aria-hidden /> No Excel or CSV among these files, so add the shops by hand below.</p>}
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
      {extract && (
        <ImportWizard
          projectId={project._id}
          defaultScenario={project.requirement?.siteDataScenario ?? "MEASUREMENT_REQUIRED"}
          fromFile={{ id: extract.id, name: extract.originalName }}
          onClose={() => { setExtract(null); router.refresh(); }}
          onViewSites={() => setExtract(null)}
        />
      )}
    </section>
  );
}
