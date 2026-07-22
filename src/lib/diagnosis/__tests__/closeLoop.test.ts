import { describe, it, expect, vi, beforeEach } from "vitest";
import { closeProblemLoop } from "../closeLoop";
import type { CandidateResolution } from "../types";

/**
 * closeProblemLoop wraps the SQL close_problem() RPC (the real loop-integrity is enforced in SQL — atomic). The
 * JS wrapper's job is small but worth pinning: it must admit honestly when Supabase isn't live (§3.4 — no
 * silent success in demo mode), pass a real RPC error through, and return the resolution id on success.
 */

const state = vi.hoisted(() => ({ enabled: true, rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  get supabaseEnabled() {
    return state.enabled;
  },
  createClient: () => ({ rpc: state.rpc }),
}));

const chosen: CandidateResolution = {
  action: "name an owner at handoff",
  reasoning: "unowned work stalls",
  expectedOutcome: "fewer slips",
  predictedRipples: [],
};

beforeEach(() => {
  state.enabled = true;
  state.rpc.mockReset();
});

describe("closeProblemLoop", () => {
  it("admits it can't run in demo mode (no live Supabase) — §3.4, no silent success", async () => {
    state.enabled = false;
    const r = await closeProblemLoop({ problemId: "p1", chosen });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/demo mode/i);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("returns the resolution id on success", async () => {
    state.rpc.mockResolvedValue({ data: "res-123", error: null });
    const r = await closeProblemLoop({ problemId: "p1", chosen });
    expect(r).toEqual({ ok: true, resolutionId: "res-123" });
    // passes the chosen action/reasoning/outcome into the atomic RPC
    expect(state.rpc).toHaveBeenCalledWith("close_problem", {
      p_problem_id: "p1",
      p_action_taken: chosen.action,
      p_reasoning: chosen.reasoning,
      p_expected_outcome: chosen.expectedOutcome,
    });
  });

  it("passes a real RPC error through (fails loudly, not silently)", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "row-level security denied" } });
    const r = await closeProblemLoop({ problemId: "p1", chosen });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("row-level security denied");
  });
});
