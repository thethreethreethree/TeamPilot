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

// The browser already isolates each extension (own isolated world + own chrome.storage), so these DISTINCT
// names are NOT what keeps the two from colliding — the runtime does that. Their value here is catching a
// COPY-PASTE that left C.A.R.E names in the sales config (a real risk, since this file was cloned from it):
// a stray careToken / __careConfigLoaded / CARE_TOOLS would mean the port was half-done.
describe("Sales Coach extension config — distinct-named from the C.A.R.E extension (copy-paste guard)", () => {
  it("stores its auth token under its own key (salesCoachToken; no stray careToken)", () => {
    expect(CONFIG).toContain("salesCoachToken");
    expect(CONFIG).not.toContain("careToken");
  });

  it("uses its own idempotency guard (no stray __careConfigLoaded left from the clone)", () => {
    expect(CONFIG).toContain("__salesCoachConfigLoaded");
    expect(CONFIG).not.toContain("__careConfigLoaded");
  });

  it("exposes SALES_TOOLS (not CARE_TOOLS)", () => {
    expect(CONFIG).toContain("globalThis.SALES_TOOLS");
    expect(CONFIG).not.toContain("CARE_TOOLS");
  });
});

describe("Sales Coach extension config — input max matches the route's zod cap (cross-artifact sync)", () => {
  // Tools that carry an `input` (coach's draft, formulate's intent) expose a `max` the panel textarea will
  // enforce. That number MUST equal the route's zod `.max()` for the same field — otherwise a rep types a
  // message the client accepts but the server rejects (a silent, confusing failure). This locks the two
  // numbers together (the drift-guard-for-comment-only-sync-contracts vein). An `input` immediately follows
  // its tool's `endpoint`, so pairing endpoint→input this way can't cross tools.
  const inputTools = Array.from(
    CONFIG.matchAll(/endpoint:\s*"([^"]+)",\s*input:\s*\{[^}]*?key:\s*"([^"]+)"[^}]*?max:\s*(\d+)/g)
  ).map((m) => ({ endpoint: m[1]!, inputKey: m[2]!, configMax: Number(m[3]) }));

  it("finds the input-bearing tools (coach draft, formulate intent)", () => {
    expect(inputTools.length).toBeGreaterThanOrEqual(2);
  });

  it.each(inputTools)(
    "$endpoint input '$inputKey' (max $configMax) matches the route's zod cap",
    ({ endpoint, inputKey, configMax }) => {
      const routeFile = join(ROOT, "src", "app", endpoint.replace(/^\//, ""), "route.ts");
      const route = readFileSync(routeFile, "utf-8");
      // `<inputKey>: z.string()....max(N)` — N may use `_` digit separators (e.g. 8_000).
      const m = route.match(new RegExp(`${inputKey}:\\s*z[^,}]*?\\.max\\(([\\d_]+)\\)`));
      const captured = m?.[1];
      expect(captured, `no zod .max() for '${inputKey}' in ${endpoint} route`).toBeDefined();
      const routeMax = Number((captured ?? "").replace(/_/g, ""));
      // If this fails: the panel textarea limit and the server's validation cap disagree — a rep could type a
      // message the panel accepts but the route 400s. Align the config `max` and the route's zod `.max()`.
      expect(routeMax).toBe(configMax);
    }
  );
});
