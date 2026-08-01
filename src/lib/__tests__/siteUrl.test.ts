import { describe, it, expect, afterEach, vi } from "vitest";
import { siteUrl } from "../siteUrl";

/**
 * siteUrl() is the canonical-origin fallback for metadataBase / sitemap / robots. The load-bearing property:
 * an unset NEXT_PUBLIC_SITE_URL must NEVER yield a localhost origin in production (the 2026-08-02 live bug —
 * canonical + sitemap were http://localhost:4321, silently breaking SEO).
 */
const OLD_ENV = process.env.NEXT_PUBLIC_SITE_URL;
const OLD_NODE = process.env.NODE_ENV;
afterEach(() => {
  if (OLD_ENV === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = OLD_ENV;
  vi.stubEnv("NODE_ENV", OLD_NODE ?? "test");
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://custom.example.com";
    expect(siteUrl()).toBe("https://custom.example.com");
  });

  it("strips a trailing slash from the configured value (URLs append their own)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://custom.example.com/";
    expect(siteUrl()).toBe("https://custom.example.com");
  });

  it("falls back to the PRODUCTION origin (never localhost) when unset in prod — the SEO fix", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.stubEnv("NODE_ENV", "production");
    const out = siteUrl();
    expect(out).toBe("https://elostate.com");
    expect(out).not.toContain("localhost"); // the exact regression this guards
  });

  it("falls back to the Next dev port when unset in development", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.stubEnv("NODE_ENV", "development");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
