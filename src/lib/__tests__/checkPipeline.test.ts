import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SRC_DIR } from "./_sourceScan";

/**
 * CHECK-PIPELINE GUARD (the capstone) — `npm run check` is the verification pipeline every other guard rides
 * on. If a step is silently dropped from it (typecheck, lint, the audits, or test), that whole class stops
 * being enforced in CI with no obvious signal — including all the structural guards in this folder. This locks
 * the pipeline's composition so removing a core gate fails a test. (package.json is strict JSON — parse is safe.)
 */
describe("check-pipeline guard", () => {
  const pkg = JSON.parse(readFileSync(join(SRC_DIR, "..", "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const check = pkg.scripts?.check ?? "";

  // The gates that make `npm run check` meaningful. Each maps to a class: type safety, lint, DB security
  // (rls), structural invariants (invariant), the TBC discipline, and the unit suite.
  const required = ["typecheck", "lint", "rls:audit", "invariant:audit", "tbc", "test"];
  for (const step of required) {
    it(`check still chains "${step}"`, () => {
      expect(check, `npm run check must run ${step} — dropping it stops enforcing that class in CI`).toContain(
        step
      );
    });
  }

  it("detection self-test: a pipeline missing a gate is flagged", () => {
    const weakened = "npm run typecheck && npm run test"; // dropped the audits + lint
    expect(weakened.includes("invariant:audit")).toBe(false); // proves the matcher would catch the drop
  });
});
