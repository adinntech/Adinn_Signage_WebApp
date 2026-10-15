"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientSelect, UserSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useCreateProjectFromMail, type Message } from "@/lib/api/communications";
import { PRIORITIES, type Priority } from "@/lib/api/projects";
import { label } from "@/lib/format";

/** Mail-to-task: creates a project from an unlinked email. */
export function CreateTaskDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateProjectFromMail();
  const [clientId, setClientId] = useState("");
  const [campaign, setCampaign] = useState((message.subject ?? "").replace(/^(re|fwd?):\s*/i, "").slice(0, 120));
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [targetDate, setTargetDate] = useState("");
  const [expectedSites, setExpectedSites] = useState("");
  const [coordinatorId, setCoordinatorId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!clientId) errs.clientId = "Select a client";
    if (!campaign.trim()) errs.campaign = "Campaign is required";
    if (!/^\d{0,6}$/.test(expectedSites)) errs.expectedSites = "Whole number only";
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    try {
      const p = await create.mutateAsync({
        id: message._id,
        clientId,
        campaign: campaign.trim(),
        priority,
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        expectedSites: expectedSites ? Number(expectedSites) : undefined,
        coordinatorId: coordinatorId || undefined,
      });
      toast(`Project ${p.code} created from email`);
      router.push(`/projects/${p._id}`);
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
      title="Create task from email"
      description="Creates a project, links this email and carries its attachments over."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={create.isPending}>
            Create project
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <Field label="Client" htmlFor="t-client" required error={errors.clientId}>
          <ClientSelect id="t-client" value={clientId} aria-invalid={!!errors.clientId} onChange={(e) => setClientId(e.target.value)} />
        </Field>
        <Field label="Campaign" htmlFor="t-campaign" required error={errors.campaign}>
          <Input id="t-campaign" value={campaign} aria-invalid={!!errors.campaign} onChange={(e) => setCampaign(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Priority" htmlFor="t-priority" error={errors.priority}>
            <Select id="t-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target date" htmlFor="t-date" error={errors.targetDate}>
            <Input id="t-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="Expected sites" htmlFor="t-sites" error={errors.expectedSites}>
            <Input id="t-sites" inputMode="numeric" value={expectedSites} onChange={(e) => setExpectedSites(e.target.value)} />
          </Field>
          <Field label="Recce coordinator" htmlFor="t-coord">
            <UserSelect id="t-coord" roles={["RECCE_COORDINATOR"]} value={coordinatorId} onChange={(e) => setCoordinatorId(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
