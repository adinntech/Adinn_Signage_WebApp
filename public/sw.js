/* ADINN Recce CRM service worker: shows Chrome/Edge notifications pushed by the server, even when no CRM tab is open. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ADINN Recce CRM";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // If the CRM is open and in front, its own pop-up already shows this, so skip the duplicate system notification.
      if (windows.some((w) => w.visibilityState === "visible" && w.focused)) return;
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag,
        data: { url: data.url || "/" },
        requireInteraction: true, // stays until clicked, so a new assignment is not missed
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          await w.focus();
          try {
            await w.navigate(url);
          } catch {
            /* a different origin cannot be navigated; fall through to opening it */
            await self.clients.openWindow(url);
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
