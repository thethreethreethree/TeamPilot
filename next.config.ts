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

const SECURITY_HEADERS = [
  {
    key: "X-Frame-Options",
    // Prevents the app from being embedded in iframes on other origins.
    // Use SAMEORIGIN (not DENY) so internal embeds can still work if needed.
    value: "SAMEORIGIN",
  },
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
    value: [
      "camera=()",
      "microphone=()",
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
        // Apply to every route.
        source: "/:path*",
        headers: SECURITY_HEADERS,
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
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
      // Tunneling routes Sentry traffic through our domain so ad
      // blockers don't drop error events. Cheap defense.
      tunnelRoute: "/monitoring",
    })
  : nextConfig;
