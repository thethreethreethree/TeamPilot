import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Drift guard for the C.A.R.E extension client config (extension/config.js) — the same both-directions A31
 * seam check the Sales Coach extension got (salesExtensionConfigWiring.test.ts), applied to the older,
 * IN-PRODUCTION sibling that had NO such guard. The browser runtime isn't exercisable in a no-browser
 * sandbox, but the config↔route seam is checkable statically:
 *   FORWARD  every CARE_TOOLS endpoint maps to a built route.ts → no dead button.
 *   REVERSE  every built care/extension route is a CARE_TOOLS tool OR a documented non-tool (rcd, refresh)
 *            → no orphan route (a tool built server-side that no panel button reaches).
 */

const ROOT = process.cwd();
const CONFIG = readFileSync(join(ROOT, "extension", "config.js"), "utf-8");

const endpoints = Array.from(CONFIG.matchAll(/endpoint:\s*"([^"]+)"/g))
  .map((m) => m[1])
  .filter((x): x is string => Boolean(x))
  // null-endpoint tools ("SOON") are honestly not-yet-built in the config; only real endpoints are wired.
  .filter((e) => e.startsWith("/api/"));

describe("C.A.R.E extension config — tool→route wiring (forward)", () => {
  it("declares its tools", () => {
    expect(endpoints.length).toBeGreaterThanOrEqual(5);
  });

  it.each(endpoints)("endpoint %s maps to a built route.ts (no dead tool)", (endpoint) => {
    expect(endpoint.startsWith("/api/care/extension/")).toBe(true);
    const routeFile = join(ROOT, "src", "app", endpoint.replace(/^\//, ""), "route.ts");
    expect(existsSync(routeFile)).toBe(true);
  });
});

describe("C.A.R.E extension config — reverse drift: no orphan tool route (A31 both directions)", () => {
  const ROUTES_DIR = join(ROOT, "src", "app", "api", "care", "extension");
  // care/extension routes that are NOT panel tools. Explicit so a new non-tool route forces a decision here.
  //  - refresh: the token-refresh proxy (infra, no panel button).
  //  - rcd:     Raw Conversation Data ingest — triggered by the capture flow, not a panel tool button.
  const NON_TOOL_ROUTES = new Set([
    "/api/care/extension/refresh",
    "/api/care/extension/rcd",
  ]);

  const routeEndpoints = readdirSync(ROUTES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROUTES_DIR, d.name, "route.ts")))
    .map((d) => `/api/care/extension/${d.name}`);

  it("finds the built routes", () => {
    expect(routeEndpoints.length).toBeGreaterThanOrEqual(6);
  });

  it.each(routeEndpoints)(
    "route %s is surfaced as a CARE_TOOLS tool OR a documented non-tool (no orphan)",
    (routeEndpoint) => {
      const isTool = endpoints.includes(routeEndpoint);
      const isDocumentedNonTool = NON_TOOL_ROUTES.has(routeEndpoint);
      // If this fails: a care/extension route exists that neither the panel surfaces nor is listed as infra.
      // Add it to CARE_TOOLS (so the agent can reach it) or to NON_TOOL_ROUTES (with the reason it isn't a tool).
      expect(isTool || isDocumentedNonTool).toBe(true);
    }
  );
});
