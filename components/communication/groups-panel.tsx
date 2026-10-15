"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Plus, Save, Sparkles, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, RowsSkeleton } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import {
  fetchIntro,
  useChannels,
  useSaveChannel,
  type Channel,
  type ChannelKind,
  type Participant,
} from "@/lib/api/communications";
import type { Project } from "@/lib/api/projects";
import { useUserLookup } from "@/lib/api/users";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/nav";

const PHONE = /^[+\d][\d\s-]{6,15}$/;
const KIND_LABEL: Record<ChannelKind, { title: string; help: string }> = {
  WITH_CLIENT: { title: "WITH CLIENT", help: "Group shared with the client's contacts." },
  INTERNAL: { title: "INTERNAL", help: "Group for our BD, coordinators and recce team." },
};

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}

function GroupCard({ project, kind, channel, canWrite }: { project: Project; kind: ChannelKind; channel?: Channel; canWrite: boolean }) {
  const toast = useToast();
  const save = useSaveChannel(project._id);
  const users = useUserLookup(["BD", "RECCE_COORDINATOR", "RECCE_EXECUTIVE"], "", canWrite);
  const [groupName, setGroupName] = useState(channel?.groupName ?? `${project.code} - ${kind === "WITH_CLIENT" ? "Client" : "Internal"}`);
  const [participants, setParticipants] = useState<Participant[]>(
    (channel?.participants ?? []).map((p) => ({ name: p.name, role: p.role, phone: p.phone, email: p.email, userId: p.userId ?? p.user, included: p.included })),
  );
  const [externalGroupId, setExternalGroupId] = useState(channel?.externalGroupId ?? "");
  const [externalGroupUrl, setExternalGroupUrl] = useState(channel?.externalGroupUrl ?? "");
  const [intro, setIntro] = useState("");
  const [introLoading, setIntroLoading] = useState(false);
  const [error, setError] = useState("");

  const suggestions = useMemo(() => {
    const list: Participant[] = [];
    if (kind === "WITH_CLIENT" && project.requirement?.contact?.name) {
      const c = project.requirement.contact;
      list.push({ name: c.name!, role: "Client", phone: c.phone, email: c.email, included: true });
    }
    for (const u of users.data ?? []) {
      list.push({ name: u.name, role: ROLE_LABELS[u.role] ?? u.role, phone: u.phone, email: u.email, userId: u._id, included: true });
    }
    return list.filter((s) => !participants.some((p) => (s.userId && p.userId === s.userId) || (!s.userId && p.name === s.name)));
  }, [kind, project, users.data, participants]);

  const update = (i: number, patch: Partial<Participant>) => setParticipants((s) => s.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const payload = () => ({
    groupName: groupName.trim() || undefined,
    participants: participants.map((p) => ({
      name: p.name.trim(),
      role: p.role?.trim() || undefined,
      phone: p.phone?.trim() || undefined,
      email: p.email?.trim() || undefined,
      userId: p.userId,
      included: p.included,
    })),
    externalGroupId: externalGroupId.trim() || undefined,
    externalGroupUrl: externalGroupUrl.trim() || undefined,
  });

  const validate = () => {
    if (participants.some((p) => !p.name.trim())) return "Every participant needs a name";
    if (participants.some((p) => p.phone?.trim() && !PHONE.test(p.phone.trim()))) return "One or more phone numbers are invalid";
    if (externalGroupUrl.trim() && !/^https?:\/\//i.test(externalGroupUrl.trim())) return "Group link must start with http:// or https://";
    return "";
  };

  const doSave = async (quiet = false) => {
    const v = validate();
    setError(v);
    if (v) return false;
    try {
      await save.mutateAsync({ kind, body: payload() });
      if (!quiet) toast("Group saved");
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  const phones = participants.filter((p) => p.included && p.phone?.trim()).map((p) => p.phone!.trim());

  const generate = async () => {
    setIntroLoading(true);
    try {
      // the intro is generated server-side from the saved participants
      if (!(await doSave(true))) return;
      const r = await fetchIntro(project._id, kind);
      setIntro(r.text);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setIntroLoading(false);
    }
  };

  const whatsappHref = externalGroupUrl.trim()
    ? externalGroupUrl.trim()
    : intro
      ? `https://wa.me/?text=${encodeURIComponent(intro)}`
      : "https://web.whatsapp.com";
  const linked = channel?.status === "LINKED";
  const idp = `g-${kind}`;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Users className="size-4" aria-hidden /> {KIND_LABEL[kind].title}
            </h3>
            <p className="text-xs text-muted-foreground">{KIND_LABEL[kind].help}</p>
          </div>
          <Badge tone={linked ? "success" : "neutral"}>{linked ? "Linked" : "Not created"}</Badge>
        </div>
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          WhatsApp groups cannot be created automatically. Copy the numbers and intro message, create the group in WhatsApp, then paste the group link or ID below.
        </p>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Field label="Group name" htmlFor={`${idp}-name`}>
          <Input id={`${idp}-name`} value={groupName} disabled={!canWrite} onChange={(e) => setGroupName(e.target.value)} />
        </Field>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium">Phone</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 text-center font-medium">Include</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {participants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No participants yet. Add suggestions below or add a row.
                  </td>
                </tr>
              )}
              {participants.map((p, i) => (
                <tr key={i}>
                  <td className="p-1.5">
                    <Input aria-label={`Participant ${i + 1} name`} value={p.name} disabled={!canWrite} onChange={(e) => update(i, { name: e.target.value })} className="h-9" />
                  </td>
                  <td className="p-1.5">
                    <Input aria-label={`Participant ${i + 1} role`} value={p.role ?? ""} disabled={!canWrite} onChange={(e) => update(i, { role: e.target.value })} className="h-9" />
                  </td>
                  <td className="p-1.5">
                    <Input
                      aria-label={`Participant ${i + 1} phone`}
                      value={p.phone ?? ""}
                      inputMode="tel"
                      disabled={!canWrite}
                      aria-invalid={!!p.phone && !PHONE.test(p.phone)}
                      onChange={(e) => update(i, { phone: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input aria-label={`Participant ${i + 1} email`} value={p.email ?? ""} disabled={!canWrite} onChange={(e) => update(i, { email: e.target.value })} className="h-9" />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Include ${p.name || `participant ${i + 1}`}`}
                      className="size-4 accent-primary"
                      checked={p.included}
                      disabled={!canWrite}
                      onChange={(e) => update(i, { included: e.target.checked })}
                    />
                  </td>
                  <td className="p-1.5">
                    {canWrite && (
                      <Button variant="ghost" size="icon" aria-label={`Remove ${p.name || `participant ${i + 1}`}`} onClick={() => setParticipants((s) => s.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canWrite && (
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => setParticipants((s) => [...s, { name: "", role: "", phone: "", email: "", included: true }])}>
              <Plus className="size-4" aria-hidden /> Add participant
            </Button>
            {suggestions.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Suggestions (click to add)</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 12).map((s, i) => (
                    <button
                      key={`${s.userId ?? s.name}-${i}`}
                      type="button"
                      onClick={() => setParticipants((list) => [...list, s])}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      + {s.name} <span className="text-muted-foreground">({s.role})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="External group ID" htmlFor={`${idp}-gid`}>
            <Input id={`${idp}-gid`} value={externalGroupId} disabled={!canWrite} onChange={(e) => setExternalGroupId(e.target.value)} />
          </Field>
          <Field label="Group invite link" htmlFor={`${idp}-url`} hint="e.g. https://chat.whatsapp.com/...">
            <Input id={`${idp}-url`} type="url" value={externalGroupUrl} disabled={!canWrite} onChange={(e) => setExternalGroupUrl(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Button size="sm" onClick={() => doSave()} loading={save.isPending && !introLoading}>
              <Save className="size-4" aria-hidden /> Save
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={phones.length === 0}
            onClick={async () => {
              await copy(phones.join("\n"));
              toast(`Copied ${phones.length} phone number${phones.length === 1 ? "" : "s"}`);
            }}
          >
            <Copy className="size-4" aria-hidden /> Copy phone numbers
          </Button>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={generate} loading={introLoading}>
              <Sparkles className="size-4" aria-hidden /> Generate intro message
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden /> Open WhatsApp
            </a>
          </Button>
        </div>

        {intro && (
          <div className="space-y-2">
            <Field label="Intro message preview" htmlFor={`${idp}-intro`}>
              <Textarea id={`${idp}-intro`} className="min-h-40" value={intro} onChange={(e) => setIntro(e.target.value)} />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await copy(intro);
                toast("Intro message copied");
              }}
            >
              <Copy className="size-4" aria-hidden /> Copy message
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GroupsPanel({ project }: { project: Project }) {
  const { can } = useAuth();
  const channels = useChannels(project._id);
  if (channels.isPending) return <RowsSkeleton rows={4} />;
  if (channels.isError) return <ErrorState error={channels.error} onRetry={() => channels.refetch()} />;
  const by = (k: ChannelKind) => channels.data.find((c) => c.kind === k);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {(["WITH_CLIENT", "INTERNAL"] as const).map((k) => (
        <GroupCard
          key={`${k}-${by(k)?._id ?? "new"}`}
          project={project}
          kind={k}
          channel={by(k)}
          canWrite={can("communications:write")}
        />
      ))}
    </div>
  );
}
