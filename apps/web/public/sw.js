/* Service worker do Ocafy: recebe avisos (Web Push) e abre o app ao tocar. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (_e) {
    d = { body: event.data ? event.data.text() : "" };
  }
  const url = typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/";
  event.waitUntil(
    self.registration.showNotification(d.title || "Ocafy", {
      body: d.body || "",
      tag: d.tag || undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of all) {
        if ("focus" in c) {
          if ("navigate" in c) await c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
