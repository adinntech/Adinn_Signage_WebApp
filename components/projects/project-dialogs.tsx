"use client";

import { useState } from "react";
import { UserSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import {
  PRIORITIES,
  useChangeStatus,
  useUpdateProject,
  type Priority,
  type Project,
  type ProjectStatus,
} from "@/lib/api/projects";
import { label, toDateInput } from "@/lib/format";

export function StatusReasonDialog({
  project,
  status,
  onClose,
}: {
  project: Project;
  status: ProjectStatus;
  onClose: () => void;
}) {
  const toast = useToast();
  const change = useChangeStatus(project._id);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    try {
      await change.mutateAsync({ status, reason: reason.trim() });
      toast(`Status changed to ${label(status)}`);
      onClose();
    } catch (err) {
      setError(fieldErrorsOf(err).reason ?? errorMessage(err));
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Move to ${label(status)}`}
      description={`${project.code} - a reason is required.`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="status-form" variant={status === "CANCELLED" ? "destructive" : "default"} loading={change.isPending}>
            Confirm
          </Button>
        </>
      }
    >
      <form id="status-form" onSubmit={submit} noValidate>
        <Field label="Reason" htmlFor="st-reason" required error={error}>
          <Textarea id="st-reason" value={reason} aria-invalid={!!error} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function EditProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateProject(project._id);
  const [name, setName] = useState(project.name);
  const [campaign, setCampaign] = useState(project.campaign ?? "");
  const [priority, setPriority] = useState<Priority>(project.priority);
  const [targetDate, setTargetDate] = useState(toDateInput(project.targetDate));
  const [ownerId, setOwnerId] = useState(project.owner?._id ?? "");
  const [coordinatorId, setCoordinatorId] = useState(project.coordinator?._id ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!campaign.trim()) errs.campaign = "Campaign is required";
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    try {
      await update.mutateAsync({
        name: name.trim(),
        campaign: campaign.trim(),
        priority,
        targetDate: targetDate ? new Date(targetDate).toISOString() : null,
        ownerId: ownerId || null,
        coordinatorId: coordinatorId || null,
      });
      toast("Project updated");
      onClose();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      if (Object.keys(fe).length) setErrors(fe);
      else setFormError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit project"
      description={project.code}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-project-form" loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-project-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <Field label="Project name" htmlFor="ep-name" required error={errors.name}>
          <Input id="ep-name" value={name} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Campaign" htmlFor="ep-campaign" required error={errors.campaign}>
          <Input id="ep-campaign" value={campaign} aria-invalid={!!errors.campaign} onChange={(e) => setCampaign(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Priority" htmlFor="ep-priority" error={errors.priority}>
            <Select id="ep-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target date" htmlFor="ep-date" error={errors.targetDate}>
            <Input id="ep-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </div>
        <Field label="BD owner" htmlFor="ep-owner">
          <UserSelect id="ep-owner" roles={["BD", "SUPER_ADMIN"]} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
        </Field>
        <Field label="Recce coordinator" htmlFor="ep-coord">
          <UserSelect id="ep-coord" roles={["RECCE_COORDINATOR"]} value={coordinatorId} onChange={(e) => setCoordinatorId(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
