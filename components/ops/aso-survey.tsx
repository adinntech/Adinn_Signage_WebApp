"use client";

import { useState } from "react";
import { MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ProjectDocuments } from "@/components/upload/project-documents";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useDeleteSurveyArea, useSaveSurveyArea, useSurveyAreas, type SurveyArea } from "@/lib/api/pipeline";
import { formatDateTime } from "@/lib/format";

/** ASO workflow: the shop count is unknown, so Operations records survey areas, shops discovered and proof. */
export function AsoSurvey({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast();
  const areas = useSurveyAreas(projectId);
  const save = useSaveSurveyArea(projectId);
  const del = useDeleteSurveyArea(projectId);
  const [edit, setEdit] = useState<{ open: boolean; area?: SurveyArea }>({ open: false });
  const [toDelete, setToDelete] = useState<SurveyArea | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (areas.isError) return <ErrorState error={areas.error} onRetry={() => areas.refetch()} title="Could not load survey areas" />;
  const list = areas.data ?? [];
  const found = list.reduce((a, x) => a + x.shopsFound, 0);

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const area = String(fd.get("area") ?? "").trim();
    const raw = String(fd.get("shopsFound") ?? "").trim();
    const shopsFound = Number(raw);
    const e: Record<string, string> = {};
    if (area.length < 2) e.area = "Enter the area or sales office name";
    if (!/^\d+$/.test(raw) || !Number.isInteger(shopsFound)) e.shopsFound = "Shops found must be a whole number (0 or more)";
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate(
      { id: edit.area?._id, body: { area, shopsFound, notes: String(fd.get("notes") ?? "").trim() || undefined } },
      {
        onSuccess: () => {
          toast(edit.area ? "Survey area updated" : "Survey area added");
          setEdit({ open: false });
        },
        onError: (err) => {
          const fe = fieldErrorsOf(err);
          if (Object.keys(fe).length) setErrors(fe);
          else setErrors({ area: errorMessage(err) }); // e.g. "already recorded for this project"
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#b7ece5] bg-gradient-to-br from-[#dcf7f3] to-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Areas surveyed</p>
          <p className="text-3xl font-bold tabular-nums text-recce">{areas.isPending ? "–" : list.length}</p>
        </div>
        <div className="rounded-xl border border-[#cfe0ff] bg-gradient-to-br from-[#e8f0ff] to-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shops discovered</p>
          <p className="text-3xl font-bold tabular-nums text-royal">{areas.isPending ? "–" : found}</p>
        </div>
      </div>
      <p className="rounded-lg bg-[#dcf7f3] p-3 text-sm text-recce">
        The shop count is <strong>unknown</strong> for this ASO project. Record each area visited, the shops found and upload the conversation report / proof.
      </p>

      <section className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy"><MapPinned className="size-4 text-recce" aria-hidden /> Survey areas</h3>
          {canEdit && (
            <Button size="sm" className="bg-royal hover:bg-royal/90" onClick={() => { setErrors({}); setEdit({ open: true }); }}>
              <Plus className="size-4" aria-hidden /> Add area
            </Button>
          )}
        </div>
        {list.length === 0 ? (
          <EmptyState title="No areas recorded" description="Choose or type the area / sales office the team will cover." />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((a) => (
              <li key={a._id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{a.area}</p>
                  {a.notes && <p className="mt-0.5 text-sm text-muted-foreground">{a.notes}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                </div>
                <span className="rounded-full bg-[#e8f0ff] px-3 py-1 text-sm font-semibold text-royal">{a.shopsFound} shops</span>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${a.area}`} onClick={() => { setErrors({}); setEdit({ open: true, area: a }); }}><Pencil className="size-4" aria-hidden /></Button>
                    <Button variant="ghost" size="icon" className="text-loss" aria-label={`Delete ${a.area}`} onClick={() => setToDelete(a)}><Trash2 className="size-4" aria-hidden /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-navy">Conversation report &amp; proof</h3>
        <ProjectDocuments projectId={projectId} category="OPS_SURVEY_PROOF" canEdit={canEdit} emptyText="No proof uploaded yet." />
      </section>

      <Modal
        open={edit.open}
        onOpenChange={(o) => setEdit((e) => ({ ...e, open: o }))}
        title={edit.area ? "Edit survey area" : "Add survey area"}
        className="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEdit({ open: false })}>Cancel</Button>
            <Button className="bg-royal hover:bg-royal/90" type="submit" form="area-form" loading={save.isPending}>{edit.area ? "Save changes" : "Add area"}</Button>
          </div>
        }
      >
        <form id="area-form" key={edit.area?._id ?? "new"} noValidate onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="space-y-4">
          <Field label="Area / Sales office" htmlFor="area" required error={errors.area}>
            <Input id="area" name="area" defaultValue={edit.area?.area} aria-invalid={!!errors.area} />
          </Field>
          <Field label="Shops found" htmlFor="shopsFound" required error={errors.shopsFound}>
            <Input id="shopsFound" name="shopsFound" inputMode="numeric" defaultValue={edit.area?.shopsFound ?? 0} aria-invalid={!!errors.shopsFound} />
          </Field>
          <Field label="Conversation notes" htmlFor="notes" error={errors.notes}>
            <Textarea id="notes" name="notes" rows={3} defaultValue={edit.area?.notes} />
          </Field>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete survey area?"
        description={toDelete ? `${toDelete.area} will be removed.` : ""}
        confirmLabel="Delete area"
        destructive
        onConfirm={() => {
          if (toDelete) del.mutate(toDelete._id, { onSuccess: () => toast("Survey area deleted"), onError: (e) => toast(errorMessage(e), "error") });
        }}
      />
    </div>
  );
}
