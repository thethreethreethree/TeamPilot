import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../../data/__tests__/_supabaseMock";

/**
 * DB-mock test for getAgentEloGames — the data-sourcing behind the Sales ELO
 * (the math is covered in salesElo.test.ts). This fetches via the ADMIN client
 * (RLS-bypassing), so the `.eq` query scoping is the ONLY thing keeping one
 * agent's games from mixing with another's — that scoping is asserted here. Also
 * locks the multi-source merge (dissect events + after-pitch scores + coaching
 * session outcome/timestamp → one game) and the latest-per-session dedup.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentEloGames } from "../salesElo";

describe("getAgentEloGames (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
    vi.clearAllMocks();
  });

  function mockTables(t: {
    events?: unknown[];
    after_pitch_summaries?: unknown[];
    coaching_sessions?: unknown[];
  }) {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        {
          events: { data: t.events ?? [] },
          after_pitch_summaries: { data: t.after_pitch_summaries ?? [] },
          coaching_sessions: { data: t.coaching_sessions ?? [] },
        },
        calls
      ) as never
    );
  }

  it("scopes to the agent (admin client bypasses RLS — the .eq is the only guard)", async () => {
    mockTables({});
    await getAgentEloGames("agent-9");
    expect(
      calls.some(([m, a]) => m === "eq" && a[0] === "actor" && a[1] === "agent-9")
    ).toBe(true);
    expect(
      calls.some(([m, a]) => m === "eq" && a[0] === "agent_id" && a[1] === "agent-9")
    ).toBe(true);
    expect(
      calls.some(([m, a]) => m === "eq" && a[0] === "kind" && a[1] === "coach.dissect_generated")
    ).toBe(true);
  });

  it("returns [] when there are no dissects or scores", async () => {
    mockTables({});
    expect(await getAgentEloGames("agent-9")).toEqual([]);
  });

  it("merges a dissect + after-pitch + session into one game with the right factors", async () => {
    mockTables({
      events: [
        {
          subject: "sales_session:S1",
          payload: { strengths: [1, 2, 3], growth_areas: [1] },
          created_at: "2026-07-05T10:00:00Z",
        },
      ],
      after_pitch_summaries: [
        {
          session_id: "S1",
          payload: { scores: [{ key: "discovery", score: 8 }] },
          created_at: "2026-07-05T10:05:00Z",
        },
      ],
      coaching_sessions: [
        {
          id: "S1",
          outcome: "sold",
          ended_at: "2026-07-05T10:20:00Z",
          started_at: "2026-07-05T10:00:00Z",
        },
      ],
    });
    const games = await getAgentEloGames("agent-9");
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      sessionId: "S1",
      // A4 fix (2026-07-09): started_at is the CONSISTENT chronological key across all
      // games (a mixed ended_at/started_at key could invert the path-dependent replay).
      at: "2026-07-05T10:00:00Z",
      factors: { strengths: 3, growthAreas: 1, outcome: "sold" },
    });
    expect(games[0]?.factors.scores).toHaveLength(1);
  });

  it("keeps only the latest dissect per session (query is desc → first wins)", async () => {
    mockTables({
      events: [
        {
          subject: "sales_session:S1",
          payload: { strengths: [1, 2], growth_areas: [] },
          created_at: "2026-07-06T00:00:00Z", // latest (desc order → first)
        },
        {
          subject: "sales_session:S1",
          payload: { strengths: [1, 2, 3, 4, 5], growth_areas: [1] },
          created_at: "2026-07-01T00:00:00Z", // older
        },
      ],
      coaching_sessions: [
        { id: "S1", outcome: null, ended_at: "2026-07-06T00:10:00Z", started_at: null },
      ],
    });
    const games = await getAgentEloGames("agent-9");
    expect(games).toHaveLength(1);
    expect(games[0]?.factors.strengths).toBe(2); // latest dissect, not the older count of 5
  });

  it("ignores events whose subject is not a sales_session", async () => {
    mockTables({
      events: [
        { subject: "something_else:X", payload: { strengths: [1] }, created_at: "2026-07-05T00:00:00Z" },
      ],
    });
    expect(await getAgentEloGames("agent-9")).toEqual([]);
  });
});
