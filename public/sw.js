/* Aphrodite Myanmar: shows phone notifications and opens the right page when one is tapped. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Aphrodite Myanmar";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag || undefined,
      data: { url: typeof data.url === "string" ? data.url : "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever open pages on this site, whatever the message says.
  let target = new URL("/", self.location.origin).href;
  try {
    const wanted = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
    if (wanted.origin === self.location.origin) target = wanted.href;
  } catch (error) {
    /* keep the home page */
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("navigate" in client && "focus" in client) {
          return client.navigate(target).then(() => client.focus());
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
