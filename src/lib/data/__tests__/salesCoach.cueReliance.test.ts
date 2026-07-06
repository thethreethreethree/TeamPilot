import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * getCueRelianceSeries is the §3.5 "training wheels come off" signal: cue count
 * per ended/reviewed session, oldest -> newest, so the consuming surface can
 * show whether a rep needs FEWER live cues over time. This pins the N+1 shape
 * (one count query per session), the chronological series, and the empty case.
 * The mock returns a SEQUENCE for coaching_cues so each session gets its own
 * count.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCueRelianceSeries } from "../salesCoach";

describe("getCueRelianceSeries (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("builds a chronological per-session cue-count series (a downward trend)", async () => {
    const sessions = {
      data: [
        { id: "s1", started_at: "2026-07-01T00:00:00Z" },
        { id: "s2", started_at: "2026-07-02T00:00:00Z" },
        { id: "s3", started_at: "2026-07-03T00:00:00Z" },
      ],
    };
    // One count query per session, in order: 4 -> 2 -> 0 (reliance dropping).
    const counts = [{ count: 4 }, { count: 2 }, { count: 0 }];
    let i = 0;

    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { coaching_sessions: sessions, coaching_cues: () => counts[i++] },
        calls
      ) as never
    );

    const series = await getCueRelianceSeries("agent-1", 30);

    // Scoped to the agent + only ended/reviewed sessions.
    expect(calls.some(([m, a]) => m === "eq" && a[0] === "agent_id" && a[1] === "agent-1")).toBe(true);

    expect(series).toEqual([
      { sessionId: "s1", startedAt: "2026-07-01T00:00:00Z", cueCount: 4 },
      { sessionId: "s2", startedAt: "2026-07-02T00:00:00Z", cueCount: 2 },
      { sessionId: "s3", startedAt: "2026-07-03T00:00:00Z", cueCount: 0 },
    ]);
  });

  it("returns [] when the rep has no ended/reviewed sessions", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ coaching_sessions: { data: [] } }, calls) as never
    );
    expect(await getCueRelianceSeries("agent-1")).toEqual([]);
  });
});
