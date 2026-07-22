import type { MetadataRoute } from "next";

/**
 * /robots.txt — index public pages, keep /api, /dashboard, /onboarding, and
 * /invite/* out of search results (they're either gated behind auth or are
 * customer-specific URLs that shouldn't be indexed).
 *
 * /care/demo is also disallowed: it's a sales/pitch page a rep drives in front
 * of a prospect (the C.A.R.E walkthrough), not an SEO landing page — and it may
 * carry placeholder CTAs / forward-looking copy that shouldn't be indexed.
 * Remove "/care/demo" here if the demo page is ever meant to rank.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4321";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/api/", "/dashboard/", "/onboarding/", "/invite/", "/care/demo", "/sales/demo"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
