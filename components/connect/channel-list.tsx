"use client";

import { useState } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight, Compass, FolderKanban, Hash, Lock, Plus, Search, X } from "lucide-react";
import { Avatar, roleLabel, timeOf } from "@/components/connect/format";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { useBrowse, useChannels, useJoinChannel, useSearch, type ChannelItem } from "@/lib/api/connect";
import { cn } from "@/lib/utils";

const SECTIONS: { kind: ChannelItem["kind"]; label: string }[] = [
  { kind: "TEAM", label: "Channels" },
  { kind: "PRIVATE", label: "Private" },
  { kind: "DM", label: "Direct messages" },
  { kind: "PROJECT", label: "Projects" },
];
type Tab = "all" | "channels" | "direct" | "mentions";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "channels", label: "Channels" },
  { key: "direct", label: "Direct" },
  { key: "mentions", label: "Mentions" },
];
const inTab = (c: ChannelItem, t: Tab) => (t === "all" ? true : t === "direct" ? c.kind === "DM" : t === "channels" ? c.kind !== "DM" : c.mentionUnread > 0);
/** Time for today, the date for older chats. */
const stamp = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? timeOf(iso) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const KIND_ICON = { PROJECT: FolderKanban, TEAM: Hash, PRIVATE: Lock, DM: Hash } as const;

/** The channel's picture: the person for a direct message, otherwise a tinted icon for its kind. */
export function ChannelGlyph({ c, size = 34 }: { c: Pick<ChannelItem, "kind" | "name">; size?: number }) {
  if (c.kind === "DM") return <Avatar name={c.name} size={size} />;
  const I = KIND_ICON[c.kind];
  const tone = c.kind === "PROJECT" ? "bg-[#e8f0ff] text-royal" : c.kind === "PRIVATE" ? "bg-[#fff0e0] text-approval" : "bg-[#e2f8ea] text-finance";
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl", tone)} style={{ width: size, height: size }}>
      <I style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden />
    </span>
  );
}

/**
 * Left bar of Adinn Connect, in a light tone so it does not sit next to the navy app menu as a second dark column.
 * It folds into a slim rail of round icons (hover shows the name, a dot shows unread); click one to open that chat.
 */
export function ChannelList({ selected, onSelect, onNew, canBrowse, collapsed, onToggle }: { selected: string | null; onSelect: (id: string) => void; onNew: () => void; canBrowse: boolean; collapsed: boolean; onToggle: () => void }) {
  const list = useChannels();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const search = useSearch(dq);
  const [tab, setTab] = useState<Tab>("all");
  // Projects start folded: a person on many projects would otherwise push the direct messages out of view.
  const [folded, setFolded] = useState<Record<string, boolean>>({ PROJECT: true });
  // The project channels a manager can join are listed straight away, not hidden behind a click.
  const [browse, setBrowse] = useState(true);
  const [bq, setBq] = useState("");
  const dbq = useDebounced(bq.trim());
  const found = useBrowse(dbq, browse && canBrowse);
  const join = useJoinChannel();
  const all = list.data ?? [];
  const items = all.filter((c) => inTab(c, tab));

  if (collapsed)
    return (
      <div className="flex h-full flex-col items-center gap-2 border-r border-border bg-surface py-3">
        <button type="button" onClick={onToggle} aria-label="Show the chat list" title="Show the chat list" className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronsRight className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={onNew} aria-label="New conversation" title="New conversation" className="rounded-xl bg-gradient-to-br from-royal to-vendor p-2 text-white shadow-soft hover:brightness-110">
          <Plus className="size-5" aria-hidden />
        </button>
        <div className="mt-1 flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-1">
          {all.map((c) => (
            <button key={c.id} type="button" onClick={() => onSelect(c.id)} title={c.name} aria-label={`${c.name}${c.unread ? `, ${c.unread} unread` : ""}`} aria-current={selected === c.id ? "true" : undefined} className={cn("relative rounded-2xl p-1 transition-all hover:scale-105", selected === c.id ? "bg-brand-soft ring-2 ring-royal" : "hover:bg-muted")}>
              <ChannelGlyph c={c} size={38} />
              {c.unread > 0 && <span className={cn("absolute -right-0.5 -top-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-bold text-white ring-2 ring-white", c.mentionUnread > 0 ? "bg-danger" : "bg-royal")}>{c.unread > 9 ? "9+" : c.unread}</span>}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex h-full flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <h2 className="flex-1 text-lg font-bold text-primary">Chats</h2>
        <button type="button" onClick={onNew} aria-label="New conversation" title="New conversation" className="rounded-xl bg-royal p-2 text-white shadow-soft hover:bg-royal/90">
          <Plus className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={onToggle} aria-label="Fold the chat list into icons" title="Fold into icons" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronsLeft className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search messages" placeholder="Search messages" maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 bg-background pl-8 shadow-none" />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Show" className="flex gap-1 border-b border-border px-3">
        {TABS.map((t) => {
          const n = t.key === "mentions" ? all.filter((c) => c.mentionUnread > 0).length : t.key === "all" ? all.filter((c) => c.unread > 0).length : 0;
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("-mb-px flex items-center gap-1 border-b-2 px-2.5 py-2 text-xs font-semibold", tab === t.key ? "border-royal text-royal" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              {n > 0 && <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {dq.length >= 2 ? (
          <div>
            <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Search results</p>
            {search.isPending && <p className="px-2 py-2 text-sm text-muted-foreground">Searching...</p>}
            {search.data?.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No messages match.</p>}
            {search.data?.map((h) => (
              <button key={h.id} type="button" onClick={() => (onSelect(h.channel), setQ(""))} className="mb-1 w-full rounded-xl px-2.5 py-2 text-left hover:bg-muted">
                <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">{h.channelName}</span>
                  <span>{timeOf(h.createdAt)}</span>
                </span>
                <span className="block truncate text-sm font-medium text-primary">{h.author.name}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{h.body}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {list.isPending && <p className="px-3 py-2 text-sm text-muted-foreground">Loading chats...</p>}
            {SECTIONS.map(({ kind, label }) => {
              const every = items.filter((c) => c.kind === kind);
              if (!every.length) return null;
              const rows = folded[kind] ? [] : every;
              const unread = every.reduce((n, c) => n + c.unread, 0);
              return (
                <div key={kind} className="mb-2">
                  <button type="button" aria-expanded={!folded[kind]} onClick={() => setFolded({ ...folded, [kind]: !folded[kind] })} className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted">
                    <ChevronDown className={cn("size-3.5 transition-transform", folded[kind] && "-rotate-90")} aria-hidden />
                    <span className="flex-1">
                      {label} <span className="font-normal">({every.length})</span>
                    </span>
                    {folded[kind] && unread > 0 && <span className="rounded-full bg-royal px-1.5 text-[10px] font-bold text-white">{unread}</span>}
                  </button>
                  {rows.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelect(c.id)}
                      aria-current={selected === c.id ? "true" : undefined}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors", selected === c.id ? "bg-brand-soft ring-1 ring-royal/25" : "hover:bg-muted")}
                    >
                      <ChannelGlyph c={c} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-sm", c.unread > 0 || selected === c.id ? "font-semibold text-primary" : "font-medium text-foreground")}>{c.name}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{stamp(c.lastMessageAt)}</span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">{c.lastMessagePreview || (c.kind === "DM" && c.dmUser ? roleLabel(c.dmUser.role) : c.topic)}</span>
                          {c.unread > 0 && (
                            <span aria-label={`${c.unread} unread${c.mentionUnread ? `, ${c.mentionUnread} mentions` : ""}`} className={cn("min-w-5 shrink-0 rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums text-white", c.mentionUnread > 0 ? "bg-danger" : "bg-royal")}>
                              {c.unread > 99 ? "99+" : c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
            {!list.isPending && items.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">{all.length === 0 ? "No chats yet. Start one with the + button." : tab === "mentions" ? "No one has mentioned you." : "Nothing here."}</p>}
          </>
        )}
      </div>

      {canBrowse && (
        <div className="border-t border-border p-2">
          <button type="button" onClick={() => setBrowse(!browse)} aria-expanded={browse} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <Compass className="size-4" aria-hidden /> Browse project channels
          </button>
          {browse && (
            <div className="mt-1 space-y-1">
              <Input aria-label="Find a channel" placeholder="Find a channel" maxLength={60} value={bq} onChange={(e) => setBq(e.target.value)} className="h-8 text-sm" />
              <ul className="max-h-40 overflow-y-auto">
                {(found.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => join.mutateAsync(c.id).then(() => (onSelect(c.id), setBrowse(false)), () => undefined)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {c.kind === "PROJECT" ? <FolderKanban className="size-3.5 shrink-0 text-royal" aria-hidden /> : <Hash className="size-3.5 shrink-0 text-finance" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground">{c.memberCount}</span>
                    </button>
                  </li>
                ))}
                {found.data?.length === 0 && <li className="px-2.5 py-2 text-xs text-muted-foreground">No more channels.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
