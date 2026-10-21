"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { notificationHref, useMarkNotificationRead, useMarkNotificationsRead, useNotifications } from "@/lib/api/pipeline";
import { cn } from "@/lib/utils";
import { KIND_META } from "./kind-meta";

/** Header bell for every role: unread count, the latest items, and one click to open the related project. */
export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const q = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkNotificationsRead();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const unread = q.data?.unread ?? 0;
  const items = (q.data?.items ?? []).slice(0, 8);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative">
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span data-testid="bell-count" className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold text-navy">Notifications</p>
          <Button variant="ghost" size="sm" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck className="size-4" aria-hidden /> Read all
          </Button>
        </div>
        {q.isError ? (
          <p role="alert" className="p-4 text-sm text-danger">Could not load notifications. <button type="button" className="underline" onClick={() => q.refetch()}>Retry</button></p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{q.isPending ? "Loading…" : "You are all caught up."}</p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((n) => {
              const k = KIND_META[n.kind];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) markOne.mutate(n.id);
                      router.push(notificationHref(user?.role, n.projectId));
                    }}
                    className={cn("flex w-full gap-3 px-3 py-2.5 text-left hover:bg-muted", !n.read && "bg-[#f4f8ff]")}
                  >
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", k.tone)}>
                      <k.icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {!n.read && <span aria-label="Unread" className="mr-1.5 inline-block size-2 rounded-full bg-royal align-middle" />}
                        {n.title}
                      </span>
                      <span className="line-clamp-2 block text-xs text-muted-foreground">{n.text}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatDateTime(n.at)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {perm !== "unsupported" && (
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {perm === "granted" ? (
              <span className="flex items-center gap-1.5"><BellRing className="size-3.5 text-finance" aria-hidden /> Desktop alerts are on (shown when this tab is in the background).</span>
            ) : perm === "denied" ? (
              "Desktop alerts are blocked in this browser. Allow them in the site settings to turn them on."
            ) : (
              <button type="button" className="font-medium text-royal hover:underline" onClick={() => void Notification.requestPermission().then(setPerm)}>
                Turn on desktop alerts
              </button>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
