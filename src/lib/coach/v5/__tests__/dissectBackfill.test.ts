import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * runDissectBackfill regenerates missing Sales-Coach dissects in a CAPPED, BOUNDED batch (§5 cost bound, §3.4
 * honest scan bound). The properties that matter: it only processes sessions with NO dissect event AND not
 * recently ATTEMPTED (the backoff that stops a no-signal session re-running a full LLM call forever); it never
 * exceeds the cap (a backlog drains over runs); one failing/thin session doesn't sink the batch; and it reports
 * scanBounded honestly when the scan hit its limit. IO-heavy but the control flow is the point.
 */

type Session = { id: string; agent_id: string; company_id: string; client_label: string | null; context: string; status: string; outcome: string | null };
const state = vi.hoisted(() => ({
  sessions: [] as Session[],
  dissectEvents: [] as Array<{ subject: string }>, // coach.dissect_generated
  attemptEvents: [] as Array<{ subject: string }>, // coach.dissect_attempted (backoff)
  afterPitchExisting: [] as Array<{ session_id: string }>, // sessions that ALREADY have an after-pitch row
  emptySessionIds: new Set<string>(), // sessions with ZERO transcript segments (empty capture) — content-aware split
  dissect: vi.fn(), // stands in for the whole artifact generation; resolves { dissect: { hasSignal } }
  afterPitch: vi.fn(), // generateAndStoreAfterPitch spy — asserts the de-dup guard skips existing summaries
}));

vi.mock("@/lib/supabase/admin", () => {
  // A builder that records the `kind` filter so the two events queries (dissect_generated vs dissect_attempted)
  // resolve to different rows, and supports the `.gte(occurred_at)` the backoff query adds.
  const q = (table: string) => {
    const b: Record<string, unknown> = { _kind: null };
    for (const m of ["select", "in", "order", "limit", "gte", "range"]) b[m] = () => b;
    b.eq = (col: string, val: string) => {
      if (col === "kind") (b as { _kind: string | null })._kind = val;
      return b;
    };
    b.then = (resolve: (v: unknown) => void) => {
      let data: unknown;
      if (table === "coaching_sessions") data = state.sessions;
      // content-aware split: every session has a transcript segment EXCEPT those marked empty (0-segment capture).
      else if (table === "coaching_transcript_segments")
        data = state.sessions.filter((s) => !state.emptySessionIds.has(s.id)).map((s) => ({ session_id: s.id }));
      else if (table === "after_pitch_summaries") data = state.afterPitchExisting; // drives the de-dup guard
      else if ((b as { _kind: string | null })._kind === "coach.dissect_attempted") data = state.attemptEvents;
      else data = state.dissectEvents;
      resolve({ data, error: null });
    };
    return b;
  };
  return { createAdminClient: () => ({ from: (t: string) => q(t) }) };
});
vi.mock("@/lib/data/salesCoach", () => ({ getSessionTranscriptAdmin: async () => [] }));
// The backfill now regenerates the FULL artifact set; mock that generator. It returns the whole artifact
// bundle — the backfill only reads `.dissect.hasSignal` (still the "was it reviewed?" signal + marker key).
vi.mock("@/lib/coach/v5/generateSessionArtifacts", () => ({
  generateSessionArtifacts: async (...a: unknown[]) => ({ dissect: await state.dissect(...a) }),
}));
// After-Pitch recovery is best-effort (its generation is covered by its own test); here it's a spy so we can
// assert the backfill's de-dup guard SKIPS a session that already has a summary.
vi.mock("@/lib/coach/v5/generateAndStoreAfterPitch", () => ({
  generateAndStoreAfterPitch: (a: unknown) => state.afterPitch(a),
}));

const { runDissectBackfill } = await import("../dissectBackfill");

const session = (id: string): Session => ({
  id,
  agent_id: `a-${id}`,
  company_id: "c1",
  client_label: "Acme",
  context: "in_person",
  status: "ended",
  outcome: null,
});

beforeEach(() => {
  state.sessions = [];
  state.dissectEvents = [];
  state.attemptEvents = [];
  state.afterPitchExisting = [];
  state.emptySessionIds = new Set();
  state.dissect.mockReset();
  state.dissect.mockResolvedValue({ hasSignal: true });
  state.afterPitch.mockReset();
  state.afterPitch.mockResolvedValue({ generated: false });
});

describe("runDissectBackfill", () => {
  it("returns an all-zero result when there are no sessions", async () => {
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r).toMatchObject({ missingTotal: 0, processed: 0, generated: 0, remaining: 0, scanBounded: false });
    expect(state.dissect).not.toHaveBeenCalled();
  });

  it("only processes sessions that have NO dissect event", async () => {
    state.sessions = [session("s1"), session("s2"), session("s3")];
    state.dissectEvents = [{ subject: "sales_session:s2" }]; // s2 already dissected
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.missingTotal).toBe(2); // s1, s3
    expect(state.dissect).toHaveBeenCalledTimes(2);
  });

  it("SKIPS a session attempted (LLM ran, no signal) within the backoff window — no forever re-run", async () => {
    // The cost-loop fix: s2 ran the LLM and produced no signal, so it carries a coach.dissect_attempted marker.
    // It must NOT be re-run (a full ~20s LLM call) every pass — it's backed off until the window elapses.
    state.sessions = [session("s1"), session("s2"), session("s3")];
    state.attemptEvents = [{ subject: "sales_session:s2" }]; // s2 recently attempted → backoff
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.missingTotal).toBe(2); // s1, s3 only (s2 backed off)
    expect(state.dissect).toHaveBeenCalledTimes(2); // s2 NOT re-run → no wasted LLM call
  });

  it("a session that is BOTH dissected and attempted is simply excluded (no double-count)", async () => {
    state.sessions = [session("s1"), session("s2")];
    state.dissectEvents = [{ subject: "sales_session:s2" }];
    state.attemptEvents = [{ subject: "sales_session:s2" }];
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.missingTotal).toBe(1); // s1 only
  });

  it("EXCLUDES empty (0-segment) sessions from missing and reports them as noContent (founder 2026-08-25)", async () => {
    // The bug behind "Generate missing won't generate": ~80% of un-dissected sessions were EMPTY captures (no
    // transcript). They polluted the batch — every click reported 0 generated because the batch filled with empties
    // and the real transcripts stayed buried. Now an empty session is not "missing", it's noContent.
    state.sessions = [session("s1"), session("s2"), session("s3")];
    state.emptySessionIds = new Set(["s2"]); // s2 captured no audio → 0 segments
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.missingTotal).toBe(2); // s1, s3 (recoverable — have a transcript)
    expect(r.noContent).toBe(1); // s2 (empty capture, nothing to assess)
    expect(state.dissect).toHaveBeenCalledTimes(2); // only the two WITH content are processed — no wasted LLM on s2
  });

  it("a batch full of empty sessions generates 0 but reports them as noContent, not a frozen 'remaining'", async () => {
    // The exact founder symptom: click generates 0. Post-fix, remaining reflects RECOVERABLE sessions (0 here), and
    // the empties are surfaced honestly instead of looking like a stuck, un-generatable backlog.
    state.sessions = [session("s1"), session("s2"), session("s3")];
    state.emptySessionIds = new Set(["s1", "s2", "s3"]);
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.missingTotal).toBe(0);
    expect(r.remaining).toBe(0);
    expect(r.noContent).toBe(3);
    expect(state.dissect).not.toHaveBeenCalled(); // no LLM burned on empty captures
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

  it("recovers the After-Pitch for a session that has none, but SKIPS one that already has a summary (de-dup)", async () => {
    // The de-dup guard: after_pitch_summaries is insert-only/read-latest, so a backfill must NOT duplicate a
    // summary a rep already generated on-view. s1 has none → generate; s2 already has one → skip.
    state.sessions = [session("s1"), session("s2")];
    state.afterPitchExisting = [{ session_id: "s2" }];
    await runDissectBackfill({ companyId: "c1", cap: 6 });
    const calledSessions = state.afterPitch.mock.calls.map((c) => (c[0] as { sessionId: string }).sessionId);
    expect(calledSessions).toContain("s1"); // no existing summary → recovered
    expect(calledSessions).not.toContain("s2"); // already has one → NOT regenerated
  });

  it("a failing After-Pitch recovery never sinks the batch (best-effort — the 5 artifacts already landed)", async () => {
    state.sessions = [session("s1")];
    state.afterPitch.mockRejectedValueOnce(new Error("after-pitch llm down"));
    const r = await runDissectBackfill({ companyId: "c1", cap: 6 });
    expect(r.processed).toBe(1);
    expect(r.generated).toBe(1); // the dissect still counts — the after-pitch failure is swallowed
  });

  it("reports scanBounded honestly when the scan hits its limit (§3.4)", async () => {
    // scoped scan limit is 300; returning that many means there may be older sessions beyond the window.
    state.sessions = Array.from({ length: 300 }, (_, i) => session(`s${i}`));
    const r = await runDissectBackfill({ companyId: "c1", cap: 1 });
    expect(r.scanBounded).toBe(true);
  });
});
