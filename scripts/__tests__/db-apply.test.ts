import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs script, no type declarations; we test its pure exports.
import { sortByVersion, baselineSet, pendingFiles } from "../db-apply.mjs";

/**
 * These pin the correctness core of the migration apply tool: version ordering and set selection MUST be
 * numeric, never string. The tool shipped 2026-07-20 with a string `<=` / plain `.sort()` that was correct
 * only because every migration is zero-padded to 4 digits; the first 5-digit version would have baselined
 * the wrong set and applied migrations out of order — silently. The digit-width-boundary cases below are
 * the regression guard for that fix (gate the lesson so it cannot return).
 */
const f = (version: string, name = `${version}_x.sql`) => ({ version, name, path: `/m/${name}` });

describe("sortByVersion", () => {
  it("orders numerically within a single digit width", () => {
    expect(sortByVersion([f("0010"), f("0002"), f("0001")]).map((x) => x.version)).toEqual([
      "0001",
      "0002",
      "0010",
    ]);
  });

  it("orders correctly ACROSS a digit-width boundary (the bug a string sort would get wrong)", () => {
    // String sort would put "10000" before "9999" ("1" < "9"). Numeric must not.
    const out = sortByVersion([f("10000"), f("9999"), f("0999"), f("0187")]).map((x) => x.version);
    expect(out).toEqual(["0187", "0999", "9999", "10000"]);
  });

  it("does not mutate its input", () => {
    const input = [f("0003"), f("0001")];
    sortByVersion(input);
    expect(input.map((x) => x.version)).toEqual(["0003", "0001"]);
  });
});

describe("baselineSet", () => {
  it("selects every migration at or below the head, numerically", () => {
    const files = [f("0001"), f("0172"), f("0173"), f("0187")];
    expect(baselineSet(files, "0172").map((x) => x.version)).toEqual(["0001", "0172"]);
  });

  it("does NOT over-select across a digit-width boundary", () => {
    // With string compare, "10000" <= "0999" is true — it would be wrongly baselined. Numeric must exclude it.
    const files = [f("0999"), f("9999"), f("10000")];
    expect(baselineSet(files, "0999").map((x) => x.version)).toEqual(["0999"]);
  });

  it("is inclusive of the head itself", () => {
    expect(baselineSet([f("0187")], "0187").map((x) => x.version)).toEqual(["0187"]);
  });
});

describe("pendingFiles", () => {
  it("returns files not in the applied set, in numeric order", () => {
    const files = [f("0187"), f("0173"), f("0172"), f("0001")];
    const applied = new Set(["0001", "0172"]);
    expect(pendingFiles(files, applied).map((x) => x.version)).toEqual(["0173", "0187"]);
  });

  it("returns empty when everything is applied", () => {
    const files = [f("0001"), f("0002")];
    expect(pendingFiles(files, new Set(["0001", "0002"]))).toEqual([]);
  });

  it("uses exact version membership — a numerically-equal but differently-written key does not match", () => {
    // The ledger stores the exact 4-digit string; membership must be exact, not numeric coercion.
    const files = [f("0007")];
    expect(pendingFiles(files, new Set(["7"])).map((x) => x.version)).toEqual(["0007"]);
  });
});
