/**
 * The canonical public origin for SEO metadata — the `<link rel=canonical>` / OG `url`
 * (layout `metadataBase`), `robots.txt`, and `sitemap.xml`. Authored once (A13) so all three
 * agree; previously each inlined the same `?? "http://localhost:4321"` fallback.
 *
 * Preference order:
 *   1. `NEXT_PUBLIC_SITE_URL` — an explicit, stable origin the operator sets (the intended source).
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's STABLE production domain (prefers the custom domain,
 *      e.g. `elostate.com`). This is the fix that makes the canonical/sitemap correct even when (1) is
 *      unset: they used to fall back to `http://localhost:4321`, which tells search engines the site
 *      lives on localhost — the canonical + every sitemap URL point somewhere unreachable, so the real
 *      pages can't rank. NOT `VERCEL_URL`: that is a per-DEPLOYMENT hostname and would make the canonical
 *      churn on every deploy (a canonical must be stable).
 *   3. `http://localhost:4321` — dev fallback so a local build never fails.
 *
 * Returns an origin with no trailing slash.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    const host = vercelProd.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${host}`;
  }

  return "http://localhost:4321";
}
