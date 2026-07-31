import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

/**
 * /sitemap.xml — only the public, indexable surfaces. Customer-specific
 * routes (dashboard, onboarding, invite, api) are excluded by robots.ts
 * already, but we also don't list them here so they never get discovered.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
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
