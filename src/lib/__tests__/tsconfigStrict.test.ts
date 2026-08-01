import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SRC_DIR } from "./_sourceScan";

/**
 * TSCONFIG-STRICTNESS GUARD — `strict` and `noUncheckedIndexedAccess` are the type-safety FLOOR the whole
 * `npm run check` (and this session's verification) rests on. Silently turning either off (e.g. to quiet a
 * batch of errors) would let a broad class of bugs — null/undefined derefs, out-of-bounds index access —
 * slip through every future check with no obvious signal. This locks them ON so weakening them fails a test.
 *
 * Text-match rather than JSON.parse: tsconfig.json is JSONC (comments + trailing commas), so a hand parse is
 * fragile; asserting the literal `"strict": true` declaration is present is robust and catches `false`/removal.
 */
describe("tsconfig strictness guard", () => {
  const raw = readFileSync(join(SRC_DIR, "..", "tsconfig.json"), "utf8");

  it("compilerOptions.strict is explicitly true", () => {
    expect(/"strict"\s*:\s*true/.test(raw), 'tsconfig must keep "strict": true').toBe(true);
    // And is NOT set to false anywhere (a defensive belt against `"strict": false`).
    expect(/"strict"\s*:\s*false/.test(raw)).toBe(false);
  });

  it("compilerOptions.noUncheckedIndexedAccess is explicitly true", () => {
    expect(
      /"noUncheckedIndexedAccess"\s*:\s*true/.test(raw),
      'tsconfig must keep "noUncheckedIndexedAccess": true'
    ).toBe(true);
    expect(/"noUncheckedIndexedAccess"\s*:\s*false/.test(raw)).toBe(false);
  });

  it("detection self-test: the matcher flags a false/absent setting", () => {
    expect(/"strict"\s*:\s*true/.test('{ "strict": false }')).toBe(false); // false → not matched → would fail
    expect(/"strict"\s*:\s*true/.test('{ "strict": true }')).toBe(true); // true → matched
  });
});
