"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useChannels } from "@/lib/api/connect";
import { acquireSocket, currentSocket, subscribeSocket } from "@/lib/connect-socket";

/** The shared live connection while the calling component is on screen. `null` until it is open. */
export function useConnectSocket(enabled = true): Socket | null {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return acquireSocket(qc).release;
  }, [enabled, qc]);
  return useSyncExternalStore(subscribeSocket, currentSocket, () => null);
}

/** Unread totals for the sidebar badge. Keeps itself fresh through the live connection. */
export function useConnectUnread(enabled: boolean) {
  useConnectSocket(enabled);
  const q = useChannels(enabled);
  const list = q.data ?? [];
  return { unread: list.reduce((n, c) => n + c.unread, 0), mentions: list.reduce((n, c) => n + c.mentionUnread, 0) };
}
