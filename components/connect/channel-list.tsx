"use client";

import { useState } from "react";
import { Compass, FolderKanban, Hash, Lock, Plus, Search, X } from "lucide-react";
import { Avatar, roleLabel, timeOf } from "@/components/connect/format";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { useBrowse, useChannels, useJoinChannel, useSearch, type ChannelItem } from "@/lib/api/connect";
import { cn } from "@/lib/utils";

const SECTIONS: { kind: ChannelItem["kind"]; label: string }[] = [
  { kind: "PROJECT", label: "Projects" },
  { kind: "TEAM", label: "Channels" },
  { kind: "PRIVATE", label: "Private" },
  { kind: "DM", label: "Direct messages" },
];

function Icon({ c }: { c: ChannelItem }) {
  if (c.kind === "DM") return <Avatar name={c.name} size={22} />;
  const I = c.kind === "PROJECT" ? FolderKanban : c.kind === "PRIVATE" ? Lock : Hash;
  return <I className="size-4 shrink-0 text-white/60" aria-hidden />;
}

/** Left column: search, channels by kind with unread counts, new conversation and (Admin / Management) browse. */
export function ChannelList({ selected, onSelect, onNew, canBrowse }: { selected: string | null; onSelect: (id: string) => void; onNew: () => void; canBrowse: boolean }) {
  const list = useChannels();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const search = useSearch(dq);
  const [browse, setBrowse] = useState(false);
  const [bq, setBq] = useState("");
  const dbq = useDebounced(bq.trim());
  const found = useBrowse(dbq, browse && canBrowse);
  const join = useJoinChannel();
  const items = list.data ?? [];

  return (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-base font-semibold">Adinn Connect</h2>
        <button type="button" onClick={onNew} aria-label="New conversation" title="New conversation" className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-white/50" aria-hidden />
          <Input aria-label="Search messages" placeholder="Search messages" maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 border-white/10 bg-white/10 pl-8 text-white shadow-none placeholder:text-white/50" />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {dq.length >= 2 ? (
          <div>
            <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">Search results</p>
            {search.isPending && <p className="px-2 py-2 text-sm text-white/60">Searching...</p>}
            {search.data?.length === 0 && <p className="px-2 py-2 text-sm text-white/60">No messages match.</p>}
            {search.data?.map((h) => (
              <button key={h.id} type="button" onClick={() => (onSelect(h.channel), setQ(""))} className="mb-1 w-full rounded-lg px-2 py-2 text-left hover:bg-white/10">
                <span className="flex items-center justify-between text-[11px] text-white/60">
                  <span className="truncate">{h.channelName}</span>
                  <span>{timeOf(h.createdAt)}</span>
                </span>
                <span className="block truncate text-sm font-medium">{h.author.name}</span>
                <span className="line-clamp-2 text-xs text-white/70">{h.body}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {list.isPending && <p className="px-3 py-2 text-sm text-white/60">Loading channels...</p>}
            {SECTIONS.map(({ kind, label }) => {
              const rows = items.filter((c) => c.kind === kind);
              if (!rows.length) return null;
              return (
                <div key={kind} className="mb-2">
                  <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</p>
                  {rows.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelect(c.id)}
                      aria-current={selected === c.id ? "true" : undefined}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/10", selected === c.id && "bg-white/15")}
                    >
                      <Icon c={c} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", c.unread > 0 ? "font-semibold text-white" : "text-white/80")}>{c.name}</span>
                        {c.kind === "DM" && c.dmUser ? (
                          <span className="block truncate text-[11px] text-white/50">{roleLabel(c.dmUser.role)}</span>
                        ) : (
                          c.lastMessagePreview && <span className="block truncate text-[11px] text-white/50">{c.lastMessagePreview}</span>
                        )}
                      </span>
                      {c.unread > 0 && (
                        <span aria-label={`${c.unread} unread${c.mentionUnread ? `, ${c.mentionUnread} mentions` : ""}`} className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums", c.mentionUnread > 0 ? "bg-danger text-white" : "bg-royal text-white")}>
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
            {!list.isPending && items.length === 0 && <p className="px-3 py-4 text-sm text-white/60">No conversations yet. Start one with the + button.</p>}
          </>
        )}
      </div>

      {canBrowse && (
        <div className="border-t border-white/10 p-2">
          <button type="button" onClick={() => setBrowse(!browse)} aria-expanded={browse} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/80 hover:bg-white/10">
            <Compass className="size-4" aria-hidden /> Browse project channels
          </button>
          {browse && (
            <div className="mt-1 space-y-1">
              <Input aria-label="Find a channel" placeholder="Find a channel" maxLength={60} value={bq} onChange={(e) => setBq(e.target.value)} className="h-8 border-white/10 bg-white/10 text-sm text-white shadow-none placeholder:text-white/50" />
              <ul className="max-h-40 overflow-y-auto">
                {(found.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => join.mutateAsync(c.id).then(() => (onSelect(c.id), setBrowse(false)), () => undefined)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-white/80 hover:bg-white/10"
                    >
                      {c.kind === "PROJECT" ? <FolderKanban className="size-3.5 shrink-0" aria-hidden /> : <Hash className="size-3.5 shrink-0" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-[11px] text-white/50">{c.memberCount}</span>
                    </button>
                  </li>
                ))}
                {found.data?.length === 0 && <li className="px-2.5 py-2 text-xs text-white/60">No more channels.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
