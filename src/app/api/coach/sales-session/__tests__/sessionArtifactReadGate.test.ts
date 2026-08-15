import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A30 drift-guard — peer-rep IDOR on coaching-artifact readbacks (2026-08-15 audit).
 *
 * The leak: the `events` table is company-wide by RLS (migrations 0004/0103). A GET
 * handler that reads a session's stored coaching artifacts by filtering ONLY on
 * `kind` + `subject = sales_session:<id>` therefore returns any same-company rep's
 * private dissect / growth-review / summary to a PEER who guesses the session id —
 * an IDOR, because `events` RLS never checks session ownership.
 *
 * The gate: `getSession()` reads `coaching_sessions`, whose RLS is owner-or-manager
 * (0083/0084). Calling it first and 404-ing on null proves the caller may read this
 * session's artifacts. The POST handlers already did this; the GET readbacks did not.
 *
 * This test encodes the class: ANY request handler in this route tree that reads a
 * SINGLE session's artifacts by `.eq("subject", `sales_session:${<request id>}`)` MUST
 * also call `getSession(` in the same handler body. A new readback route that forgets
 * the gate fails the build instead of shipping the leak.
 *
 * Scope note — the single-session `.eq("subject", …)` shape is the risk because the id
 * comes straight from the request. The list route's set read (`.in("subject", subjects)`)
 * is deliberately NOT covered: its `subjects` are derived from a `coaching_sessions`
 * query already scoped by company_id + (for staff) agent_id, which IS the owner-or-manager
 * gate at list grain. Requiring getSession() there would be a false positive.
 *
 * Both branches are exercised — the guard flags a matching handler missing the call, and
 * passes because all current single-session readbacks include it.
 */
const ROUTE_DIR = join(process.cwd(), "src", "app", "api", "coach", "sales-session");

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      routeFiles(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

// Split a route file into its individual handler bodies (GET/POST/…) so the check is
// per-handler: a gated POST must not mask an ungated GET in the same file.
function handlerBodies(src: string): string[] {
  const parts = src.split(/export\s+async\s+function\s+(?:GET|POST|PUT|PATCH|DELETE)\b/);
  // parts[0] is the pre-handler preamble (imports) — drop it.
  return parts.slice(1);
}

// A single-session readback keyed on a request-supplied id: `.eq("subject", `sales_session:${x}`)`.
// This is the IDOR shape. A set read (`.in("subject", subjects)`) built from an already-scoped
// session query is intentionally not matched (see the scope note above).
const SINGLE_SESSION_EVENT_READ =
  /\.eq\(\s*["']subject["']\s*,\s*`[^`]*sales_session:\$\{[^`]*`\s*\)/;
const HAS_GATE = /getSession\s*\(/;

describe("coaching-artifact readbacks gate on getSession before reading company-wide events (peer-rep IDOR)", () => {
  const files = routeFiles(ROUTE_DIR);

  it("finds the sales-session route tree", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.replace(process.cwd(), "").replace(/\\/g, "/");
    const bodies = handlerBodies(readFileSync(file, "utf8"));
    bodies.forEach((body, i) => {
      if (!SINGLE_SESSION_EVENT_READ.test(body)) return;
      it(`${rel} handler #${i + 1} gates a single-session events read with getSession()`, () => {
        expect(
          HAS_GATE.test(body),
          `A handler in ${rel} reads a sales_session:-subject row from the company-wide ` +
            `events table without calling getSession() first — a peer rep could read another ` +
            `rep's private coaching artifact (IDOR). Add the owner-or-manager gate before the read.`
        ).toBe(true);
      });
    });
  }
});
