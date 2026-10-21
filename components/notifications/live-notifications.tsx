"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openEventStream } from "@/lib/api";
import { notificationHref, useMarkNotificationRead, type NotificationItem } from "@/lib/api/pipeline";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { KIND_META } from "./kind-meta";

const POPUP_MS = 15_000;

/**
 * Keeps a live connection to the server while the CRM is open. When something is assigned to this person it:
 * refreshes the bell and the lists at once, shows a pop-up with a View button, and (if they allowed it and the tab is
 * in the background) raises a desktop alert. Offline people lose nothing: the notification waits in the database.
 */
export function LiveNotifications() {
  const { status, user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  const [popups, setPopups] = useState<NotificationItem[]>([]);
  const role = user?.role;

  const dismiss = useCallback((id: string) => setPopups((p) => p.filter((x) => x.id !== id)), []);
  const open = useCallback(
    (n: NotificationItem) => {
      markRead.mutate(n.id);
      dismiss(n.id);
      router.push(notificationHref(role, n.projectId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, router, dismiss],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    return openEventStream("/notifications/stream", (event, data) => {
      if (event !== "notification") return;
      const n = data as NotificationItem;
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["notification-log"] });
      setPopups((p) => [n, ...p.filter((x) => x.id !== n.id)].slice(0, 3));
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        const alert = new Notification(n.title, { body: n.text, tag: n.id });
        alert.onclick = () => {
          window.focus();
          router.push(notificationHref(role, n.projectId));
          alert.close();
        };
      }
    });
  }, [status, qc, router, role]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[55] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2.5" aria-live="polite">
      <AnimatePresence initial={false}>
        {popups.map((n) => (
          <Popup key={n.id} n={n} onOpen={() => open(n)} onDismiss={() => dismiss(n.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Popup({ n, onOpen, onDismiss }: { n: NotificationItem; onOpen: () => void; onDismiss: () => void }) {
  const k = KIND_META[n.kind];
  useEffect(() => {
    const t = setTimeout(onDismiss, POPUP_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, transition: { duration: 0.18 } }}
      role="status"
      data-testid="live-popup"
      className="pointer-events-auto relative overflow-hidden rounded-xl border border-royal/30 bg-surface p-3.5 pr-9 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", k.tone)}>
          <k.icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{n.title}</p>
          <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{n.text}</p>
          <Button size="sm" className="mt-2 bg-royal hover:bg-royal/90" onClick={onOpen}>
            View
          </Button>
        </div>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted">
        <X className="size-3.5" aria-hidden />
      </button>
    </motion.div>
  );
}
