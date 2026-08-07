import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Drift guard for the standalone Sales Coach extension client config (extension-sales/config.js).
 *
 * The browser runtime can't be exercised in this no-browser sandbox, but the ONE thing that MUST stay true —
 * every tool the panel offers points at a route that actually exists — is checkable statically. This asserts
 * each SALES_TOOLS endpoint maps to a built `route.ts`, so a typo'd or not-yet-built endpoint can't ship as a
 * live-looking button (the "dead config" / schema-complete-but-unreachable class, A31). It also pins the two
 * isolation invariants that let the sales extension run alongside the C.A.R.E one.
 */

const ROOT = process.cwd();
const CONFIG = readFileSync(join(ROOT, "extension-sales", "config.js"), "utf-8");

const endpoints = Array.from(CONFIG.matchAll(/endpoint:\s*"([^"]+)"/g))
  .map((m) => m[1])
  .filter((x): x is string => Boolean(x));

describe("Sales Coach extension config — tool→route wiring", () => {
  it("declares at least the four Phase-1 tools", () => {
    expect(endpoints.length).toBeGreaterThanOrEqual(4);
  });

  it.each(endpoints)("endpoint %s maps to a built route.ts (no dead tool)", (endpoint) => {
    expect(endpoint.startsWith("/api/")).toBe(true);
    // /api/coach/extension/summarize → src/app/api/coach/extension/summarize/route.ts
    const routeFile = join(ROOT, "src", "app", endpoint.replace(/^\//, ""), "route.ts");
    expect(existsSync(routeFile)).toBe(true);
  });

  it("every endpoint is under the coach (not care) extension namespace", () => {
    for (const e of endpoints) {
      expect(e.startsWith("/api/coach/extension/")).toBe(true);
    }
  });
});

describe("Sales Coach extension config — isolation from the C.A.R.E extension", () => {
  it("stores its auth token under a DISTINCT key (salesCoachToken, not careToken)", () => {
    expect(CONFIG).toContain("salesCoachToken");
    expect(CONFIG).not.toContain("careToken");
  });

  it("uses a DISTINCT idempotency guard so both extensions can inject side by side", () => {
    expect(CONFIG).toContain("__salesCoachConfigLoaded");
    expect(CONFIG).not.toContain("__careConfigLoaded");
  });

  it("exposes SALES_TOOLS (not CARE_TOOLS)", () => {
    expect(CONFIG).toContain("globalThis.SALES_TOOLS");
    expect(CONFIG).not.toContain("CARE_TOOLS");
  });
});
