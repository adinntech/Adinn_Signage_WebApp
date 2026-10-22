"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, CheckCheck } from "lucide-react";
import { KIND_META } from "@/components/notifications/kind-meta";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { notificationHref, useMarkNotificationRead, useMarkNotificationsRead, useNotifications } from "@/lib/api/pipeline";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All" },
  { key: "projects", label: "Projects" },
  { key: "documents", label: "Documents" },
  { key: "imports", label: "Imports" },
  { key: "updates", label: "Updates" },
];

/** B2 – this person's notifications from the database: assignments, client documents, imports, corrections, cancellations. */
export function NotificationsPanel() {
  const router = useRouter();
  const { user } = useAuth();
  const q = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkNotificationsRead();
  const [tab, setTab] = useState("all");

  const all = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;
  const shown = all.filter((n) => tab === "all" || KIND_META[n.kind].tab === tab);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="relative">
          <BellRing className="size-4 text-royal" aria-hidden />
          {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-loss text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        </span>
        <h2 className="flex-1 text-sm font-semibold text-navy">Assignment Notifications</h2>
        <Button variant="ghost" size="sm" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
          <CheckCheck className="size-4" aria-hidden /> Read all
        </Button>
      </div>
      <div role="tablist" aria-label="Notification type" className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("whitespace-nowrap border-b-2 px-2.5 pb-2 pt-1 text-xs font-medium", tab === t.key ? "border-royal text-royal" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label} ({t.key === "all" ? all.length : all.filter((n) => KIND_META[n.kind].tab === t.key).length})
          </button>
        ))}
      </div>
      {q.isPending ? (
        <RowsSkeleton rows={4} className="p-4" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load notifications" />
      ) : (
        <ul className="max-h-[560px] min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          <AnimatePresence initial={false}>
            {shown.map((n) => {
              const k = KIND_META[n.kind];
              return (
                <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn("flex gap-3 p-3", !n.read && "bg-[#f4f8ff]")}>
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", k.tone)}>
                    <k.icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {!n.read && <span aria-label="Unread" className="mr-1.5 inline-block size-2 rounded-full bg-royal align-middle" />}
                        {n.title}
                      </p>
                      <time className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(n.at)}</time>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.text}</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-royal hover:bg-royal/90"
                      onClick={() => {
                        if (!n.read) markOne.mutate(n.id);
                        router.push(notificationHref(user?.role, n.projectId, n.kind));
                      }}
                    >
                      View
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {shown.length === 0 && <EmptyState title="No notifications" description="New assignments from BD will appear here." />}
        </ul>
      )}
    </aside>
  );
}
