"use client";

import { useState } from "react";
import { Check, MessageSquareReply, Pencil, Pin, PinOff, SmilePlus, Trash2, X } from "lucide-react";
import { Attachments } from "@/components/connect/attachments";
import { EMOJI } from "@/components/connect/composer";
import { Avatar, FormattedText, roleLabel, timeOf } from "@/components/connect/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useDeleteMessage, useEditMessage, usePin, useReact, type ChannelMember, type ChatMessage } from "@/lib/api/connect";
import { cn } from "@/lib/utils";

const QUICK = EMOJI.slice(0, 8);

/** One message: who, when, text, files, reactions, and the actions this person is allowed. */
export function MessageItem({
  m,
  members,
  meId,
  meName,
  channelId,
  joined,
  canManage,
  showHeader,
  onThread,
  select,
}: {
  m: ChatMessage;
  members: ChannelMember[];
  meId: string;
  meName: string;
  channelId: string;
  joined: boolean;
  canManage: boolean;
  showHeader: boolean;
  onThread?: (m: ChatMessage) => void;
  /** Super Admin clearing messages: a tick box on each message. */
  select?: { ids: Set<string>; toggle: (id: string) => void };
}) {
  const toast = useToast();
  const react = useReact(channelId);
  const pin = usePin(channelId);
  const edit = useEditMessage(channelId);
  const del = useDeleteMessage(channelId);
  const [picker, setPicker] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const mine = m.author.id === meId;
  const run = (p: Promise<unknown>) => p.catch((e) => toast(errorMessage(e), "error"));

  if (m.deleted)
    return (
      <div className="px-4 py-1 text-xs italic text-muted-foreground" id={`msg-${m.id}`}>
        This message was deleted.
      </div>
    );

  const mentionNames = members.map((x) => x.name);
  const mentionsMe = m.mentions.includes(meId);
  return (
    <div
      id={`msg-${m.id}`}
      onClick={select ? () => select.toggle(m.id) : undefined}
      className={cn("group relative flex gap-3 px-4 py-1 hover:bg-muted/40", mentionsMe && "bg-[#fff8e8] hover:bg-[#fff3dc]", showHeader && "mt-2", select && "cursor-pointer", select?.ids.has(m.id) && "bg-brand-soft hover:bg-brand-soft")}
    >
      {select && (
        <input type="checkbox" aria-label={`Select message from ${m.author.name}`} checked={select.ids.has(m.id)} onChange={() => select.toggle(m.id)} onClick={(e) => e.stopPropagation()} className="mt-2 size-4 shrink-0 accent-[var(--color-royal)]" />
      )}
      <div className="w-9 shrink-0">{showHeader && <Avatar name={m.author.name} />}</div>
      <div className="min-w-0 flex-1">
        {showHeader && (
          <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
            <span className="text-sm font-semibold text-primary">{m.author.name}{mine && <span className="font-normal text-muted-foreground"> (You)</span>}</span>
            <span className="text-xs text-muted-foreground">{roleLabel(m.author.role)}</span>
            <time className="text-[11px] text-muted-foreground" dateTime={m.createdAt}>
              {timeOf(m.createdAt)}
            </time>
          </p>
        )}
        {editing !== null ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              autoFocus
              value={editing}
              maxLength={4000}
              aria-label="Edit message"
              onChange={(e) => setEditing(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(null);
                if (e.key === "Enter" && !e.shiftKey && editing.trim()) {
                  e.preventDefault();
                  void run(edit.mutateAsync({ id: m.id, body: editing }).then(() => setEditing(null)));
                }
              }}
              className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-royal/50"
              rows={2}
            />
            <div className="flex gap-1.5">
              <Button size="sm" variant="brand" loading={edit.isPending} disabled={!editing.trim()} onClick={() => run(edit.mutateAsync({ id: m.id, body: editing }).then(() => setEditing(null)))}>
                <Check className="size-4" aria-hidden /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          m.body && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              <FormattedText text={m.body} mentionNames={mentionNames} meName={meName} />
              {m.edited && <span className="ml-1 text-[11px] text-muted-foreground">(edited)</span>}
            </p>
          )
        )}
        <Attachments channelId={channelId} items={m.attachments} />
        {(m.reactions.length > 0 || m.pinned || joined) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={!joined}
                onClick={() => run(react.mutateAsync({ id: m.id, emoji: r.emoji }))}
                aria-pressed={r.mine}
                aria-label={`${r.emoji} ${r.count}`}
                className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", r.mine ? "border-royal/40 bg-brand-soft text-brand" : "border-border bg-surface hover:bg-muted")}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
            {joined && !select && (
              <span className="relative">
                <button type="button" aria-label="Add reaction" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)} className="flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground">
                  <SmilePlus className="size-3.5" aria-hidden />
                </button>
                {addOpen && (
                  <span className="absolute bottom-full left-0 z-20 mb-1 grid w-44 grid-cols-4 gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-card">
                    {QUICK.map((e) => (
                      <button key={e} type="button" aria-label={`React ${e}`} onClick={() => (setAddOpen(false), run(react.mutateAsync({ id: m.id, emoji: e })))} className="rounded-md p-1 text-lg hover:bg-muted">
                        {e}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            )}
            {m.pinned && (
              <span className="flex items-center gap-1 text-[11px] text-approval">
                <Pin className="size-3" aria-hidden /> Pinned
              </span>
            )}
          </div>
        )}
        {m.replyCount > 0 && onThread && (
          <button type="button" onClick={() => onThread(m)} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-royal hover:underline">
            <MessageSquareReply className="size-3.5" aria-hidden /> {m.replyCount} {m.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {editing === null && joined && !select && (
        <div className="absolute -top-3 right-4 hidden items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-soft focus-within:flex group-hover:flex">
          <span className="relative">
            <button type="button" aria-label="Add reaction" aria-expanded={picker} onClick={() => setPicker(!picker)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <SmilePlus className="size-4" aria-hidden />
            </button>
            {picker && (
              <span className="absolute right-0 top-full z-20 mt-1 grid w-44 grid-cols-4 gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-card">
                {QUICK.map((e) => (
                  <button key={e} type="button" aria-label={`React ${e}`} onClick={() => (setPicker(false), run(react.mutateAsync({ id: m.id, emoji: e })))} className="rounded-md p-1 text-lg hover:bg-muted">
                    {e}
                  </button>
                ))}
              </span>
            )}
          </span>
          {onThread && !m.parent && (
            <button type="button" aria-label="Reply in thread" title="Reply in thread" onClick={() => onThread(m)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <MessageSquareReply className="size-4" aria-hidden />
            </button>
          )}
          <button type="button" aria-label={m.pinned ? "Unpin" : "Pin"} title={m.pinned ? "Unpin" : "Pin"} onClick={() => run(pin.mutateAsync({ id: m.id, pin: !m.pinned }))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            {m.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
          </button>
          {mine && (
            <button type="button" aria-label="Edit" title="Edit" onClick={() => setEditing(m.body)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <Pencil className="size-4" aria-hidden />
            </button>
          )}
          {(mine || canManage) && (
            <button type="button" aria-label="Delete" title="Delete" onClick={() => setConfirm(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger">
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
          {picker && (
            <button type="button" aria-label="Close" onClick={() => setPicker(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this message?"
        description="It is removed for everyone and its files are erased. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() => run(del.mutateAsync(m.id).then(() => setConfirm(false)))}
      />
    </div>
  );
}
