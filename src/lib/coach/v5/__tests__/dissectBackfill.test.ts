import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * runDissectBackfill regenerates missing Sales-Coach dissects in a CAPPED, BOUNDED batch (§5 cost bound, §3.4
 * honest scan bound). The properties that matter: it only processes sessions with NO dissect event; it never
 * exceeds the cap (a backlog drains over runs); one failing/thin session doesn't sink the batch; and it reports
 * scanBounded honestly when the scan hit its limit. IO-heavy but the control flow is the point.
 */

type Session = { id: string; agent_id: string; company_id: string; client_label: string | null; context: string; status: string };
const state = vi.hoisted(() => ({
  sessions: [] as Session[],
  events: [] as Array<{ subject: string }>,
  dissect: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => {
  const q = (rows: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "in", "order", "limit", "eq"]) b[m] = () => b;
    b.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
    return b;
  };
  return {
    createAdminClient: () => ({ from: (t: string) => (t === "coaching_sessions" ? q(state.sessions) : q(state.events)) }),
  };
});
vi.mock("@/lib/data/salesCoach", () => ({ getSessionTranscriptAdmin: async () => [] }));
vi.mock("@/lib/coach/v5/salesDissect", () => ({ runAndStoreDissect: (...a: unknown[]) => state.dissect(...a) }));

const { runDissectBackfill } = await import("../dissectBackfill");

const session = (id: string): Session => ({
  id,
  agent_id: `a-${id}`,
  company_id: "c1",
  client_label: "Acme",
  context: "in_person",
  status: "ended",
});

beforeEach(() => {
  state.sessions = [];
  state.events = [];
  state.dissect.mockReset();
  state.dissect.mockResolvedValue({ hasSignal: true });
});

describe("runDissectBackfill", () => {
  it("returns an all-zero result when there are no sessions", async () => {
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r).toMatchObject({ missingTotal: 0, processed: 0, generated: 0, remaining: 0, scanBounded: false });
    expect(state.dissect).not.toHaveBeenCalled();
  });

  it("only processes sessions that have NO dissect event", async () => {
    state.sessions = [session("s1"), session("s2"), session("s3")];
    state.events = [{ subject: "sales_session:s2" }]; // s2 already dissected
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.missingTotal).toBe(2); // s1, s3
    expect(state.dissect).toHaveBeenCalledTimes(2);
  });

  it("never exceeds the cap; the rest is reported as remaining (drains over runs)", async () => {
    state.sessions = [session("s1"), session("s2"), session("s3"), session("s4"), session("s5")];
    const r = await runDissectBackfill({ companyId: "c1", cap: 2 });
    expect(r.processed).toBe(2);
    expect(r.remaining).toBe(3);
    expect(state.dissect).toHaveBeenCalledTimes(2);
  });

  it("splits generated vs thin/failed, and one failure doesn't sink the batch", async () => {
    state.sessions = [session("s1"), session("s2"), session("s3")];
    state.dissect
      .mockResolvedValueOnce({ hasSignal: true }) // generated
      .mockResolvedValueOnce({ hasSignal: false }) // thin
      .mockRejectedValueOnce(new Error("llm down")); // failed → caught → thin, batch continues
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.processed).toBe(3);
    expect(r.generated).toBe(1);
    expect(r.thinOrFailed).toBe(2);
  });

  it("reports scanBounded honestly when the scan hits its limit (§3.4)", async () => {
    // scoped scan limit is 300; returning that many means there may be older sessions beyond the window.
    state.sessions = Array.from({ length: 300 }, (_, i) => session(`s${i}`));
    const r = await runDissectBackfill({ companyId: "c1", cap: 1 });
    expect(r.scanBounded).toBe(true);
  });
});
