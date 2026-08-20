import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Drift-guard (A31 / test-the-CONSUMER): the schedule round-trip is only real if the IMPORT PAGE actually
 * uses the deterministic explicit-time mapper. The library round-trip tests prove `autoTimeRangeCodeMap`
 * works; THIS asserts the page wires it into BOTH re-import entry points (paste-CSV `propose` and file
 * `extractGridFile`), so a re-imported export maps without depending on the LLM. Without this guard, a
 * refactor could drop the wiring and every automated check would still pass while real re-import silently
 * regressed to LLM-only mapping.
 */
const SRC = readFileSync("src/app/dashboard/schedule/import/page.tsx", "utf8");

describe("import page wires the deterministic time-range mapper (round-trip reachability)", () => {
  it("imports autoTimeRangeCodeMap", () => {
    expect(SRC).toMatch(/import\s*\{[^}]*autoTimeRangeCodeMap[^}]*\}\s*from\s*["']@\/lib\/schedule\/importTime["']/);
  });
  it("calls it in BOTH re-import paths (paste + upload)", () => {
    const calls = SRC.match(/autoTimeRangeCodeMap\s*\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
