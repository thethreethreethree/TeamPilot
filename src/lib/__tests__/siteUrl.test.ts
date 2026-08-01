import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * DRIFT GUARD — the original SEO bug (canonical/sitemap = localhost:4321 in prod) was ONLY detectable by
 * observing live output; no test caught it. Now that siteUrl() is the single production-safe source, this
 * makes a REINTRODUCTION test-detectable: the three consumers must DELEGATE to siteUrl() and must NOT inline
 * their own `NEXT_PUBLIC_SITE_URL ?? "..."` fallback again (that literal is encapsulated in siteUrl.ts alone).
 */
describe("origin-fallback drift guard (canonical/sitemap/robots must delegate to siteUrl)", () => {
  const root = join(__dirname, "..", "..", "app");
  const consumers = ["layout.tsx", "sitemap.ts", "robots.ts"];
  for (const f of consumers) {
    it(`${f} uses siteUrl() and does NOT inline a NEXT_PUBLIC_SITE_URL fallback`, () => {
      const src = readFileSync(join(root, f), "utf8");
      expect(src, `${f} must call siteUrl()`).toContain("siteUrl(");
      // The env ACCESS lives ONLY in siteUrl.ts now; `process.env.NEXT_PUBLIC_SITE_URL` here means a re-inlined
      // fallback (a comment mentioning the var by name is fine — we target the code access, not documentation).
      expect(src, `${f} must not re-inline process.env.NEXT_PUBLIC_SITE_URL — delegate to siteUrl()`).not.toContain(
        "process.env.NEXT_PUBLIC_SITE_URL"
      );
      expect(src, `${f} must not hardcode the localhost:4321 origin`).not.toContain("localhost:4321");
    });
  }
});
