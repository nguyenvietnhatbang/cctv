self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function syncAppBadge(unreadCount) {
  if (!("setAppBadge" in self.navigator)) return Promise.resolve();
  if (unreadCount > 0) return self.navigator.setAppBadge(unreadCount);
  if ("clearAppBadge" in self.navigator) return self.navigator.clearAppBadge();
  return Promise.resolve();
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || "/pwa/icon-192.png",
    badge: data.badge || "/pwa/icon-192.png",
    lang: "vi",
    tag: data.tag,
    renotify: Boolean(data.renotify),
    timestamp: data.timestamp || Date.now(),
    requireInteraction: Boolean(data.requireInteraction),
    data: {
      url: data.url || "/notifications",
      notificationId: data.notificationId || null,
    },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      syncAppBadge(Number(data.unreadCount) || 0).catch(() => undefined),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "PUSH_NOTIFICATION_RECEIVED",
              notificationId: data.notificationId || null,
            });
          });
        }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if (client.url === target.href) {
            return client.focus();
          }
        }

        return self.clients.openWindow(target.href);
      }),
  );
});
