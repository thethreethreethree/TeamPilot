/* ELOSTATE service worker — minimal installable shell.
 *
 * Chrome requires a registered service worker before it will fire the
 * `beforeinstallprompt` event and offer install. We don't yet cache
 * application routes for offline use — that's a phase-2 PWA upgrade
 * once we know which pages a tester actually needs offline.
 *
 * What this SW does:
 *   - Activates immediately (skipWaiting + clients.claim) so a new
 *     deploy takes over without a refresh dance.
 *   - On fetch, lets every request pass through to the network.
 *     If the network is unavailable AND the request is for a top-
 *     level HTML navigation, we fall back to a tiny in-line offline
 *     notice (so the user gets something sensible instead of the
 *     browser default error page).
 */

const VERSION = "elostate-sw-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const OFFLINE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Offline · ELOSTATE</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #0A1429; color: #e2e8f0; margin: 0; padding: 2rem;
         display: grid; place-items: center; min-height: 100vh; }
  .card { max-width: 28rem; padding: 1.5rem; border-radius: 12px;
          background: #152339; border: 1px solid #2D446C; }
  h1 { font-size: 1rem; margin: 0 0 0.5rem; color: #ffffff; }
  p  { font-size: 0.875rem; margin: 0; color: #94a3b8; line-height: 1.5; }
  code { color: #F75663; font-size: 0.75rem; }
</style></head>
<body><div class="card">
  <h1>You're offline</h1>
  <p>ELOSTATE needs network access for live data. Reconnect and the
     page will reload. <br><br><code>${VERSION}</code></p>
</div></body></html>`;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request).catch(() => {
      if (request.mode === "navigate") {
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response("", { status: 504 });
    })
  );
});
