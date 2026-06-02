import type { MetadataRoute } from "next";

/**
 * /robots.txt — index public pages, keep /api, /dashboard, /onboarding, and
 * /invite/* out of search results (they're either gated behind auth or are
 * customer-specific URLs that shouldn't be indexed).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4321";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/api/", "/dashboard/", "/onboarding/", "/invite/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
