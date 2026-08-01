import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every `.rpc("fn")` in the code must call a function a migration creates. A typo'd or renamed RPC
 * with a lingering caller is a runtime "function does not exist" error that typecheck can't catch
 * (the name is a string literal) — and RPCs here are the security-critical SECURITY DEFINER
 * functions (redeem_pilot_code, accept_invitation, fin_post_entry, ...), so a broken call silently
 * disables a whole flow. Collects every static `.rpc("...")` name and asserts each is created by
 * some migration. Dynamic `.rpc(variable)` calls are skipped (not statically resolvable).
 */
const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "../../.."); // -> src/
const MIG_DIR = join(here, "../../../../supabase/migrations");

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

const rpcs = new Set<string>();
for (const f of walk(SRC)) {
  for (const m of readFileSync(f, "utf8").matchAll(/\.rpc\(\s*"([a-z][a-z0-9_]+)"/g)) {
    if (m[1]) rpcs.add(m[1]);
  }
}

const migSql = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(MIG_DIR, f), "utf8"))
  .join("\n");

const missing = [...rpcs].filter(
  (r) =>
    !new RegExp(`create\\s+(or\\s+replace\\s+)?function\\s+(public\\.)?${r}\\s*\\(`, "i").test(migSql)
);

describe("every .rpc('fn') resolves to a function created in a migration", () => {
  it("the scan actually found the .rpc() calls (sanity)", () => {
    expect(rpcs.size).toBeGreaterThan(20);
  });

  it("no .rpc() references a function no migration creates (no 'function does not exist')", () => {
    expect(missing, `.rpc() names with no CREATE FUNCTION in migrations: ${missing.join(", ")}`).toEqual(
      []
    );
  });
});
