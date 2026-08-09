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
  it("declares the core tools (Prospect Intel + Suggested Response)", () => {
    // 2026-08-09 merges: Coach/Draft/Say-it-for-me → "Suggested Response"; Catch-me-up + Read-the-room →
    // "Prospect Intel" (the dissect engine). Surfaced set is dissect(Prospect Intel) + suggested = 2.
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
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
  // Routes under coach/extension that are NOT client tool buttons. Listed EXPLICITLY so adding a new non-tool
  // route forces a conscious "is this a tool?" decision here, rather than silently exempting it.
  const NON_TOOL_ROUTES = new Set([
    "/api/coach/extension/refresh", // infra: silent session refresh (extensionRefresh.ts)
    "/api/coach/extension/extract", // infra: conversation file → text ingestion helper (no LLM; feeds capture)
    // (The superseded coach/copilot/formulate routes were DELETED in the 2026-08-09 cleanup — /suggest reuses
    // their engines directly. No entry needed here now that the route files are gone.)
  ]);

  // Every built route.ts under coach/extension → its endpoint path.
  const routeEndpoints = readdirSync(ROUTES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROUTES_DIR, d.name, "route.ts")))
    .map((d) => `/api/coach/extension/${d.name}`);

  it("finds the built routes (dissect, suggest tools + extract, refresh infra)", () => {
    // Post-merge: dissect(Prospect Intel), suggest (tools) + extract, refresh (non-tool infra) = 4.
    expect(routeEndpoints.length).toBeGreaterThanOrEqual(4);
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

describe("Sales Coach extension routes — every tool route is entitlement-gated (security drift guard, A30)", () => {
  const ROUTES_DIR = join(ROOT, "src", "app", "api", "coach", "extension");
  // Routes that intentionally do NOT pass through guardExtensionRequest. `refresh` is unauthenticated BY
  // DESIGN — the access token is expired (that's the whole reason it's refreshing), so the refresh_token
  // itself IS the credential (src/lib/api/extensionRefresh.ts). Listed EXPLICITLY so a new unauthenticated
  // route forces a conscious decision here rather than silently slipping past the gate.
  const UNGATED_BY_DESIGN = new Set(["refresh"]);

  const routeDirs = readdirSync(ROUTES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROUTES_DIR, d.name, "route.ts")))
    .map((d) => d.name);

  // Locks the invariant verified by reading every route this session: all 5 tool routes go through
  // guardExtensionRequest (IP guard → server-side entitlement → per-user rate limit). The per-route tests
  // cover TODAY's routes individually; this guard covers the NEXT one — a new tool route added without the
  // gate would let anyone holding a valid Supabase token, entitled or not, burn the paid AI tools. That is a
  // billing/security hole, and prose ("remember to gate it") is not a gate (A30).
  it.each(routeDirs)(
    "route %s calls guardExtensionRequest (auth + entitlement) or is ungated-by-design",
    (dir) => {
      const src = readFileSync(join(ROUTES_DIR, dir, "route.ts"), "utf-8");
      const gated = src.includes("guardExtensionRequest");
      // If this fails on a NEW route: gate it through guardExtensionRequest, or — if it is genuinely
      // unauthenticated like refresh — add it to UNGATED_BY_DESIGN above WITH the reason it needs no gate.
      expect(gated || UNGATED_BY_DESIGN.has(dir)).toBe(true);
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

  it("finds the input-bearing tool(s) (Suggested Response's guidance)", () => {
    // Post-merge there is one input-bearing tool: Suggested Response's optional `guidance` box. (Was 2 —
    // coach's draft + formulate's intent — before those merged into /suggest.)
    expect(inputTools.length).toBeGreaterThanOrEqual(1);
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
