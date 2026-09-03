import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * bankSessionPoints: reads the session's existing after-pitch scores and banks ONE session_score ledger row.
 * Mocks the admin client with a per-table map. Proves: banks on a scored session, idempotent on the unique
 * violation (already_banked), and honest empties (no_after_pitch / not_scoreable) that bank NOTHING.
 */
const state = vi.hoisted(() => ({
  afterPitch: null as unknown, // the maybeSingle() result for after_pitch_summaries
  insertError: null as { code?: string } | null,
  inserted: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "after_pitch_summaries") {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.order = () => chain;
        chain.limit = () => chain;
        chain.maybeSingle = async () => ({ data: state.afterPitch, error: null });
        return chain;
      }
      if (table === "agent_point_ledger") {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (state.insertError) return { error: state.insertError };
            state.inserted.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const { bankSessionPoints } = await import("../bankPoints");

const scored = (dims: Array<[string, number]>) => ({
  company_id: "co1",
  agent_id: "ag1",
  payload: { scores: dims.map(([key, score]) => ({ key, label: key, score, display: "", rationale: "", citation: null, computed: false })) },
});

beforeEach(() => {
  state.afterPitch = null;
  state.insertError = null;
  state.inserted = [];
});

describe("bankSessionPoints", () => {
  it("banks a session_score row from the existing after-pitch scores", async () => {
    state.afterPitch = scored([["opener", 8], ["objection", 8], ["tone", 8], ["close", 8], ["next_step", 8]]);
    const r = await bankSessionPoints("s1");
    expect(r.banked).toBe(true);
    if (r.banked) {
      expect(r.points).toBe(80);
      expect(r.band).toBe("strong");
      expect(r.strong).toBe(true); // 80 crosses the manager-alert line
    }
    expect(state.inserted).toHaveLength(1);
    const row = state.inserted[0]!;
    expect(row.reason).toBe("session_score");
    expect(row.session_id).toBe("s1");
    expect((row.detail as { band: string }).band).toBe("strong");
  });

  it("a sub-threshold session banks but is not 'strong'", async () => {
    state.afterPitch = scored([["opener", 6], ["close", 6]]);
    const r = await bankSessionPoints("s2");
    expect(r.banked).toBe(true);
    if (r.banked) expect(r.strong).toBe(false); // 60 < 80
  });

  it("is idempotent — a unique violation returns already_banked, no second row", async () => {
    state.afterPitch = scored([["opener", 7], ["close", 7]]);
    state.insertError = { code: "23505" }; // agent_point_ledger_session_score_uniq
    const r = await bankSessionPoints("s3");
    expect(r).toEqual({ banked: false, reason: "already_banked" });
  });

  it("no after-pitch summary → banks nothing, honest reason", async () => {
    state.afterPitch = null;
    const r = await bankSessionPoints("s4");
    expect(r).toEqual({ banked: false, reason: "no_after_pitch" });
    expect(state.inserted).toHaveLength(0);
  });

  it("a summary with no scored dimension → not_scoreable, banks nothing (no fabricated 0)", async () => {
    state.afterPitch = { company_id: "co1", agent_id: "ag1", payload: { scores: [] } };
    const r = await bankSessionPoints("s5");
    expect(r).toEqual({ banked: false, reason: "not_scoreable" });
    expect(state.inserted).toHaveLength(0);
  });

  it("a real (non-23505) insert error propagates — never silently swallowed", async () => {
    state.afterPitch = scored([["opener", 7]]);
    state.insertError = { code: "42501" }; // e.g. permission error
    await expect(bankSessionPoints("s6")).rejects.toBeTruthy();
  });
});
