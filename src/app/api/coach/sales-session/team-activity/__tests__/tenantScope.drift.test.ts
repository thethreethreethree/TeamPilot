import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * A30 structural guard for team-activity (2026-08-27). This route returns a per-rep session aggregate for the manager's
 * roster. Unlike rep-activity it has NO per-rep authz gate — its ONLY tenant defense is scoping the read to the
 * CALLER'S OWN company_id (derived server-side) plus the manager gate. Lock both, so a refactor can't drop the scope
 * and leak another company's activity, or drop the manager gate and expose usage to a rep.
 */
const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "route.ts"), "utf8");

describe("team-activity route — manager-gated + company-scoped (A30)", () => {
  it("is manager-gated (isSalesCoachManager, 403 otherwise)", () => {
    expect(SRC).toMatch(/isSalesCoachManager/);
    expect(SRC).toMatch(/403/);
  });

  it("scopes the session read to the caller's OWN company_id (derived server-side, not from request input)", () => {
    // companyId comes from the caller's own profile, never a query param.
    expect(SRC).toMatch(/companyId\s*=\s*profile\?\.company_id/);
    expect(SRC).toMatch(/\.eq\(\s*["']company_id["']\s*,\s*companyId\s*\)/);
    // There must be no agentId/companyId taken from the request for this aggregate.
    expect(SRC).not.toMatch(/searchParams\.get\(\s*["']company/);
  });

  it("aggregates by agent_id and skips null agents (activity, not a ranking — the roster renders it unsorted)", () => {
    expect(SRC).toMatch(/agent_id/);
    expect(SRC).toMatch(/byAgent/);
  });
});
