import { describe, it, expect } from "vitest";
import type { AgentGrowthSnapshot, TeamGrowthSnapshot } from "@/lib/data/care";

/**
 * Leader-view privacy contract on TeamGrowthSnapshot (the leader team-aggregate view), enforced
 * until now only by a code comment: "No field lives on this team view that isn't on the agent
 * self-view." The leader sees only team-aggregate, with NO individual breakdown, and every METRIC
 * the leader sees is one the agent already sees about themselves. So a new INDIVIDUAL-METRIC field
 * on the team view that isn't on the agent view could surface something the agent never sees — a
 * privacy regression against that guarantee.
 *
 * Precise contract (verified against the actual types 2026-08-02): the team view legitimately carries
 * three AGGREGATE-META fields the agent view doesn't — `companyId` (the aggregate's scope, vs the
 * agent's `agentId`), `agentCount` (how many agents were rolled up), and `bounded` (an honest
 * row-cap flag). None is individual-agent data, so they're excluded. EVERY OTHER (metric) field on
 * the team view must exist on the agent view.
 *
 * Guarded at COMPILE TIME: if a new non-meta field appears on TeamGrowthSnapshot that isn't on
 * AgentGrowthSnapshot, the conditional resolves to `never`, `_assert` can't be `true`, and `tsc`
 * (via `npm run check`) fails. If you add a legitimately-new aggregate-meta field, add it to
 * TeamAggregateMetaFields below WITH the reason it carries no individual data.
 */
type TeamAggregateMetaFields = "companyId" | "agentCount" | "bounded";
type TeamMetricKeys = Exclude<keyof TeamGrowthSnapshot, TeamAggregateMetaFields>;
type TeamMetricsSubsetOfAgent =
  TeamMetricKeys extends keyof AgentGrowthSnapshot ? true : never;
const _assert: TeamMetricsSubsetOfAgent = true;
void _assert;

describe("TeamGrowthSnapshot metric fields are a subset of AgentGrowthSnapshot", () => {
  it("compiles — the leader view introduces no INDIVIDUAL-METRIC field the agent self-view lacks", () => {
    // The real guard is the compile-time `extends` assertion above; meta fields are excluded by design.
    expect(true).toBe(true);
  });
});
