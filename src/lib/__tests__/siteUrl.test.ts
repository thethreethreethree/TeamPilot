import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { siteUrl } from "../siteUrl";

/**
 * siteUrl() is the single source for the canonical/OG/robots/sitemap origin. The bug it fixes: with
 * NEXT_PUBLIC_SITE_URL unset in prod, all three fell back to http://localhost:4321 — search engines were
 * told the site lives on localhost (canonical + sitemap unreachable → pages can't rank). Locks the
 * preference chain: explicit env → Vercel production domain → dev placeholder.
 */
const saved = {
  site: process.env.NEXT_PUBLIC_SITE_URL,
  vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});
afterEach(() => {
  if (saved.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = saved.site;
  if (saved.vercel === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  else process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.vercel;
});

describe("siteUrl", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL (trailing slash stripped)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://elostate.com/";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "ignored.vercel.app";
    expect(siteUrl()).toBe("https://elostate.com");
  });

  it("falls back to the Vercel production domain (https://) — NOT localhost — when the env is unset", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "elostate.com";
    expect(siteUrl()).toBe("https://elostate.com");
  });

  it("normalizes a Vercel value that already carries a protocol / trailing slash", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "https://elostate.com/";
    expect(siteUrl()).toBe("https://elostate.com");
  });

  it("uses the dev placeholder only when BOTH are unset (build never fails locally)", () => {
    expect(siteUrl()).toBe("http://localhost:4321");
  });
});
