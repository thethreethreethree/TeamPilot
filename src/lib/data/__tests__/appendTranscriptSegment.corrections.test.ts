import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 0354 (F8.9): a line is stored with the company's known mis-hearings replaced by their term, before number redaction;
 * a lookup that fails stores the line as heard — a vocabulary problem never loses a line.
 */
const st = vi.hoisted(() => ({ inserts: [] as Array<Record<string, unknown>>, corrections: [] as unknown[], fail: false }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      if (t === "coaching_transcript_segments")
        return { insert: (row: Record<string, unknown>) => (st.inserts.push(row), { select: () => ({ single: async () => ({ data: { id: "x", session_id: row.session_id, speaker: row.speaker, text: row.text, seq: row.seq }, error: null }) }) }) };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => {
        if (st.fail) throw new Error("network");
        return t === "coaching_sessions" ? { data: { company_id: "co1" }, error: null } : { data: { corrections: st.corrections }, error: null };
      };
      return q;
    },
  }),
}));

import { appendTranscriptSegment } from "../salesCoach";

beforeEach(() => {
  st.inserts = [];
  st.fail = false;
});

describe("appendTranscriptSegment — known mis-hearings (0354)", () => {
  it("stores the line with the company's term", async () => {
    st.corrections = [{ term: "Spectrum", heard: ["spec trum"] }];
    await appendTranscriptSegment({ sessionId: "s-a", speaker: "customer", text: "we're on spec trum now", seq: 1 });
    expect(st.inserts[0]!.text).toBe("we're on Spectrum now");
  });
  it("a failed lookup stores the line as heard", async () => {
    st.fail = true;
    await appendTranscriptSegment({ sessionId: "s-b", speaker: "customer", text: "we're on spec trum now", seq: 1 });
    expect(st.inserts[0]!.text).toBe("we're on spec trum now");
  });
});
