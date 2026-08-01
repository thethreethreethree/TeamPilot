import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { collectMatches, SRC_DIR } from "../../__tests__/_sourceScan";

/**
 * No static nav/Link href to a /dashboard page may point at a page that doesn't exist. A page
 * deleted or moved while the nav still links it is a runtime 404 / dead nav entry typecheck can't
 * catch (the href is a string literal). Collects every static `href: "/dashboard/..."` (nav config)
 * and `href="/dashboard/..."` (JSX Link) path and asserts each maps to an `app/<path>/page.tsx`.
 * Template-literal hrefs with dynamic ids are skipped; the app uses no route groups so the mapping
 * is direct.
 */
const hrefs = collectMatches(/href[=:]\s*"(\/dashboard\/[a-zA-Z0-9/_-]+)"/g);
const missing = [...hrefs].filter(
  (h) => !existsSync(join(SRC_DIR, "app", h.slice(1), "page.tsx"))
);

describe("every static /dashboard nav href resolves to a page", () => {
  it("the scan actually found the hrefs (sanity)", () => {
    expect(hrefs.size).toBeGreaterThan(30);
  });

  it("no static /dashboard href targets a non-existent page (no dead nav -> 404)", () => {
    expect(missing, `nav hrefs with no app/<path>/page.tsx: ${missing.join(", ")}`).toEqual([]);
  });
});
