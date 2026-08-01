import { describe, it, expect } from "vitest";
import { collectMatches, allMigrationsSql } from "../../__tests__/_sourceScan";

/**
 * Every `.rpc("fn")` in the code must call a function a migration creates. A typo'd or renamed RPC
 * with a lingering caller is a runtime "function does not exist" error typecheck can't catch (the
 * name is a string literal) — and RPCs here are the security-critical SECURITY DEFINER functions
 * (redeem_pilot_code, accept_invitation, fin_post_entry, ...), so a broken call silently disables a
 * whole flow. Collects every static `.rpc("...")` name and asserts each is created by some
 * migration. Dynamic `.rpc(variable)` calls are skipped (not statically resolvable).
 */
const rpcs = collectMatches(/\.rpc\(\s*"([a-z][a-z0-9_]+)"/g);
const migSql = allMigrationsSql();

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
