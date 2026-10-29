import { io, type Socket } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";
import { API_URL, getAccessToken, refreshSession } from "@/lib/api";
import { applyMessage, connectKeys, type ChatMessage } from "@/lib/api/connect";

/**
 * One live connection for Adinn Connect, shared by the page and the sidebar badge. It is created the first time something
 * listens and closed when the last listener leaves. The token is read again on every (re)connect, and an expired
 * token is refreshed once before trying again. The database stays the source of truth: after a reconnect everything
 * is simply reloaded.
 */
let socket: Socket | null = null;
let users = 0;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
/** For useSyncExternalStore: the open connection, or null. */
export const subscribeSocket = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const currentSocket = () => socket;
const origin = () => new URL(API_URL).origin;

function open(qc: QueryClient): Socket {
  if (socket) return socket;
  const s = io(origin(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: (cb) => cb({ token: getAccessToken() ?? "" }),
  });
  s.on("connect_error", (e) => {
    if (e.message === "UNAUTHORIZED") void refreshSession().then(() => s.connect()).catch(() => undefined);
  });
  // Another person's messages arrive here (our own are added when the request returns; applyMessage ignores a repeat).
  s.on("message:new", (m: ChatMessage) => {
    applyMessage(qc, m);
    qc.invalidateQueries({ queryKey: connectKeys.channels });
  });
  s.on("message:update", (m: ChatMessage) => applyMessage(qc, m));
  s.on("thread:update", (e: { channelId: string; parent: string; replyCount: number }) =>
    qc.setQueryData<{ messages: ChatMessage[] } | undefined>(connectKeys.messages(e.channelId), (old) => (old ? { ...old, messages: old.messages.map((m) => (m.id === e.parent ? { ...m, replyCount: e.replyCount } : m)) } : old)),
  );
  s.on("channel:update", (e: { channelId: string }) => {
    qc.invalidateQueries({ queryKey: connectKeys.detail(e.channelId) });
    qc.invalidateQueries({ queryKey: ["connect", "pins", e.channelId] });
    qc.invalidateQueries({ queryKey: ["connect", "history", e.channelId] });
  });
  for (const ev of ["channel:added", "channel:removed", "channel:read", "connect:activity"]) s.on(ev, () => qc.invalidateQueries({ queryKey: connectKeys.channels }));
  // After a dropped connection nothing was missed from the database's point of view; reload what is on screen.
  s.io.on("reconnect", () => qc.invalidateQueries({ queryKey: ["connect"] }));
  socket = s;
  changed();
  return s;
}

/** Start listening. Returns the socket and a function that releases it. */
export function acquireSocket(qc: QueryClient): { socket: Socket; release: () => void } {
  const s = open(qc);
  users += 1;
  return {
    socket: s,
    release: () => {
      users -= 1;
      if (users <= 0) {
        s.close();
        socket = null;
        users = 0;
        changed();
      }
    },
  };
}
