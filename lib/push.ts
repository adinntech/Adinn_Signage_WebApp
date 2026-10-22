import { api } from "@/lib/api";

/**
 * Browser push (Chrome / Edge / Firefox): a system notification that arrives even when no CRM tab is open.
 *   unsupported  this browser cannot do it (or the page is not on HTTPS / localhost)
 *   unavailable  the server has no push keys configured
 *   blocked      the person chose "Block" in the browser
 *   off          not turned on yet
 *   on           this browser is subscribed
 */
export type PushState = "unsupported" | "unavailable" | "blocked" | "off" | "on";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function serverKey(): Promise<string | null> {
  const r = await api<{ enabled: boolean; publicKey: string | null }>("/notifications/push/key");
  return r.enabled ? r.publicKey : null;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/sw.js")) ?? navigator.serviceWorker.register("/sw.js");
}

async function sendToServer(sub: PushSubscription) {
  const j = sub.toJSON();
  await api("/notifications/push/subscribe", { method: "POST", body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }) });
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try {
    if (!(await serverKey())) return "unavailable";
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    return Notification.permission === "granted" && sub ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Asks permission (must follow a click), registers the service worker and subscribes this browser. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const key = await serverKey();
  if (!key) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
  await sendToServer(sub);
  return "on";
}

/** If the person already allowed notifications, make sure this browser is registered for the signed-in account. */
export async function ensureSubscribed(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const key = await serverKey();
    if (!key) return;
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
    await sendToServer(sub);
  } catch {
    /* push is an extra; the bell and pop-up still work */
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api("/notifications/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe();
}
