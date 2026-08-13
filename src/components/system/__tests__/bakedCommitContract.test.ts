import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * DRIFT GUARD — the BAKED-commit contract the forced auto-update depends on (founder 2026-08-13: "auto update is
 * a must"). The watcher compares two commits:
 *   - BAKED: `next.config.ts` injects `NEXT_PUBLIC_BUILD_COMMIT` (from `VERCEL_GIT_COMMIT_SHA`) into the bundle at
 *     build time; VersionWatcher reads it as `BAKED`.
 *   - LIVE:  `/api/health` returns `build.commit` (guarded separately in api/health/__tests__).
 * If a config refactor renames/drops the bake, `BAKED` becomes "" → `shouldForceReload` returns false for every
 * client → the WHOLE auto-update silently stops (agents go stale again, with no error). This locks the producer
 * side of the baked half so that failure mode can't ship unnoticed.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", ".."); // __tests__ → system → components → src → root
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

describe("baked-commit contract (next.config bake ↔ VersionWatcher read)", () => {
  it("next.config bakes NEXT_PUBLIC_BUILD_COMMIT from VERCEL_GIT_COMMIT_SHA", () => {
    const cfg = read("next.config.ts");
    // The exact field name AND its source must both hold — a rename of either breaks the watcher's BAKED value.
    expect(cfg, "next.config.ts must map NEXT_PUBLIC_BUILD_COMMIT ← VERCEL_GIT_COMMIT_SHA").toMatch(
      /NEXT_PUBLIC_BUILD_COMMIT\s*:\s*process\.env\.VERCEL_GIT_COMMIT_SHA/,
    );
  });

  it("VersionWatcher reads NEXT_PUBLIC_BUILD_COMMIT as its baked commit", () => {
    const vw = read("src/components/system/VersionWatcher.tsx");
    expect(vw, "VersionWatcher must read process.env.NEXT_PUBLIC_BUILD_COMMIT for BAKED").toMatch(
      /process\.env\.NEXT_PUBLIC_BUILD_COMMIT/,
    );
  });
});
