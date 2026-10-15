"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClientSelect, UserSelect } from "@/components/pickers";
import {
  EMPTY_REQUIREMENT,
  REQUIREMENT_PATH_MAP,
  RequirementFields,
  requirementSchema,
  requirementToPayload,
} from "@/components/projects/requirement-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { PRIORITIES, useCreateProject } from "@/lib/api/projects";
import { useAuth } from "@/lib/auth";
import { label } from "@/lib/format";

const schema = requirementSchema.extend({
  clientId: z.string().min(1, "Select a client"),
  campaign: z.string().trim().min(1, "Campaign is required").max(120),
  name: z.string().trim().max(160),
  priority: z.enum(PRIORITIES),
  targetDate: z.string(),
  ownerId: z.string(),
  coordinatorId: z.string(),
});
type FormValues = z.infer<typeof schema>;

export function NewProjectForm() {
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const create = useCreateProject();
  const [done, setDone] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...EMPTY_REQUIREMENT, clientId: "", campaign: "", name: "", priority: "MEDIUM", targetDate: "", ownerId: "", coordinatorId: "" },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = form;
  useUnsavedWarning(isDirty && !done);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const p = await create.mutateAsync({
        clientId: v.clientId,
        campaign: v.campaign,
        name: v.name || undefined,
        priority: v.priority,
        targetDate: v.targetDate || undefined,
        ownerId: v.ownerId || undefined,
        coordinatorId: v.coordinatorId || undefined,
        requirement: requirementToPayload(v),
      });
      setDone(true);
      toast(`Project ${p.code} created`);
      router.push(`/projects/${p._id}`);
    } catch (err) {
      let mapped = false;
      for (const [path, message] of Object.entries(fieldErrorsOf(err))) {
        const target = REQUIREMENT_PATH_MAP[path] ?? path;
        setError(target as FieldPath<FormValues>, { message });
        mapped = true;
      }
      if (!mapped) setError("root", { message: errorMessage(err) });
    }
  });

  const cancel = () => {
    if (!isDirty || window.confirm("Discard this project? Your entries will be lost.")) {
      setDone(true);
      router.push("/projects");
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto flex h-full min-h-0 max-w-4xl flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">New project</h1>
        <p className="text-sm text-muted-foreground">Capture the client requirement. The project code is generated on save.</p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-4 pr-1">
        {errors.root && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        <Card>
          <CardContent className="space-y-4 p-5">
            <h2 className="text-sm font-semibold text-primary">Client &amp; campaign</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" htmlFor="p-client" required error={errors.clientId?.message}>
                {can("clients:read") ? (
                  <ClientSelect id="p-client" aria-invalid={!!errors.clientId} {...register("clientId")} />
                ) : (
                  <p className="text-sm text-muted-foreground">You do not have access to the client list.</p>
                )}
              </Field>
              <Field label="Campaign" htmlFor="p-campaign" required error={errors.campaign?.message}>
                <Input id="p-campaign" aria-invalid={!!errors.campaign} {...register("campaign")} />
              </Field>
              <Field label="Project name" htmlFor="p-name" error={errors.name?.message} hint="Optional. Defaults to client - campaign.">
                <Input id="p-name" {...register("name")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Priority" htmlFor="p-priority" error={errors.priority?.message}>
                  <Select id="p-priority" {...register("priority")}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {label(p)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Target date" htmlFor="p-target" error={errors.targetDate?.message}>
                  <Input id="p-target" type="date" {...register("targetDate")} />
                </Field>
              </div>
              <Field label="BD owner" htmlFor="p-owner" hint="Defaults to you when you are BD.">
                <UserSelect
                  id="p-owner"
                  roles={["BD", "SUPER_ADMIN"]}
                  placeholder="Default"
                  {...register("ownerId")}
                />
              </Field>
              <Field label="Recce coordinator" htmlFor="p-coord">
                <UserSelect
                  id="p-coord"
                  roles={["RECCE_COORDINATOR"]}
                  {...register("coordinatorId")}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-primary">Requirement</h2>
            <RequirementFields form={form as never} idPrefix="nr" />
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 -mx-4 flex shrink-0 items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <p className="hidden text-xs text-muted-foreground sm:block">{isDirty ? "Unsaved changes" : "No changes yet"}</p>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create project
          </Button>
        </div>
      </div>
    </form>
  );
}
