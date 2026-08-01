/**
 * The app's canonical public origin — used for `metadataBase` (canonical + OG URLs), `sitemap.xml`, and the
 * `robots.txt` sitemap pointer.
 *
 * Prefers `NEXT_PUBLIC_SITE_URL` (set it in Vercel to the deployed origin — the proper mechanism). The fallback
 * is PRODUCTION-SAFE: it returns the known production origin when `NODE_ENV==='production'`, so a forgotten env
 * var can never ship a `localhost` canonical/sitemap. That is not hypothetical — on 2026-08-02 the live site was
 * serving `<link rel="canonical" href="http://localhost:4321">` and a sitemap of `http://localhost:4321/...`
 * URLs (the old shared fallback), which silently breaks SEO: search engines credit/crawl a non-existent
 * localhost instead of the real pages. In dev it falls back to the Next dev port.
 *
 * Centralised here because three files (layout, sitemap, robots) previously repeated the fallback literal and
 * must never drift apart.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, ""); // no trailing slash (URLs append their own)
  return process.env.NODE_ENV === "production"
    ? "https://elostate.com"
    : "http://localhost:3000";
}
