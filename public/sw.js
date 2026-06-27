self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const clientStates = new Map();

function syncAppBadge(unreadCount) {
  if (!("setAppBadge" in self.navigator)) return Promise.resolve();
  if (unreadCount > 0) return self.navigator.setAppBadge(unreadCount);
  if ("clearAppBadge" in self.navigator) return self.navigator.clearAppBadge();
  return Promise.resolve();
}

function notificationTargetUrl(data) {
  const targetUrl = new URL("/notifications", self.location.origin);
  if (data.workOrderId) targetUrl.searchParams.set("order", data.workOrderId);
  return targetUrl;
}

function safeTargetUrl(value) {
  const targetUrl = new URL(value || "/notifications", self.location.origin);
  if (targetUrl.origin !== self.location.origin) return new URL("/notifications", self.location.origin);
  return targetUrl;
}

function sameOriginClients(clients) {
  return clients.filter((client) => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });
}

function clientSortScore(client, targetUrl) {
  const state = clientStates.get(client.id);
  let score = 0;
  if (state?.isStandalone) score += 100;
  if (state?.visibilityState === "visible") score += 20;

  try {
    const clientUrl = new URL(client.url);
    if (clientUrl.pathname === targetUrl.pathname && clientUrl.search === targetUrl.search) score += 10;
    if (clientUrl.pathname === "/notifications") score += 5;
  } catch {
    // Ignore malformed client URLs.
  }

  return score;
}

function bestClientForNotification(clients, targetUrl) {
  return sameOriginClients(clients)
    .sort((left, right) => clientSortScore(right, targetUrl) - clientSortScore(left, targetUrl))[0];
}

function hasKnownStandaloneClient() {
  return [...clientStates.values()].some((state) => state.isStandalone);
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "APP_CLIENT_STATE") return;
  if (!event.source?.id) return;

  clientStates.set(event.source.id, {
    isStandalone: Boolean(event.data.isStandalone),
    visibilityState: event.data.visibilityState || "hidden",
    updatedAt: Date.now(),
  });
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const fallbackTargetUrl = notificationTargetUrl(data);
  const targetUrl = data.url || fallbackTargetUrl.pathname + fallbackTargetUrl.search;
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
      url: targetUrl,
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
              workOrderId: data.workOrderId || null,
            });
          });
        }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = safeTargetUrl(data.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const targetClient = bestClientForNotification(clients, targetUrl);
      const targetClientState = targetClient ? clientStates.get(targetClient.id) : null;
      if (targetClient && (!hasKnownStandaloneClient() || targetClientState?.isStandalone)) {
        const hasFreshState = clientStates.has(targetClient.id);
        if (hasFreshState) {
          targetClient.postMessage({
            type: "OPEN_NOTIFICATION_TARGET",
            url: targetUrl.pathname + targetUrl.search,
            notificationId: data.notificationId || null,
            workOrderId: data.workOrderId || null,
          });
          if ("focus" in targetClient) return targetClient.focus();
          return;
        }

        if ("navigate" in targetClient) {
          const navigatedClient = await targetClient.navigate(targetUrl.href);
          if (navigatedClient && "focus" in navigatedClient) return navigatedClient.focus();
          return;
        }

        if ("focus" in targetClient) return targetClient.focus();
        return;
      }

      if ("openWindow" in self.clients) return self.clients.openWindow(targetUrl.href);
    }),
  );
});
