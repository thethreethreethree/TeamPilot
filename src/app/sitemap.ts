import type { MetadataRoute } from "next";

/**
 * /sitemap.xml — only the public, indexable surfaces. Customer-specific
 * routes (dashboard, onboarding, invite, api) are excluded by robots.ts
 * already, but we also don't list them here so they never get discovered.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4321";
  // 2026-06-02 is the constitution-rewrite date and is a stable anchor; not
  // tied to deploy time so the sitemap is deterministic across builds.
  const lastModified = new Date("2026-06-02");
  return [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
