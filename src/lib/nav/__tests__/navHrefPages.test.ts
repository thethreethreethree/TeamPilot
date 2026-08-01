import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * No static nav/Link href to a /dashboard page may point at a page that doesn't exist. A page
 * deleted or moved while the nav still links it is a runtime 404 — a dead nav entry typecheck can't
 * catch (the href is a string literal). Walks the source, collects every static `href: "/dashboard/..."`
 * (nav config) and `href="/dashboard/..."` (JSX Link) path, and asserts each maps to an
 * `app/<path>/page.tsx`. Template-literal hrefs with dynamic ids are skipped (not statically
 * resolvable). The app uses no route groups, so the path->file mapping is direct.
 */
const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "../../.."); // -> src/

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "__tests__" || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const files = ["app", "components", "lib"].flatMap((d) => {
  const dir = join(SRC, d);
  return existsSync(dir) ? walk(dir) : [];
});

const hrefs = new Set<string>();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/href[=:]\s*"(\/dashboard\/[a-zA-Z0-9/_-]+)"/g)) {
    if (m[1]) hrefs.add(m[1]);
  }
}

const missing = [...hrefs].filter(
  (h) => !existsSync(join(SRC, "app", h.slice(1), "page.tsx"))
);

describe("every static /dashboard nav href resolves to a page", () => {
  it("the scan actually found the hrefs (sanity)", () => {
    expect(hrefs.size).toBeGreaterThan(30);
  });

  it("no static /dashboard href targets a non-existent page (no dead nav -> 404)", () => {
    expect(missing, `nav hrefs with no app/<path>/page.tsx: ${missing.join(", ")}`).toEqual([]);
  });
});
