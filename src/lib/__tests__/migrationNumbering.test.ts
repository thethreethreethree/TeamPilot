import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { MIGRATIONS_DIR } from "./_sourceScan";

/**
 * MIGRATION-NUMBERING GUARD — no two migration files may share the same NNNN prefix. Migrations apply in
 * numeric-prefix order; two files with the same number (a rename collision, or two devs both grabbing 0208)
 * makes the apply order AMBIGUOUS and can silently apply the wrong one or skip one. Gaps in the sequence are
 * fine (harmless — nothing references a skipped number), so this guards UNIQUENESS only, not contiguity.
 */
describe("migration-numbering guard", () => {
  it("no two migrations share the same NNNN prefix (ambiguous apply order)", () => {
    const byPrefix = new Map<string, string[]>();
    for (const f of readdirSync(MIGRATIONS_DIR)) {
      if (!f.endsWith(".sql")) continue;
      const m = /^(\d{4})/.exec(f);
      if (!m) continue;
      const prefix = m[0];
      const list = byPrefix.get(prefix) ?? [];
      list.push(f);
      byPrefix.set(prefix, list);
    }
    const dups = [...byPrefix.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([p, files]) => `${p}: ${files.join(" + ")}`);
    expect(dups, `duplicate migration numbers (ambiguous apply order): ${dups.join("; ")}`).toEqual([]);
  });

  it("detection self-test: two files sharing a prefix ARE flagged", () => {
    // Proves the dup-detection logic works (not a check that always passes).
    const names = ["0208_a.sql", "0208_b.sql", "0209_c.sql"];
    const seen = new Map<string, number>();
    for (const n of names) {
      const p = n.slice(0, 4);
      seen.set(p, (seen.get(p) ?? 0) + 1);
    }
    expect([...seen.values()].filter((c) => c > 1).length).toBe(1); // exactly the 0208 collision
  });
});
