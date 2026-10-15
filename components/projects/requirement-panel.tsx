"use client";

import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileQuestion, Pencil } from "lucide-react";
import { AttachmentList } from "@/components/communication/attachment-meta";
import {
  REQUIREMENT_PATH_MAP,
  RequirementFields,
  requirementSchema,
  requirementToForm,
  requirementToPayload,
  type RequirementForm,
} from "@/components/projects/requirement-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useSaveRequirement, type Project } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatNumber, label } from "@/lib/format";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{k}</dt>
      <dd className="text-sm sm:col-span-2">{children || <span className="text-muted-foreground">-</span>}</dd>
    </div>
  );
}

function EditForm({ project, onDone }: { project: Project; onDone: () => void }) {
  const toast = useToast();
  const save = useSaveRequirement(project._id);
  const form = useForm<RequirementForm>({
    resolver: zodResolver(requirementSchema),
    defaultValues: requirementToForm(project.requirement),
  });
  const {
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = form;

  const submit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync(requirementToPayload(v));
      toast("Requirement updated");
      onDone();
    } catch (err) {
      let mapped = false;
      for (const [path, message] of Object.entries(fieldErrorsOf(err))) {
        setError((REQUIREMENT_PATH_MAP[path] ?? path) as FieldPath<RequirementForm>, { message });
        mapped = true;
      }
      if (!mapped) setError("root", { message: errorMessage(err) });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {errors.root && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      )}
      <RequirementFields form={form} idPrefix="er" />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!isDirty || window.confirm("Discard your changes?")) onDone();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Save requirement
        </Button>
      </div>
    </form>
  );
}

export function RequirementPanel({ project }: { project: Project }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const r = project.requirement;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-primary">Requirement</h2>
          {can("projects:write") && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> {r ? "Edit" : "Add requirement"}
            </Button>
          )}
        </div>
        {editing ? (
          <EditForm project={project} onDone={() => setEditing(false)} />
        ) : !r ? (
          <EmptyState icon={FileQuestion} title="No requirement recorded" description="Capture the client requirement for this project." />
        ) : (
          <dl className="divide-y divide-border">
            <Row k="Source">
              <Badge tone="primary">{label(r.source)}</Badge>
              {r.sourceNote && <span className="ml-2 text-muted-foreground">{r.sourceNote}</span>}
            </Row>
            <Row k="Client contact">
              {[r.contact?.name, r.contact?.phone, r.contact?.email].filter(Boolean).join(" - ")}
            </Row>
            <Row k="Expected sites">{r.expectedSites !== undefined && r.expectedSites !== null ? formatNumber(r.expectedSites) : ""}</Row>
            <Row k="Locations">
              {r.locations?.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {r.locations.map((l) => (
                    <Badge key={l} tone="primary">
                      {l}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </Row>
            <Row k="Recce required">{r.recceRequired ? "Yes" : "No"}</Row>
            <Row k="Site data scenario">
              {r.siteDataScenario === "MEASUREMENT_REQUIRED"
                ? "Scenario 1 - measurement required from our side"
                : "Scenario 2 - client provides measured data"}
            </Row>
            <Row k="Description">{r.description ? <span className="whitespace-pre-wrap">{r.description}</span> : null}</Row>
            <Row k="Commercial notes">{r.commercialNotes ? <span className="whitespace-pre-wrap">{r.commercialNotes}</span> : null}</Row>
            <Row k="Attachments">{r.attachments?.length ? <AttachmentList items={r.attachments} /> : null}</Row>
            <Row k="Last updated">{r.updatedAt ? formatDateTime(r.updatedAt) : ""}</Row>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
