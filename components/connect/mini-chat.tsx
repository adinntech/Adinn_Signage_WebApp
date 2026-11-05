"use client";

import { useEffect } from "react";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { ChannelGlyph } from "@/components/connect/channel-list";
import { Composer } from "@/components/connect/composer";
import { MessageList } from "@/components/connect/message-list";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useConnectSocket } from "@/hooks/use-connect-socket";
import { useChannel, useMarkRead } from "@/lib/api/connect";
import { useAuth } from "@/lib/auth";

/**
 * One conversation inside the floating Adinn Connect window: the same messages and message box as the full page, so a
 * quick reply never needs a page change. New messages arrive live and are marked read while the window is open.
 */
export function MiniChat({ channelId, onBack, onExpand }: { channelId: string; onBack: () => void; onExpand: () => void }) {
  const { user } = useAuth();
  const socket = useConnectSocket();
  const channel = useChannel(channelId);
  const markRead = useMarkRead(channelId);
  const me = { id: user?.id ?? "", name: user?.name ?? "" };
  const joined = channel.data?.joined;

  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit("channel:join", channelId);
    join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      socket.emit("channel:leave", channelId);
    };
  }, [socket, channelId]);
  useEffect(() => {
    if (joined) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, channelId]);

  const c = channel.data;
  return (
    <div className="flex h-[30rem] max-h-[70dvh] flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-navy via-[#173a8a] to-royal px-3 py-2.5 text-white">
        <button type="button" onClick={onBack} aria-label="Back to chats" className="rounded-md p-1.5 hover:bg-white/15">
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        {c && <ChannelGlyph c={c} size={28} />}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{c?.name ?? "Opening..."}</h2>
        <button type="button" onClick={onExpand} aria-label="Open in full screen" title="Open in full screen" className="rounded-md p-1.5 hover:bg-white/15">
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </div>
      {channel.isPending ? (
        <Skeleton className="m-3 h-40 flex-1" />
      ) : channel.isError ? (
        <ErrorState error={channel.error} title="Could not open this chat" onRetry={() => channel.refetch()} />
      ) : (
        c && (
          <>
            <MessageList key={c.id} channelId={c.id} members={c.members} meId={me.id} meName={me.name} joined={c.joined} canManage={c.canManage} />
            <Composer key={`c-${c.id}`} channelId={c.id} members={c.members} meId={me.id} placeholder={`Message ${c.name}`} disabledReason={c.archived ? "This chat is archived." : c.joined ? null : "Open it in full screen to join."} />
          </>
        )
      )}
    </div>
  );
}
