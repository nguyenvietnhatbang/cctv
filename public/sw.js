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
      notificationId: data.notificationId || null,
      workOrderId: data.workOrderId || null,
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

  const workOrderId = event.notification.data?.workOrderId;
  const path = workOrderId
    ? `/notifications?order=${encodeURIComponent(workOrderId)}`
    : "/notifications";
  const urlToOpen = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          const clientUrl = new URL(client.url, self.location.origin);
          if (clientUrl.origin === self.location.origin && "focus" in client) {
            if ("navigate" in client) {
              client.navigate(urlToOpen);
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
