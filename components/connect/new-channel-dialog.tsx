"use client";

import { useState } from "react";
import { PeoplePicker } from "@/components/connect/people-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage, fieldErrorsOf } from "@/lib/api";
import { useCreateChannel } from "@/lib/api/connect";
import { ROLE_LABELS } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Mode = "DM" | "PRIVATE" | "TEAM";
const TEAM_ROLES = ["BD", "CLIENT_SERVICING", "OPERATIONS", "RECCE_COORDINATOR", "FINANCE", "MANAGEMENT", "SUPER_ADMIN"];

/** Start a direct message, a private channel, or (Admin / Management) a team channel limited to some roles. */
export function NewChannelDialog({ open, onClose, canTeam, onCreated }: { open: boolean; onClose: () => void; canTeam: boolean; onCreated: (id: string) => void }) {
  const toast = useToast();
  const create = useCreateChannel();
  const [mode, setMode] = useState<Mode>("DM");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reset = () => (setName(""), setTopic(""), setPeople([]), setRoles([]), setErrors({}));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (mode === "DM" && people.length !== 1) e.memberIds = "Choose one person";
    if (mode !== "DM" && name.trim().length < 2) e.name = "Enter a channel name";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const ch = await create.mutateAsync({ kind: mode, name: name.trim() || undefined, topic: topic.trim() || undefined, memberIds: people, allowedRoles: mode === "TEAM" ? roles : undefined });
      reset();
      onCreated(ch.id);
    } catch (err) {
      const f = fieldErrorsOf(err);
      if (Object.keys(f).length) setErrors(f);
      else toast(errorMessage(err), "error");
    }
  };

  const modes: { key: Mode; label: string }[] = [{ key: "DM", label: "Direct message" }, { key: "PRIVATE", label: "Private channel" }, ...(canTeam ? [{ key: "TEAM" as const, label: "Team channel" }] : [])];
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New conversation"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" loading={create.isPending} onClick={submit}>
            {mode === "DM" ? "Open chat" : "Create channel"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1">
          {modes.map((m) => (
            <button key={m.key} role="tab" aria-selected={mode === m.key} onClick={() => (setMode(m.key), setErrors({}))} className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium", mode === m.key ? "bg-surface shadow-soft" : "text-muted-foreground")}>
              {m.label}
            </button>
          ))}
        </div>
        {mode !== "DM" && (
          <>
            <Field label="Channel name" htmlFor="nc-name" required error={errors.name}>
              <Input id="nc-name" value={name} maxLength={60} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Topic" htmlFor="nc-topic" hint="What this channel is for (optional)">
              <Input id="nc-topic" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
            </Field>
          </>
        )}
        {mode === "TEAM" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Who can see it</legend>
            <p className="mb-2 text-xs text-muted-foreground">Leave all unticked to open it to every role.</p>
            <div className="flex flex-wrap gap-2">
              {TEAM_ROLES.map((r) => (
                <label key={r} className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm", roles.includes(r) ? "border-royal bg-brand-soft text-brand" : "border-border")}>
                  <input type="checkbox" className="size-3.5 accent-[var(--color-royal)]" checked={roles.includes(r)} onChange={() => setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])} />
                  {ROLE_LABELS[r] ?? r}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {mode !== "TEAM" && (
          <Field label={mode === "DM" ? "Who do you want to message?" : "Add people"} htmlFor="nc-people" required={mode === "DM"} error={errors.memberIds}>
            <PeoplePicker single={mode === "DM"} selected={people} onChange={setPeople} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
