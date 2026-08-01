import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * No client fetch('/api/...') may target a route that doesn't exist. A route renamed or deleted
 * while a caller still points at the old path is a runtime 404 — a silently-broken feature that
 * typecheck can't catch (the path is a string literal). This walks the source, collects every
 * STATIC `fetch("/api/...")` path (template-literal paths with dynamic ids are skipped — they can't
 * be resolved statically), and asserts each maps to an `app/<path>/route.ts`.
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

const paths = new Set<string>();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/fetch\(\s*"(\/api\/[a-zA-Z0-9/_-]+)"/g)) {
    if (m[1]) paths.add(m[1]);
  }
}

const missing = [...paths].filter(
  (p) => !existsSync(join(SRC, "app", p.slice(1), "route.ts"))
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
