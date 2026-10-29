"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, FileText, FolderKanban, Hash, Lock, NotebookPen, Pin, Plus, Settings, UserPlus, X } from "lucide-react";
import { ChannelGlyph } from "@/components/connect/channel-list";
import { Avatar, timeOf } from "@/components/connect/format";
import { AddPeopleDialog } from "@/components/connect/side-panels";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { FileTypeIcon, kindOfName } from "@/components/upload/file-drop";
import { errorMessage } from "@/lib/api";
import { useChannelFiles, usePins, useUpdateChannel, type ChannelDetail } from "@/lib/api/connect";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABEL = { PROJECT: "Project channel", TEAM: "Team channel", PRIVATE: "Private channel", DM: "Direct message" } as const;
const DESCRIPTION = {
  PROJECT: "Project related discussions, documents, recce updates and execution details.",
  TEAM: "A channel for a team: announcements, questions and quick coordination.",
  PRIVATE: "A private conversation. Only the people added to it can read it.",
  DM: "A private conversation between the two of you.",
} as const;

function SettingsDialog({ channel, open, onClose }: { channel: ChannelDetail; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateChannel(channel.id);
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic);
  const save = (patch: { name?: string; topic?: string; archived?: boolean }, done: string) =>
    update.mutateAsync(patch).then(
      () => (toast(done), onClose()),
      (e) => toast(errorMessage(e), "error"),
    );
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Channel settings"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" loading={update.isPending} disabled={channel.kind !== "PROJECT" && name.trim().length < 2} onClick={() => save({ ...(channel.kind === "PROJECT" ? {} : { name: name.trim() }), topic: topic.trim() }, "Settings saved")}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="cs-name" hint={channel.kind === "PROJECT" ? "A project channel is named after its project code." : undefined}>
          <Input id="cs-name" value={name} maxLength={60} disabled={channel.kind === "PROJECT"} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="cs-topic">
          <Input id="cs-topic" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
        </Field>
        <Button variant="outline" onClick={() => save({ archived: !channel.archived }, channel.archived ? "Channel restored" : "Channel archived")} disabled={update.isPending}>
          <Archive className="size-4" aria-hidden /> {channel.archived ? "Restore this channel" : "Archive this channel"}
        </Button>
      </div>
    </Modal>
  );
}

const Section = ({ title, onAll, children }: { title: string; onAll?: () => void; children: React.ReactNode }) => (
  <section className="border-t border-border px-4 py-4">
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {onAll && (
        <button type="button" onClick={onAll} className="text-xs font-semibold text-royal hover:underline">
          See all
        </button>
      )}
    </div>
    {children}
  </section>
);

/** "Channel Details": cover, what the channel is for, quick actions, members, shared files and pinned messages. */
export function DetailsPanel({ channel, onTab, onClose }: { channel: ChannelDetail; onTab: (t: "files" | "pinned" | "members") => void; onClose?: () => void }) {
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState(false);
  const files = useChannelFiles(channel.id, true);
  const pins = usePins(channel.id, channel.pinned.length > 0);
  const Cover = channel.kind === "PROJECT" ? FolderKanban : channel.kind === "PRIVATE" ? Lock : Hash;
  const members = channel.members;
  const shared = files.data ?? [];

  const action = (label: string, Icon: typeof Plus, onClick: () => void, hidden?: boolean) =>
    hidden ? null : (
      <button key={label} type="button" onClick={onClick} className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-2.5 text-xs font-medium text-foreground transition-colors hover:border-royal/40 hover:bg-brand-soft">
        <Icon className="size-5 text-royal" aria-hidden />
        {label}
      </button>
    );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-base font-bold text-primary">Channel Details</h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Hide channel details" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pb-4">
          <div className="relative flex h-28 items-end overflow-hidden rounded-xl bg-gradient-to-br from-navy via-[#173a8a] to-royal p-3 text-white">
            <Cover className="absolute -right-3 -top-3 size-28 text-white/10" aria-hidden />
            <span className="relative text-lg font-bold drop-shadow">{channel.kind === "DM" ? channel.name : channel.project ? channel.project.code : channel.name}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <ChannelGlyph c={channel} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-primary">{channel.kind === "PROJECT" && channel.topic ? channel.topic.split(" · ").pop() : channel.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {channel.kind === "PRIVATE" && <Lock className="size-3" aria-hidden />} {KIND_LABEL[channel.kind]}
                {channel.archived && " · Archived"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{channel.topic && channel.kind !== "PROJECT" ? channel.topic : DESCRIPTION[channel.kind]}</p>
          <div className="mt-3 flex gap-2">
            {action("Add", UserPlus, () => setAdding(true), !channel.canManage)}
            {action("Files", FileText, () => onTab("files"))}
            {action("Pins", Pin, () => onTab("pinned"))}
            {action("Settings", Settings, () => setSettings(true), !channel.canManage)}
          </div>
          {channel.project && (
            <Button variant="outline" size="sm" asChild className="mt-2 w-full">
              <Link href={`/workspace/${channel.project.id}`}>
                <NotebookPen className="size-4" aria-hidden /> Activity, notes &amp; voice notes
              </Link>
            </Button>
          )}
        </div>

        <Section title={`Members (${members.length})`} onAll={() => onTab("members")}>
          <div className="flex flex-wrap items-center gap-1.5">
            {members.slice(0, 5).map((m) => (
              <span key={m.id} title={`${m.name}${m.channelRole === "OWNER" ? " (owner)" : ""}`}>
                <Avatar name={m.name} size={34} />
              </span>
            ))}
            {members.length > 5 && <span className="flex size-[34px] items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">+{members.length - 5}</span>}
            {channel.canManage && channel.kind !== "DM" && (
              <button type="button" onClick={() => setAdding(true)} aria-label="Add people" className="flex size-[34px] items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-royal hover:text-royal">
                <Plus className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </Section>

        <Section title={`Shared Files (${shared.length})`} onAll={shared.length ? () => onTab("files") : undefined}>
          {shared.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing shared yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {shared.slice(0, 3).map((f) => (
                <li key={`${f.messageId}-${f.fileId}`} className="flex items-center gap-3">
                  <FileTypeIcon kind={kindOfName(f.name)} name={f.name} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-primary">{f.voice ? "Voice note" : f.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatBytes(f.size)} • {f.by} • {timeOf(f.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Pinned Messages (${channel.pinned.length})`} onAll={channel.pinned.length ? () => onTab("pinned") : undefined}>
          {channel.pinned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pin a message to keep it handy.</p>
          ) : (
            <ul className="space-y-2">
              {(pins.data ?? []).slice(0, 2).map((m) => (
                <li key={m.id} className={cn("flex items-start gap-2.5 rounded-xl bg-[#fff8e8] p-2.5")}>
                  <Avatar name={m.author.name} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary">{m.author.name}</span>
                      <span className="text-muted-foreground">{timeOf(m.createdAt)}</span>
                    </span>
                    <span className="line-clamp-2 text-sm">{m.body || (m.attachments[0] ? m.attachments[0].name : "")}</span>
                  </span>
                  <Pin className="size-3.5 shrink-0 text-approval" aria-hidden />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      <AddPeopleDialog channel={channel} open={adding} onClose={() => setAdding(false)} />
      <SettingsDialog key={`${channel.name}|${channel.topic}|${channel.archived}`} channel={channel} open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
