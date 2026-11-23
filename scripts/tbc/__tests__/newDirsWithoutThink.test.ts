import { describe, it, expect } from "vitest";
// @ts-expect-error — plain ESM helper, no types
import { newDirsWithoutThink, pickLatestBuildName } from "../lib.mjs";

/**
 * 2026-11-23: a new record dir whose think.md was never written ranked below every real build (no started_at), so
 * the gates validated the previous build and `npm run check` went green. tbc:freshness now fails a NEW dir (no git
 * history) with no think.md; old dirs without one (ten from 2026-09) stay exempt.
 */
describe("newDirsWithoutThink", () => {
  it("THE GAP — a dir with no think.md loses the selection to an older real build", () => {
    expect(pickLatestBuildName([{ name: "2026-11-23-security-alert", started: "2026-11-23T20:39:02Z" }, { name: "2026-11-23-topic-group-builder", started: "" }])).toBe("2026-11-23-security-alert");
  });
  it("fails only new dirs without a think.md", () => {
    const has = new Set(["new-ok", "old-ok"]);
    const old = new Set(["old-ok", "old-legacy"]);
    expect(newDirsWithoutThink(["new-ok", "new-missing", "old-ok", "old-legacy"], { hasThink: (n: string) => has.has(n), hasHistory: (n: string) => old.has(n) })).toEqual(["new-missing"]);
  });
});
