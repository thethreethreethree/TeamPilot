import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * getRepWinningLines feeds the live-cue "delivery" grounding — it injects the
 * rep's OWN proven closing lines into the cue prompt (§A8). It's load-bearing for
 * that delivery feature, was UNTESTED, and its errors are swallowed by the caller
 * (`getRepWinningLines(...).catch(() => [])` in liveCue.ts) — so a regression in
 * its 3-query composition would silently stop grounding cues in the rep's lines
 * with no crash and no log. These tests pin the composition + the two early-return
 * guards. The ranking/dedup itself lives in selectWinningLines (tested separately
 * in winningLines.test.ts); here we assert the queries thread correctly and the
 * rep-confirmed-first ordering survives end-to-end.
 *
 * Uses the SYNC createServiceRoleClient (createAdminClient) → mockReturnValue.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { getRepWinningLines } from "../salesCoach";

type Call = [string, unknown[]];
const queried = (calls: Call[], table: string) =>
  calls.some(([m, a]) => m === "from" && a[0] === table);
const eqIssued = (calls: Call[], col: string, val: unknown) =>
  calls.some(([m, a]) => m === "eq" && a[0] === col && a[1] === val);

describe("getRepWinningLines (DB-mock)", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("threads sold sessions → followed cues → texts, rep-confirmed ranked first", async () => {
    const coaching_sessions = { data: [{ id: "s1" }, { id: "s2" }] };
    // Deliberately out of rank order: the inferred cue appears first in the rows.
    const coaching_cue_outcomes = {
      data: [
        { cue_id: "c2", created_at: "2026-07-02T00:00:00Z", source: "inferred", determination: "followed" },
        { cue_id: "c1", created_at: "2026-07-01T00:00:00Z", source: "rep_marked", determination: "followed" },
      ],
    };
    const coaching_cues = {
      data: [
        { id: "c1", text: "Happy to walk you through the pricing." },
        { id: "c2", text: "What would make this a yes today?" },
      ],
    };
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { coaching_sessions, coaching_cue_outcomes, coaching_cues },
        calls
      ) as never
    );

    const lines = await getRepWinningLines({ companyId: "co1", agentId: "a1", limit: 5 });

    // rep_marked (c1) must rank above inferred (c2) regardless of row order.
    expect(lines).toEqual([
      "Happy to walk you through the pricing.",
      "What would make this a yes today?",
    ]);
    // Scoping: this rep's SOLD sessions. (The 'followed' filter is now applied in
    // code after collapsing to each cue's LATEST outcome — see the A5 test below —
    // so it is deliberately NO LONGER a query-level .eq(determination).)
    expect(eqIssued(calls, "agent_id", "a1")).toBe(true);
    expect(eqIssued(calls, "outcome", "sold")).toBe(true);
  });

  it("A5: a cue whose LATEST outcome is not 'followed' is excluded (no stale resurface)", async () => {
    // c1 was followed (older) then CORRECTED to not_followed (newer). c2 is followed.
    // Only c2 should surface — the superseded c1 must not resurface as a winning line.
    const coaching_sessions = { data: [{ id: "s1" }] };
    const coaching_cue_outcomes = {
      data: [
        { cue_id: "c1", created_at: "2026-07-03T00:00:00Z", source: "inferred", determination: "not_followed" },
        { cue_id: "c1", created_at: "2026-07-01T00:00:00Z", source: "inferred", determination: "followed" },
        { cue_id: "c2", created_at: "2026-07-02T00:00:00Z", source: "inferred", determination: "followed" },
      ],
    };
    const coaching_cues = {
      data: [
        { id: "c1", text: "Superseded line the rep no longer used." },
        { id: "c2", text: "The line that actually worked." },
      ],
    };
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { coaching_sessions, coaching_cue_outcomes, coaching_cues },
        calls
      ) as never
    );
    const lines = await getRepWinningLines({ companyId: "co1", agentId: "a1", limit: 5 });
    expect(lines).toEqual(["The line that actually worked."]);
  });

  it("A5: a later rep_marked 'followed' overrides an earlier inferred 'not_followed'", async () => {
    // The rep explicitly tapped it as followed — authoritative over any inferred.
    const coaching_sessions = { data: [{ id: "s1" }] };
    const coaching_cue_outcomes = {
      data: [
        { cue_id: "c1", created_at: "2026-07-03T00:00:00Z", source: "inferred", determination: "not_followed" },
        { cue_id: "c1", created_at: "2026-07-01T00:00:00Z", source: "rep_marked", determination: "followed" },
      ],
    };
    const coaching_cues = { data: [{ id: "c1", text: "Rep-confirmed winner." }] };
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { coaching_sessions, coaching_cue_outcomes, coaching_cues },
        calls
      ) as never
    );
    const lines = await getRepWinningLines({ companyId: "co1", agentId: "a1", limit: 5 });
    expect(lines).toEqual(["Rep-confirmed winner."]);
  });

  it("returns [] and skips downstream queries when the rep has no sold sessions", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ coaching_sessions: { data: [] } }, calls) as never
    );
    expect(await getRepWinningLines({ companyId: "co1", agentId: "a1" })).toEqual([]);
    // Early return before the cue-outcomes query.
    expect(queried(calls, "coaching_cue_outcomes")).toBe(false);
  });

  it("returns [] and skips the text query when there are no followed cues", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        {
          coaching_sessions: { data: [{ id: "s1" }] },
          coaching_cue_outcomes: { data: [] },
        },
        calls
      ) as never
    );
    expect(await getRepWinningLines({ companyId: "co1", agentId: "a1" })).toEqual([]);
    // Early return before the cue-texts query.
    expect(queried(calls, "coaching_cues")).toBe(false);
  });
});
