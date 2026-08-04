import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectMatches, SRC_DIR } from "./_sourceScan";

/**
 * ENV-DOC COMPLETENESS GUARD — every env var the code reads that a DEPLOYER must set has to be documented in
 * .env.example (a commented `# VAR=...` example counts). Without this, adding a `process.env.NEW_VAR` ships an
 * undocumented required var and a new deployer silently misses it — the deployment-config class the 2026-08-02
 * SEO localhost bug sat right next to (an unset NEXT_PUBLIC_SITE_URL). Converts that one-off check into a guard.
 *
 * The allowlist is vars a deployer NEVER sets — auto-injected by Vercel/Node/CI/npm, or test-only flags — so
 * they legitimately don't belong in .env.example.
 */
const NOT_DEPLOYER_SET = new Set([
  "NODE_ENV",
  "NEXT_PHASE", // auto-injected by Next.js ('phase-production-build' during `next build`); env.ts reads it to skip runtime-secret validation at build time
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_GIT_COMMIT_SHA",
  "NEXT_PUBLIC_BUILD_COMMIT", // derived from VERCEL_GIT_COMMIT_SHA at build time
  "EXECOS_ALLOW_SEED", // seed-script test flag
  "EXECOS_INTEGRATION_TEST", // integration-test flag
  "CI",
]);

const envExample = () => readFileSync(join(SRC_DIR, "..", ".env.example"), "utf8");

describe("env-doc completeness guard", () => {
  it("every deployer-set env var the code reads is documented in .env.example (commented example is fine)", () => {
    const used = [...collectMatches(/process\.env\.([A-Z_][A-Z0-9_]+)/g)].filter(
      (v) => !NOT_DEPLOYER_SET.has(v) && !v.startsWith("npm_")
    );
    const doc = envExample();
    const undocumented = used.filter((v) => !new RegExp(`\\b${v}\\b`).test(doc));
    expect(
      undocumented,
      `Undocumented env var(s) — add to .env.example (a commented "# VAR=..." line counts): ${undocumented.join(", ")}`
    ).toEqual([]);
  });

  it("detection self-test: the match logic flags a var that is NOT in .env.example", () => {
    // Proves the guard actually detects a missing var (not a regex that always passes) — the F-word for guards.
    expect(new RegExp(`\\bZZ_NOT_IN_ENV_EXAMPLE_XYZ\\b`).test(envExample())).toBe(false);
    // And confirms a known-documented var IS matched (the positive side).
    expect(/\bDEEPSEEK_MODEL\b/.test(envExample())).toBe(true);
  });
});
