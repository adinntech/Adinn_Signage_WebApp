"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Archive, ArrowLeft, Eraser, FolderKanban, Hash, ListChecks, Lock, MessageSquare, NotebookPen, Trash2, Users } from "lucide-react";
import { ChannelList } from "@/components/connect/channel-list";
import { Composer } from "@/components/connect/composer";
import { Avatar } from "@/components/connect/format";
import { MessageList } from "@/components/connect/message-list";
import { NewChannelDialog } from "@/components/connect/new-channel-dialog";
import { ActivityTab, FilesTab, MembersPanel, PinnedTab, ThreadPanel } from "@/components/connect/side-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useConnectSocket } from "@/hooks/use-connect-socket";
import { api, errorMessage } from "@/lib/api";
import { useChannel, useChannels, useClearMessages, useJoinChannel, useMarkRead, type ChatMessage } from "@/lib/api/connect";
import { useAuth } from "@/lib/auth";
import { STATUS_META } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/** True below the width where the side column no longer fits next to the conversation. */
function useSmallScreen() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(max-width: 1023px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 1023px)").matches,
    () => false,
  );
}

type Tab = "chat" | "files" | "pinned" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "files", label: "Files" },
  { key: "pinned", label: "Pinned" },
  { key: "activity", label: "Activity" },
];

/** Adinn Connect: channels on the left, the conversation in the middle, members or a thread on the right. */
export function ConnectApp() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const selected = params.get("c");
  const openProject = params.get("p");
  const [tab, setTab] = useState<Tab>("chat");
  const [thread, setThread] = useState<ChatMessage | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"selected" | "all" | null>(null);
  const small = useSmallScreen();
  const socket = useConnectSocket();
  const channels = useChannels();
  const channel = useChannel(selected ?? undefined);
  const join = useJoinChannel();
  const markRead = useMarkRead(selected ?? undefined);
  const clear = useClearMessages(selected ?? "");
  const me = { id: user?.id ?? "", name: user?.name ?? "" };
  const isManager = user?.role === "SUPER_ADMIN" || user?.role === "MANAGEMENT";
  const isAdmin = user?.role === "SUPER_ADMIN";

  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const select = (id: string | null) => {
    stopSelecting();
    setThread(null);
    setTab("chat");
    router.replace(id ? `${pathname}?c=${id}` : pathname);
  };

  // The server lets a socket listen to a channel only after checking access; join again after every reconnect.
  useEffect(() => {
    if (!socket || !selected) return;
    const joinRoom = () => socket.emit("channel:join", selected);
    joinRoom();
    socket.on("connect", joinRoom);
    return () => {
      socket.off("connect", joinRoom);
      socket.emit("channel:leave", selected);
    };
  }, [socket, selected]);

  // A link from a project (?p=<project id>) opens that project's channel, creating it the first time.
  useEffect(() => {
    if (!openProject || selected) return;
    let live = true;
    api<{ id: string }>(`/connect/channels/project/${openProject}`, { method: "POST" }).then(
      (c) => live && router.replace(`${pathname}?c=${c.id}`),
      (e) => live && (toast(errorMessage(e), "error"), router.replace(pathname)),
    );
    return () => {
      live = false;
    };
  }, [openProject, selected, router, pathname, toast]);

  // Desktop starts on the first conversation; a phone starts on the list.
  const first = channels.data?.[0]?.id;
  useEffect(() => {
    if (!selected && !openProject && first && window.matchMedia("(min-width: 768px)").matches) router.replace(`${pathname}?c=${first}`);
  }, [selected, openProject, first, router, pathname]);

  // Anything new in the open channel is read as soon as the tab is visible.
  const unread = channels.data?.find((c) => c.id === selected)?.unread ?? 0;
  useEffect(() => {
    if (unread > 0 && selected && channel.data?.joined && document.visibilityState === "visible") markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, selected, channel.data?.joined]);

  const c = channel.data;
  const Icon = c?.kind === "PROJECT" ? FolderKanban : c?.kind === "PRIVATE" ? Lock : Hash;
  const status = c?.project ? STATUS_META[c.project.status] : undefined;

  return (
    <div className={cn("grid h-[calc(100dvh-4rem)] min-h-[30rem] w-full overflow-hidden bg-surface", "md:grid-cols-[16.5rem_1fr] lg:grid-cols-[16.5rem_1fr_19rem]")}>
      <aside className={cn("min-h-0", selected && "hidden md:block")} aria-label="Channels">
        <ChannelList selected={selected} onSelect={select} onNew={() => setNewOpen(true)} canBrowse={isManager} />
      </aside>

      <section className={cn("flex min-h-0 min-w-0 flex-col", !selected && "hidden md:flex")} aria-label="Conversation">
        {!selected ? (
          <EmptyState icon={MessageSquare} title="Choose a conversation" description="Pick a channel on the left, or start a new one." />
        ) : channel.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-64" />
          </div>
        ) : channel.isError ? (
          <ErrorState error={channel.error} title="Could not open this conversation" onRetry={() => (channel.refetch(), channels.refetch())} />
        ) : (
          c && (
            <>
              <header className="border-b border-border px-4 pt-3">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Back to channels" onClick={() => select(null)}>
                    <ArrowLeft className="size-5" aria-hidden />
                  </Button>
                  {c.kind === "DM" ? <Avatar name={c.name} size={34} /> : <Icon className="size-5 shrink-0 text-royal" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <h1 className="flex flex-wrap items-center gap-2 text-base font-semibold text-primary">
                      <span className="truncate">{c.kind === "PROJECT" ? `${c.name}${c.topic ? ` · ${c.topic.split(" · ").pop()}` : ""}` : c.name}</span>
                      {status && <Badge tone={status.tone}>{status.label}</Badge>}
                      {c.archived && (
                        <Badge tone="neutral">
                          <Archive className="size-3" aria-hidden /> Archived
                        </Badge>
                      )}
                    </h1>
                    {c.topic && c.kind !== "DM" && <p className="truncate text-xs text-muted-foreground">{c.topic}</p>}
                  </div>
                  {isAdmin && tab === "chat" && c.joined && (
                    <>
                      <Button variant={selecting ? "brand" : "outline"} size="sm" aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
                        <ListChecks className="size-4" aria-hidden /> <span className="hidden sm:inline">{selecting ? "Done" : "Select"}</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirm("all")}>
                        <Eraser className="size-4" aria-hidden /> <span className="hidden sm:inline">Clear chat</span>
                      </Button>
                    </>
                  )}
                  {c.project && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/workspace/${c.project.id}`}>
                        <NotebookPen className="size-4" aria-hidden /> <span className="hidden sm:inline">Activity &amp; Notes</span>
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMembersOpen(true)}>
                    <Users className="size-4" aria-hidden /> {c.members.length}
                  </Button>
                </div>
                <div role="tablist" className="mt-2 flex gap-1">
                  {TABS.map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === t.key ? "border-royal text-royal" : "border-transparent text-muted-foreground hover:text-foreground")}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </header>

              {tab === "chat" && (
                <>
                  <MessageList key={c.id} channelId={c.id} members={c.members} meId={me.id} meName={me.name} joined={c.joined} canManage={c.canManage} onThread={setThread} select={selecting ? { ids: picked, toggle } : undefined} />
                  {selecting && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border bg-brand-soft px-4 py-2.5 text-sm">
                      <span className="font-medium text-brand">{picked.size} selected</span>
                      <span className="text-xs text-muted-foreground">Tick the messages to remove. Click a message to tick it.</span>
                      <Button size="sm" variant="destructive" className="ml-auto" disabled={picked.size === 0} onClick={() => setConfirm("selected")}>
                        <Trash2 className="size-4" aria-hidden /> Delete selected
                      </Button>
                      <Button size="sm" variant="ghost" onClick={stopSelecting}>
                        Cancel
                      </Button>
                    </div>
                  )}
                  {!selecting && (
                  <Composer
                    key={c.id}
                    channelId={c.id}
                    members={c.members}
                    meId={me.id}
                    placeholder={`Message ${c.kind === "DM" ? c.name : `#${c.name}`}`}
                    disabledReason={c.archived ? "This channel is archived. Restore it to write here." : c.joined ? null : "You are viewing this channel without being a member."}
                    onJoin={c.joined || c.archived ? undefined : () => join.mutateAsync(c.id).catch((e) => toast(errorMessage(e), "error"))}
                  />
                  )}
                </>
              )}
              {tab === "files" && <FilesTab channel={c} />}
              {tab === "pinned" && <PinnedTab channel={c} me={me} />}
              {tab === "activity" && <ActivityTab channel={c} />}
            </>
          )
        )}
      </section>

      <aside className="hidden min-h-0 border-l border-border bg-background lg:block" aria-label={thread ? "Thread" : "Members"}>
        {c && (thread ? <ThreadPanel channel={c} root={thread} me={me} onClose={() => setThread(null)} /> : <MembersPanel channel={c} me={me} onLeft={() => select(null)} />)}
      </aside>

      {/* Small screens: thread and members open over the page. */}
      {c && small && (
        <Modal open={membersOpen || !!thread} onOpenChange={(o) => !o && (setMembersOpen(false), setThread(null))} title={thread ? "Thread" : "Members"} variant="drawer">
          {thread ? <ThreadPanel channel={c} root={thread} me={me} onClose={() => setThread(null)} /> : <MembersPanel channel={c} me={me} onLeft={() => (setMembersOpen(false), select(null))} />}
        </Modal>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "all" ? "Clear this whole chat?" : `Delete ${picked.size} message${picked.size === 1 ? "" : "s"}?`}
        description={confirm === "all" ? "Every message and reply is removed for everyone and their files are erased. This cannot be undone." : "They are removed for everyone and their files are erased. This cannot be undone."}
        confirmLabel={confirm === "all" ? "Clear chat" : "Delete"}
        destructive
        loading={clear.deleteMany.isPending || clear.clearAll.isPending}
        onConfirm={() => {
          const run = confirm === "all" ? clear.clearAll.mutateAsync() : clear.deleteMany.mutateAsync([...picked]);
          void run.then(
            (r) => {
              toast(`${r.deleted} message${r.deleted === 1 ? "" : "s"} deleted`);
              setConfirm(null);
              stopSelecting();
            },
            (e) => toast(errorMessage(e), "error"),
          );
        }}
      />
      <NewChannelDialog open={newOpen} onClose={() => setNewOpen(false)} canTeam={isManager} onCreated={(id) => (setNewOpen(false), select(id))} />
    </div>
  );
}
