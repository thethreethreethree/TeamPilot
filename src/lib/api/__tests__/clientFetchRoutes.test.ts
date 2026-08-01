import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { collectMatches, SRC_DIR } from "../../__tests__/_sourceScan";

/**
 * No client fetch('/api/...') may target a route that doesn't exist. A route renamed or deleted
 * while a caller still points at the old path is a runtime 404 — a silently-broken feature that
 * typecheck can't catch (the path is a string literal). Collects every STATIC `fetch("/api/...")`
 * path and asserts each maps to an `app/<path>/route.ts`. Template-literal paths with dynamic ids
 * are skipped (not statically resolvable).
 */
const paths = collectMatches(/fetch\(\s*"(\/api\/[a-zA-Z0-9/_-]+)"/g);
const missing = [...paths].filter(
  (p) => !existsSync(join(SRC_DIR, "app", p.slice(1), "route.ts"))
);

describe("every static client fetch('/api/...') resolves to a route handler", () => {
  it("the scan actually found the client fetch calls (sanity)", () => {
    expect(paths.size).toBeGreaterThan(50);
  });

  it("no static /api fetch targets a non-existent route (no renamed/deleted-route 404s)", () => {
    expect(missing, `client fetch paths with no app/<path>/route.ts: ${missing.join(", ")}`).toEqual(
      []
    );
  });
});
