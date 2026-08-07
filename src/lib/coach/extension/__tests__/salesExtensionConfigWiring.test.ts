import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Drift guard for the standalone Sales Coach extension client config (extension-sales/config.js).
 *
 * The browser runtime can't be exercised in this no-browser sandbox, but the config↔route seam MUST stay
 * true in BOTH directions (A31 — assert both directions of the seam):
 *   FORWARD  every SALES_TOOLS endpoint maps to a built `route.ts` → no dead button (a tool pointing at a
 *            route that doesn't exist).
 *   REVERSE  every built `coach/extension` tool route is surfaced in SALES_TOOLS (or is a documented
 *            non-tool) → no orphan route (a tool built server-side that no client button ever reaches — the
 *            built-but-unreachable half of the same dead-surface class).
 * It also pins the isolation invariants that let the sales extension run alongside the C.A.R.E one.
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

describe("Sales Coach extension config — reverse drift: no orphan tool route (A31 both directions)", () => {
  const ROUTES_DIR = join(ROOT, "src", "app", "api", "coach", "extension");
  // Routes under coach/extension that are NOT client tools. Listed EXPLICITLY so adding a new non-tool route
  // forces a conscious "is this a tool?" decision here, rather than silently exempting it.
  const NON_TOOL_ROUTES = new Set(["/api/coach/extension/refresh"]);

  // Every built route.ts under coach/extension → its endpoint path.
  const routeEndpoints = readdirSync(ROUTES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROUTES_DIR, d.name, "route.ts")))
    .map((d) => `/api/coach/extension/${d.name}`);

  it("finds the built routes (5 tools + refresh)", () => {
    expect(routeEndpoints.length).toBeGreaterThanOrEqual(6);
  });

  it.each(routeEndpoints)(
    "route %s is surfaced as a SALES_TOOLS tool OR a documented non-tool (no orphan)",
    (routeEndpoint) => {
      const isTool = endpoints.includes(routeEndpoint);
      const isDocumentedNonTool = NON_TOOL_ROUTES.has(routeEndpoint);
      // If this fails: a route exists that neither the panel surfaces nor is listed as infra. Either add it to
      // SALES_TOOLS (so the rep can reach it) or to NON_TOOL_ROUTES (with the reason it isn't a tool).
      expect(isTool || isDocumentedNonTool).toBe(true);
    }
  );
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
