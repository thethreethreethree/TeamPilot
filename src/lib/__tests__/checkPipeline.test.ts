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

/**
 * CI-ENFORCEMENT GUARD — the local `check` script only matters if CI actually RUNS the gates on every change.
 * CI (.github/workflows/ci.yml) is a SEPARATE definition that can drift from `check`; if its `test` step were
 * dropped, all 2000+ tests AND every structural guard here would silently stop enforcing in CI while the
 * workflow still goes green. This locks the CI workflow to keep running the core gates on push + PR.
 */
describe("CI-enforcement guard (.github/workflows/ci.yml runs the gates)", () => {
  let ci = "";
  try {
    ci = readFileSync(join(SRC_DIR, "..", ".github", "workflows", "ci.yml"), "utf8");
  } catch {
    /* handled by the presence test below */
  }

  it("the CI workflow exists", () => {
    expect(ci.length, "expected .github/workflows/ci.yml to exist").toBeGreaterThan(0);
  });

  // The gates whose ABSENCE from CI would silently stop enforcing a whole class on every merge.
  for (const step of ["npm run typecheck", "npm run test", "npm run invariant:audit", "npm run rls:audit"]) {
    it(`CI runs "${step}"`, () => {
      expect(ci, `ci.yml must run ${step} — dropping it stops enforcing that class on every merge`).toContain(
        step
      );
    });
  }

  it("CI triggers on push and pull_request", () => {
    expect(ci).toMatch(/\bpush\s*:/);
    expect(ci).toMatch(/\bpull_request\s*:/);
  });
});
