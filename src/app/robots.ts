import type { MetadataRoute } from "next";

/**
 * /robots.txt — index public pages, keep /api, /dashboard, /onboarding, and
 * /invite/* out of search results (they're either gated behind auth or are
 * customer-specific URLs that shouldn't be indexed).
 *
 * /demo/* is also disallowed: those are sales/pitch pages a rep drives in
 * front of a prospect (e.g. /demo/c.a.r.e), not SEO landing pages — and they
 * may carry placeholder CTAs / forward-looking copy that shouldn't be
 * indexed. Remove "/demo/" here if a demo page is ever meant to rank.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4321";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/api/", "/dashboard/", "/onboarding/", "/invite/", "/demo/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
