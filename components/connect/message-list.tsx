"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Loader2, MessageSquare } from "lucide-react";
import { MessageItem } from "@/components/connect/message-item";
import { dayOf } from "@/components/connect/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { connectKeys, useMessages, type ChannelMember, type ChatMessage, type MessagePage } from "@/lib/api/connect";
import { qs } from "@/lib/api/common";

/** The messages of a channel or of one thread: day separators, the author on every message, earlier messages on request, stays at the newest. */
export function MessageList({
  channelId,
  thread,
  members,
  meId,
  meName,
  joined,
  canManage,
  onThread,
  header,
  select,
}: {
  channelId: string;
  thread?: string;
  members: ChannelMember[];
  meId: string;
  meName: string;
  joined: boolean;
  canManage: boolean;
  onThread?: (m: ChatMessage) => void;
  header?: React.ReactNode;
  select?: { ids: Set<string>; toggle: (id: string) => void };
}) {
  const qc = useQueryClient();
  const q = useMessages(channelId, thread);
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [away, setAway] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messages = q.data?.messages ?? [];
  const last = messages[messages.length - 1]?.id;

  // New message: follow it if the reader is at the bottom, otherwise offer a jump.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (atBottom.current) el.scrollTop = el.scrollHeight;
    else setAway(true);
  }, [last]);
  // The list is remounted (by key) for each channel and thread, so it starts at the newest message. Pictures and voice
  // notes change the height after they load; while the reader is at the bottom they stay at the bottom, so the view
  // never jumps or ends up half way.
  useEffect(() => {
    const el = box.current;
    const inner = content.current;
    if (!el || !inner) return;
    el.scrollTop = el.scrollHeight;
    const watch = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    watch.observe(inner);
    return () => watch.disconnect();
  }, []);

  const onScroll = () => {
    const el = box.current!;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setAway(false);
  };
  const earlier = async () => {
    if (!messages.length) return;
    setLoadingMore(true);
    const el = box.current!;
    const before = el.scrollHeight;
    try {
      const page = await api<MessagePage>(`/connect/channels/${channelId}/messages${qs({ before: messages[0]!.id, thread, limit: 60 })}`);
      qc.setQueryData<MessagePage>(connectKeys.messages(channelId, thread), (old) => (old ? { ...old, messages: [...page.messages, ...old.messages], hasMore: page.hasMore } : old));
      requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - before));
    } finally {
      setLoadingMore(false);
    }
  };

  if (q.isPending)
    return (
      <div className="flex-1 space-y-4 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-12 flex-1" />
          </div>
        ))}
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={box} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain py-2" role="log" aria-live="polite" aria-label="Messages">
        <div ref={content}>
        {header}
        {q.data!.hasMore && (
          <div className="flex justify-center py-2">
            <Button size="sm" variant="outline" onClick={earlier} disabled={loadingMore}>
              {loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden />} Load earlier messages
            </Button>
          </div>
        )}
        {messages.length === 0 && <EmptyState icon={MessageSquare} title={thread ? "No replies yet" : "No messages yet"} description={joined ? "Say hello to start the conversation." : "Join the channel to write here."} />}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3 px-4" role="separator">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-[11px] font-medium text-muted-foreground">{dayOf(m.createdAt)}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <MessageItem m={m} members={members} meId={meId} meName={meName} channelId={channelId} joined={joined} canManage={canManage} showHeader onThread={thread ? undefined : onThread} select={select} />
            </div>
          );
        })}
        </div>
      </div>
      {away && (
        <Button size="sm" variant="brand" className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-card" onClick={() => (box.current!.scrollTop = box.current!.scrollHeight)}>
          <ArrowDown className="size-4" aria-hidden /> New messages
        </Button>
      )}
    </div>
  );
}
