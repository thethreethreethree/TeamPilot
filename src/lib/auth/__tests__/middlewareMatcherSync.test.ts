import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideAuthRedirect } from "../routeGuard";

/**
 * Cross-artifact sync guard (routeGuard.ts:13 — "Keep this in sync with middleware.ts's
 * config.matcher", enforced until now only by that comment).
 *
 * middleware.ts's config.matcher decides WHICH requests middleware even runs on. routeGuard's
 * decideAuthRedirect is the auth gate that runs INSIDE middleware. If the matcher stops listing a
 * path routeGuard gates — say `/dashboard/:path*` is dropped in a refactor — middleware never fires
 * on /dashboard, decideAuthRedirect never executes there, and an UNAUTHENTICATED user reaches the
 * dashboard with NO redirect: a silent auth hole that typecheck and routeGuard.test.ts both miss
 * (routeGuard's logic is still correct; it just never gets called). This reads the matcher and
 * asserts it still lists every path routeGuard decides on.
 */
const here = dirname(fileURLToPath(import.meta.url));
const middlewareSrc = readFileSync(join(here, "../../../middleware.ts"), "utf8");
const matcherBlock = middlewareSrc.match(/matcher:\s*\[([\s\S]*?)\]/)?.[1] ?? "";

// Every path routeGuard protects (unauth -> login) or redirects (authed on a login page). Dropping
// any of these from the matcher silently disables that gate.
const REQUIRED = ["/dashboard/:path*", "/onboarding/:path*", "/login", "/sales-coach/login"];

describe("middleware config.matcher covers routeGuard's gated paths", () => {
  it("parsed a non-empty matcher block from middleware.ts", () => {
    expect(matcherBlock.trim().length).toBeGreaterThan(0);
  });

  for (const p of REQUIRED) {
    it(`matcher still lists "${p}"`, () => {
      expect(
        matcherBlock,
        `middleware config.matcher must list ${p} — routeGuard gates it, so if middleware doesn't run there the gate never fires`
      ).toContain(p);
    });
  }

  // The other half of the coupling: routeGuard genuinely DOES gate those paths, so the REQUIRED
  // list above isn't stale. If routeGuard starts protecting a NEW path prefix, this reminds you to
  // add it to BOTH the matcher and REQUIRED.
  it("routeGuard actually decides on each matched path (proves the coupling both ways)", () => {
    expect(decideAuthRedirect({ hasUser: false, path: "/dashboard/care" })).toMatch(/login/);
    expect(decideAuthRedirect({ hasUser: false, path: "/onboarding" })).toMatch(/login/);
    expect(decideAuthRedirect({ hasUser: true, path: "/login" })).toBe("/dashboard");
    expect(decideAuthRedirect({ hasUser: true, path: "/sales-coach/login" })).toBe(
      "/dashboard/sales-coach"
    );
  });
});
