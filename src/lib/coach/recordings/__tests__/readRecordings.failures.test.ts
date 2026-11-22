import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { readPitchRecordings, readPitchRecordingDetail } from "../readRecordings";

/**
 * 2026-11-23: a failed sub-read is a failed read, never an empty one. Before this, a failed `patterns` or missed-elements
 * read showed every recording with 0 pattern moments, and a failed grades read rendered a recording with no misses — a
 * clean-looking pitch — with no error anywhere.
 */

type Answer = { data: unknown; error: { message: string } | null; count?: number | null };

/** Each table answers once per read with what the test configured; every chain method returns the chain. */
function fakeDb(answers: Record<string, Answer>) {
  const chainFor = (table: string) => {
    const answer = answers[table] ?? { data: [], error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "in", "eq", "is", "order", "limit"]) chain[m] = () => chain;
    chain.maybeSingle = async () => answer;
    chain.then = (res: (v: Answer) => unknown) => res(answer);
    return chain;
  };
  return { from: (t: string) => chainFor(t) } as never;
}

const PITCH = {
  id: "p1", rep_id: "rep-1", session_id: null, recorded_at: "2026-11-20T10:00:00Z", duration_s: 300, audio_url: null,
  transcript: "hello", outcome: null, base: 50, bonus: 0, violations: 0, total: 50, qualifying: true, not_qualifying_reason: null,
};
const boom = { data: null, error: { message: "boom" } };

describe("the recordings list", () => {
  it("lists normally when every read succeeds", async () => {
    const r = await readPitchRecordings({ repId: "rep-1" }, fakeDb({ pitch_scores_by_channel: { data: [PITCH], error: null, count: 1 } }));
    expect(r?.rows.map((x) => x.pitchId)).toEqual(["p1"]);
  });

  for (const table of ["patterns", "pitch_score_elements"]) {
    it(`answers null — not '0 pattern moments' — when ${table} fails to read`, async () => {
      const db = fakeDb({ pitch_scores_by_channel: { data: [PITCH], error: null, count: 1 }, [table]: boom });
      expect(await readPitchRecordings({ repId: "rep-1" }, db)).toBeNull();
    });
  }
});

describe("one recording", () => {
  for (const table of ["pitch_score_elements", "pitch_score_events", "recording_comments", "patterns"]) {
    it(`throws — not 'not found', not 'no misses' — when ${table} fails to read`, async () => {
      const db = fakeDb({ pitch_scores_by_channel: { data: PITCH, error: null }, [table]: boom });
      await expect(readPitchRecordingDetail({ pitchId: "p1" }, db)).rejects.toThrow(/recording detail read failed/);
    });
  }

  it("still answers null for a recording that is not there (or not yours)", async () => {
    const db = fakeDb({ pitch_scores_by_channel: { data: null, error: null } });
    expect(await readPitchRecordingDetail({ pitchId: "nope" }, db)).toBeNull();
  });
});
