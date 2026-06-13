/* ELOSTATE Team Chat — minimal PWA service worker
 *
 * Phase 1 scope (Sprint Team-Chat-PWA-1): installability + lightweight
 * runtime cache for static assets. Browsers require a service worker
 * with a `fetch` handler for the install prompt to appear on most
 * platforms.
 *
 * What this DOES:
 * - Registers under scope /dashboard/chats/ so it controls only the
 *   chat surface. Other routes (dashboard, settings, etc.) are
 *   unaffected.
 * - Caches static assets (icons, manifest) on install so the PWA can
 *   render its splash and chrome offline even on a cold start.
 * - Passes through ALL fetch requests untouched on the network path.
 *   API calls / chat data are NOT cached in Phase 1; they go straight
 *   to network.
 *
 * What this does NOT do (deferred to Phase 2+):
 * - Offline read of recent messages (would cache /api/chat/* responses)
 * - Offline send queue (would use IndexedDB + background sync)
 * - Web Push notifications (would handle 'push' events)
 *
 * The "background instrumentation" pattern: this SW is silent in
 * normal use; its job is to make the PWA installable per platform
 * requirements, nothing more. Future versions extend it.
 */

const STATIC_CACHE = "team-chat-static-v1";
const STATIC_ASSETS = [
  "/team-chat-manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Static asset caching is best-effort. If it fails (e.g. the
        // icon file moved), the SW still installs — the PWA just
        // skips the cached splash assets.
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("team-chat-") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Static-asset cache lookup, network fallback. Everything else goes
  // straight to network — Phase 3 will add chat-data caching here.
  if (
    request.method === "GET" &&
    STATIC_ASSETS.some((path) => request.url.endsWith(path))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
  // Otherwise no responseWith — browser's default network handling.
});

// ─── Phase 2: push notification handling ─────────────────────────
//
// The server-side fan-out (Phase 2.2) encrypts JSON payloads with
// the subscription's p256dh + auth keys. When a push arrives, the
// browser decrypts and hands it here. We display a notification and,
// on click, focus or open the relevant chat URL.
//
// Expected payload shape (see lib/notifications/types.ts when added):
//   {
//     "title": string,
//     "body": string,
//     "url": string,        // e.g. /dashboard/chats/<topic-id>
//     "tag": string,        // dedup tag — same tag replaces prior
//     "messageId": string?  // optional, for click-through analytics
//   }
//
// Defensive: if the payload is malformed or absent, we show a generic
// notification so the user knows something arrived. Never silently
// drop a push — that's a debugging black hole when notifications
// stop working.
self.addEventListener("push", (event) => {
  let payload = {
    title: "New activity",
    body: "Open Team Chat to see what's new.",
    url: "/dashboard/chats",
    tag: "team-chat-generic",
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: typeof parsed.title === "string" ? parsed.title : payload.title,
        body: typeof parsed.body === "string" ? parsed.body : payload.body,
        url: typeof parsed.url === "string" ? parsed.url : payload.url,
        tag: typeof parsed.tag === "string" ? parsed.tag : payload.tag,
      };
    } catch {
      // Malformed payload — fall through to generic notification.
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: payload.url },
      // renotify: true ensures Android re-buzzes when the same tag
      // updates (e.g. multiple new messages in the same topic) rather
      // than silently swapping the notification text.
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    "/dashboard/chats";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If a window is already open on the target URL, focus it.
      // If a window is open on ANY team-chat URL, navigate it to the
      // target. Otherwise open a new window.
      for (const client of allClients) {
        if (client.url.endsWith(targetUrl)) {
          return client.focus();
        }
      }
      for (const client of allClients) {
        if (client.url.includes("/dashboard/chats")) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })()
  );
});
