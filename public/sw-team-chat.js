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
  // straight to network — Phase 2 will add chat-data caching here.
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
