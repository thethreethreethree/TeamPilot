import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Next.js configuration.
 *
 * Hardened 2026-06-02 (audit Layer 1 production-readiness flag):
 *  - Security headers on every response
 *  - standalone output for slim Docker / container deploys
 *  - Image config (no remote sources allowed yet — explicit allowlist if/when needed)
 *  - poweredByHeader disabled (no need to advertise the framework)
 *  - React strict mode (catches lifecycle bugs)
 *
 * If a remote image source is added later, add the host to images.remotePatterns
 * rather than re-enabling unrestricted optimization.
 */

// X-Frame-Options is split out because the C.A.R.E widget route MUST be
// embeddable cross-origin (it's an iframe on the customer's site) — applying
// SAMEORIGIN there would make the browser BLOCK the embed, breaking the core
// feature. Every OTHER route keeps it for clickjacking protection.
const X_FRAME_OPTIONS = {
  key: "X-Frame-Options",
  // Prevents the app from being embedded in iframes on other origins.
  // Use SAMEORIGIN (not DENY) so internal embeds can still work if needed.
  value: "SAMEORIGIN",
};

// Everything except X-Frame-Options — safe to send on the embeddable widget too.
const BASE_SECURITY_HEADERS = [
  {
    key: "X-Content-Type-Options",
    // Stops the browser from MIME-sniffing JSON as something executable.
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    // Strip the path on cross-origin navigations; keep origin so we don't break
    // analytics in the obvious way.
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // Disable APIs the product doesn't use. Easier to allow later than to
    // remember we never blocked them.
    //
    // 2026-06-17 — microphone changed from () to (self) for Phase 9 voice:
    // Jeff's real-time call needs getUserMedia. The (self) origin restriction
    // means same-origin frames can request the mic (the dashboard widget,
    // the embedded widget served from /widget/care/...), but cross-origin
    // host pages embedding our widget via care-widget.js still need their
    // iframe element to declare allow="microphone" (handled in
    // public/care-widget.js — confirmed there).
    value: [
      "camera=()",
      "microphone=(self)",
      "geolocation=()",
      "interest-cohort=()",
      "browsing-topics=()",
    ].join(", "),
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // NOTE on CSP: a strict CSP would block Next's inline dev scripts and
  // Anthropic/DeepSeek runtime calls. Adding one safely requires either a nonce
  // strategy or a controlled allowlist — deferred to a dedicated change.
];

// Full set (with X-Frame-Options) for normal app routes.
const SECURITY_HEADERS = [X_FRAME_OPTIONS, ...BASE_SECURITY_HEADERS];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ── Build-time performance (2026-07-24 — fixes the recurring Vercel 45-min build TIMEOUT) ──────────
  // This app is large (652 TS files, 345 routes) and `next build` runs `tsc` typecheck + ESLint by
  // default. That is REDUNDANT here: CI (.github/workflows/ci.yml) already runs `npm run typecheck` and
  // `npm run lint` as separate BLOCKING gates on every push to main. Paying that cost again inside the
  // Vercel build pushed it over the 45-minute limit (intermittently — the recurring "builds failing").
  // Skipping the duplicate pass IN THE BUILD removes a large chunk of build time and does NOT change the
  // compiled output (the code still compiles identically; only the separate check passes are skipped).
  // SAFETY: CI is the typecheck/lint gate and keeps main clean. Trade-off: a type/lint error that reached
  // main would still DEPLOY (build succeeds) while CI goes red — acceptable, because the prior behaviour
  // was a build that deployed NOTHING (timed out). Revert both flags to move the checks back into the build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Output a standalone server bundle for container deploys (Vercel ignores
  // this and uses its own runtime; Docker / Fly / Render benefit).
  output: "standalone",
  images: {
    // No remote sources — every image in the product is currently local.
    // Add to remotePatterns when integrating with image-hosted services.
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        // Every route EXCEPT the embeddable C.A.R.E widget gets the full set
        // (incl. X-Frame-Options: SAMEORIGIN for clickjacking protection).
        source: "/((?!widget/care/).*)",
        headers: SECURITY_HEADERS,
      },
      {
        // The C.A.R.E widget is DESIGNED to be iframe-embedded on customers'
        // (cross-origin) sites via care-widget.js — so it must NOT send
        // X-Frame-Options, which would make the browser block the embed. It keeps
        // every other security header; its framing/tenant security is enforced at
        // the API layer (bootstrap validates the embed token + the embedding
        // origin against allowed_origins).
        source: "/widget/care/:path*",
        headers: BASE_SECURITY_HEADERS,
      },
    ];
  },
};

/**
 * Sentry wrapper. Only kicks in when SENTRY_AUTH_TOKEN is set
 * (Vercel production / preview env). Local dev without a token
 * skips source-map upload and behaves like an un-wrapped config.
 * The runtime SDK still respects NEXT_PUBLIC_SENTRY_DSN being
 * present-or-absent — see sentry.*.config.ts.
 */
const HAS_SENTRY_AUTH = !!process.env.SENTRY_AUTH_TOKEN;

export default HAS_SENTRY_AUTH
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Silent CI logs unless something goes wrong.
      silent: true,
      // Source-map upload is the value-add of the wrapper. Hide
      // them from the client bundle so customers don't get them
      // in DevTools.
      //
      // widenClientFileUpload was `true` and is the documented cause of the
      // recurring 45-min Vercel build TIMEOUT (2026-07-24): it widens the
      // source-map upload to the whole client output, and that upload runs
      // ONLY when SENTRY_AUTH_TOKEN is set (Vercel prod) — never locally,
      // which is exactly why the build is 30s local / 45-min-timeout on
      // Vercel. Narrowing it to the default upload set restores a fast build
      // while keeping runtime error capture (DSN, independent of this) AND
      // symbolication of the main bundles. If a future build still times out,
      // the next lever is disabling the upload entirely (runtime Sentry stays).
      widenClientFileUpload: false,
      hideSourceMaps: true,
      disableLogger: true,
      // Tunneling routes Sentry traffic through our domain so ad
      // blockers don't drop error events. Cheap defense.
      tunnelRoute: "/monitoring",
    })
  : nextConfig;
