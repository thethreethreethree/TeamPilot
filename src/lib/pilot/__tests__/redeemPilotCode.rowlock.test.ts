import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * redeem_pilot_code single-use row-lock guard (A30 — atomic single-use of the pilot access codes).
 *
 * Pilot codes are single-use: 100 seeded codes must yield at most 100 grants. The redeem RPC enforces this
 * atomically with `SELECT ... FOR UPDATE` on the code row, then checks `redeemed_at` while holding the lock —
 * so two concurrent redemptions can't both pass (the second blocks, then sees it used). If a future migration
 * `create or replace`s redeem_pilot_code WITHOUT the row lock, that becomes a check-then-update TOCTOU race
 * (double-redemption). This pins it: EVERY migration that defines redeem_pilot_code must acquire the row lock
 * inside that function, so a weakening redefinition fails CI. Migrations are append-only, so "every definition
 * has it" ⇒ the live (latest) definition has it.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(here, "../../../../supabase/migrations");

/** Every `create or replace function redeem_pilot_code ... $$` body across the migrations. */
function redeemDefinitions(): Array<{ file: string; body: string }> {
  const defs: Array<{ file: string; body: string }> = [];
  for (const file of readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(MIG_DIR, file), "utf8");
    const re = /create\s+or\s+replace\s+function\s+redeem_pilot_code[\s\S]*?\$\$[\s\S]*?\$\$/gi;
    for (const m of sql.match(re) ?? []) defs.push({ file, body: m });
  }
  return defs;
}

describe("redeem_pilot_code enforces single-use with a row lock (no double-redemption)", () => {
  const defs = redeemDefinitions();

  it("finds at least one redeem_pilot_code definition (the guard is anchored)", () => {
    expect(defs.length).toBeGreaterThan(0);
  });

  it("EVERY redeem_pilot_code definition acquires a row lock (FOR UPDATE) on the code", () => {
    const unlocked = defs.filter((d) => !/\bfor\s+update\b/i.test(d.body)).map((d) => d.file);
    expect(
      unlocked,
      `redeem_pilot_code defined WITHOUT a row lock (reopens the double-redemption TOCTOU — single-use is not atomic):\n  ${unlocked.join("\n  ")}`
    ).toEqual([]);
  });
});
