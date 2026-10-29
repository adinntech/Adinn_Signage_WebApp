"use client";

import { useState } from "react";
import { LogOut, Pin, UserMinus, UserPlus, X } from "lucide-react";
import { FileChip } from "@/components/connect/attachments";
import { Composer } from "@/components/connect/composer";
import { Avatar, roleLabel } from "@/components/connect/format";
import { MessageItem } from "@/components/connect/message-item";
import { MessageList } from "@/components/connect/message-list";
import { PeoplePicker } from "@/components/connect/people-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useChannelFiles, useChannelHistory, useChannelMembers, useMessages, usePins, type ChannelDetail, type ChannelMember, type ChatMessage } from "@/lib/api/connect";
import { formatBytes, formatDateTime } from "@/lib/format";

interface Me {
  id: string;
  name: string;
}

/** Pick people and add them to the channel (owner or Super Admin). */
export function AddPeopleDialog({ channel, open, onClose }: { channel: ChannelDetail; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { add } = useChannelMembers(channel.id);
  const [picked, setPicked] = useState<string[]>([]);
  const close = () => (setPicked([]), onClose());
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Add people"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={picked.length === 0}
            loading={add.isPending}
            onClick={() =>
              add.mutateAsync(picked).then(
                () => (toast("People added"), close()),
                (e) => toast(errorMessage(e), "error"),
              )
            }
          >
            Add {picked.length || ""}
          </Button>
        </>
      }
    >
      <PeoplePicker selected={picked} onChange={setPicked} exclude={channel.members.map((m) => m.id)} />
    </Modal>
  );
}

/** "Project Members (6)": who is in the channel, with add (managers) and remove / leave. */
export function MembersPanel({ channel, me, onLeft }: { channel: ChannelDetail; me: Me; onLeft: () => void }) {
  const toast = useToast();
  const { remove } = useChannelMembers(channel.id);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ChannelMember | null>(null);
  const label = channel.kind === "PROJECT" ? "Project Members" : "Members";
  const fixed = channel.kind === "DM";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">
          {label} ({channel.members.length})
        </h2>
        {channel.canManage && !fixed && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden /> Add
          </Button>
        )}
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {channel.members.map((m) => (
          <li key={m.id} className="group flex items-center gap-3 px-4 py-2.5">
            <Avatar name={m.name} size={34} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">
                  {m.name}
                  {m.id === me.id && " (You)"}
                </span>
                {m.channelRole === "OWNER" && <Badge tone="info">Owner</Badge>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{roleLabel(m.role)}</span>
            </span>
            {!fixed && (m.id === me.id || channel.canManage) && (
              <button type="button" aria-label={m.id === me.id ? "Leave channel" : `Remove ${m.name}`} title={m.id === me.id ? "Leave channel" : "Remove"} onClick={() => setRemoving(m)} className="rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-danger-soft hover:text-danger focus:opacity-100 group-hover:opacity-100">
                {m.id === me.id ? <LogOut className="size-4" aria-hidden /> : <UserMinus className="size-4" aria-hidden />}
              </button>
            )}
          </li>
        ))}
      </ul>
      {channel.kind === "PROJECT" && <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">People on the project are added automatically.</p>}

      <AddPeopleDialog channel={channel} open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.id === me.id ? "Leave this channel?" : `Remove ${removing?.name}?`}
        description={removing?.id === me.id ? "You will stop receiving its messages." : "They lose access to the channel and its history."}
        confirmLabel={removing?.id === me.id ? "Leave" : "Remove"}
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutateAsync(removing.id).then(
            () => {
              if (removing.id === me.id) onLeft();
              setRemoving(null);
            },
            (e) => toast(errorMessage(e), "error"),
          )
        }
      />
    </div>
  );
}

/** A thread: the first message, its replies and a reply box. */
export function ThreadPanel({ channel, root, me, onClose }: { channel: ChannelDetail; root: ChatMessage; me: Me; onClose: () => void }) {
  const live = useMessages(channel.id, root.id).data?.root ?? root;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">Thread</h2>
        <button type="button" aria-label="Close thread" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="border-b border-border py-1">
        <MessageItem m={live} members={channel.members} meId={me.id} meName={me.name} channelId={channel.id} joined={channel.joined} canManage={channel.canManage} showHeader />
      </div>
      <MessageList key={root.id} channelId={channel.id} thread={root.id} members={channel.members} meId={me.id} meName={me.name} joined={channel.joined} canManage={channel.canManage} />
      <Composer channelId={channel.id} parent={root.id} members={channel.members} meId={me.id} placeholder="Reply in thread..." disabledReason={channel.canPost ? null : "You cannot reply here."} />
    </div>
  );
}

export function FilesTab({ channel }: { channel: ChannelDetail }) {
  const q = useChannelFiles(channel.id, true);
  if (q.isPending) return <Skeleton className="m-4 h-32" />;
  const rows = q.data ?? [];
  if (!rows.length) return <EmptyState title="No files shared yet" description="Documents, images and voice notes sent in this channel are listed here." />;
  return (
    <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
      {rows.map((f) => (
        <li key={`${f.messageId}-${f.fileId}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <FileChip channelId={channel.id} a={{ ...f, durationSec: null }} />
          <span className="text-xs text-muted-foreground">
            {f.by} · {formatDateTime(f.at)} · {formatBytes(f.size)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PinnedTab({ channel, me }: { channel: ChannelDetail; me: Me }) {
  const q = usePins(channel.id, true);
  if (q.isPending) return <Skeleton className="m-4 h-32" />;
  const rows = q.data ?? [];
  if (!rows.length) return <EmptyState icon={Pin} title="Nothing pinned" description="Pin important messages so everyone can find them here." />;
  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto py-2">
      {rows.map((m) => (
        <MessageItem key={m.id} m={m} members={channel.members} meId={me.id} meName={me.name} channelId={channel.id} joined={channel.joined} canManage={channel.canManage} showHeader />
      ))}
    </div>
  );
}

export function ActivityTab({ channel }: { channel: ChannelDetail }) {
  const q = useChannelHistory(channel.id, true);
  if (q.isPending) return <Skeleton className="m-4 h-32" />;
  const rows = q.data ?? [];
  if (!rows.length) return <EmptyState title="No activity yet" description="Channel changes such as members added, pins and deletions are recorded here." />;
  return (
    <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
      {rows.map((h) => (
        <li key={h.id} className="px-4 py-2.5 text-sm">
          <p>{h.reason}</p>
          <p className="text-xs text-muted-foreground">
            {h.by ?? "System"} · {formatDateTime(h.at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
