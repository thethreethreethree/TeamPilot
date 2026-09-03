import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateAndStoreMeetingDissect: on signal, appends a `meeting.dissect_generated` event with the consequence
 * payload; on a with-turns no-signal run, appends a `meeting.dissect_attempted` backoff marker; on empty
 * segments, nothing runs and nothing is stored. The store is best-effort (a throw doesn't break the return).
 */
const state = vi.hoisted(() => ({ dissectText: "", suppressed: false, inserts: [] as Array<Record<string, unknown>> }));

vi.mock("@/lib/claude", () => ({
  dissectCoachV5: vi.fn(async () => ({ text: state.dissectText, suppressed: state.suppressed, model: "m", provider: "p" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: async (row: Record<string, unknown>) => { state.inserts.push(row); return { error: null }; } }),
  }),
}));

import { dissectCoachV5 } from "@/lib/claude";
import { DEEPSEEK_NONREASONING_MODEL } from "@/lib/llm/deepseek";
const { generateAndStoreMeetingDissect } = await import("../generateMeetingDissect");

let s = 0;
const seg = (speaker: string, text: string) => ({ speaker, text, seq: s++ });

beforeEach(() => {
  state.dissectText = "";
  state.suppressed = false;
  state.inserts = [];
});

describe("generateAndStoreMeetingDissect", () => {
  it("DRIFT-GUARD: runs the meeting dissect on the NON-REASONING model (DISS-R1, A30)", async () => {
    // A long meeting transcript makes the DeepSeek REASONING model spend its whole completion budget on reasoning
    // and emit ZERO answer (measured 2026-09-03: 8000 reasoning tokens, 0 answer → the "transient" empty →
    // "review didn't generate"). The extraction MUST run on the non-reasoning model. This gate fails if a refactor
    // drops the model override and silently re-starves every long meeting.
    state.dissectText = JSON.stringify({ decisions: [{ decision: "x", context: "" }], actions: [], openItems: [] });
    await generateAndStoreMeetingDissect({ companyId: "co1", actorId: "u1", sessionId: "sX", segments: [seg("Al", "hi")] });
    expect(dissectCoachV5).toHaveBeenCalledWith(expect.objectContaining({ model: DEEPSEEK_NONREASONING_MODEL }));
  });

  it("stores a meeting.dissect_generated event with the consequence payload on signal", async () => {
    state.dissectText = JSON.stringify({
      decisions: [{ decision: "Ship Friday", context: "" }],
      actions: [{ action: "Notes", owner: "Dana" }],
      openItems: [],
      effectiveness: { focused: true, note: "on agenda" },
      overall: "decided the date",
    });
    const d = await generateAndStoreMeetingDissect({
      companyId: "co1", actorId: "u1", sessionId: "s1", segments: [seg("Al", "hi"), seg("Bo", "ok")],
    });
    expect(d.hasSignal).toBe(true);
    expect(state.inserts).toHaveLength(1);
    const row = state.inserts[0]!;
    expect(row.kind).toBe("meeting.dissect_generated");
    expect(row.subject).toBe("meeting_session:s1");
    expect(row.company_id).toBe("co1");
    const payload = row.payload as Record<string, unknown>;
    expect((payload.decisions as unknown[]).length).toBe(1);
    expect(payload.coach_version).toBe("meeting-dissect-v1");
    // Balance is computed from the diarized segments (2 speakers here) and stored on the payload.
    const balance = payload.balance as Record<string, unknown>;
    expect(balance).toBeTruthy();
    expect(balance.speakers).toBe(2);
    expect(balance.balanced).toBe(true); // 1 word each → 50/50
  });

  it("stores a meeting.dissect_attempted backoff marker when there are turns but no signal", async () => {
    state.dissectText = JSON.stringify({ decisions: [], actions: [], openItems: [] }); // no signal
    const d = await generateAndStoreMeetingDissect({
      companyId: "co1", actorId: "u1", sessionId: "s2", segments: [seg("Al", "hi")],
    });
    expect(d.hasSignal).toBe(false);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.kind).toBe("meeting.dissect_attempted");
    expect((state.inserts[0]!.payload as Record<string, unknown>).reason).toBe("no_signal");
  });

  it("stores an ATTEMPTED backoff marker even with no segments (silent transcription → genuine empty)", async () => {
    const d = await generateAndStoreMeetingDissect({ companyId: "co1", actorId: "u1", sessionId: "s3", segments: [] });
    expect(d.hasSignal).toBe(false);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.kind).toBe("meeting.dissect_attempted");
  });

  it("writes NO marker on a TRANSIENT empty-LLM-text run (audit H4) — the next view retries, not a permanent empty", async () => {
    state.dissectText = ""; // token-starvation: empty text → transient, NOT a thin meeting
    const d = await generateAndStoreMeetingDissect({
      companyId: "co1", actorId: "u1", sessionId: "s6", segments: [seg("Al", "we decided to ship")],
    });
    expect(d.hasSignal).toBe(false);
    expect(d.outcome).toBe("transient");
    expect(state.inserts).toHaveLength(0); // NO backoff marker — the real content is still recoverable on retry
  });

  it("writes NO marker when the dissect LLM throws (audit H4 — transient, retryable)", async () => {
    vi.mocked(dissectCoachV5).mockRejectedValueOnce(new Error("network blip"));
    const d = await generateAndStoreMeetingDissect({
      companyId: "co1", actorId: "u1", sessionId: "s7", segments: [seg("Al", "hi"), seg("Bo", "ok")],
    });
    expect(d.outcome).toBe("transient");
    expect(state.inserts).toHaveLength(0);
  });

  it("writes NO marker when the LLM response is UNPARSEABLE (audit H4 — transient, not a thin meeting)", async () => {
    state.dissectText = "sorry, I can't"; // non-JSON → parse failure → transient
    const d = await generateAndStoreMeetingDissect({
      companyId: "co1", actorId: "u1", sessionId: "s8", segments: [seg("Al", "we agreed on the budget")],
    });
    expect(d.outcome).toBe("transient");
    expect(state.inserts).toHaveLength(0);
  });

  it("measures Prep-up agenda coverage into the stored payload (Phase 4, founder 2026-08-22)", async () => {
    // The dissect LLM judged the goal partial and topic t1 covered (over the full transcript).
    state.dissectText = JSON.stringify({
      decisions: [{ decision: "Ship Friday", context: "" }],
      actions: [], openItems: [],
      agenda: { goalAttained: "partial", note: "date set, budget deferred", covered: ["t1"] },
    });
    const d = await generateAndStoreMeetingDissect({
      companyId: "co1", actorId: "u1", sessionId: "s4",
      segments: [seg("Al", "hi"), seg("Bo", "ok")],
      agenda: {
        goal: "Lock launch date + budget",
        docContext: "",
        topics: [
          { id: "t1", text: "launch date", covered: false },
          { id: "t2", text: "budget", covered: false },
        ],
      },
    });
    expect(d.hasSignal).toBe(true);
    const payload = state.inserts[0]!.payload as Record<string, unknown>;
    const ag = payload.agenda as { goal: string; goalAttained: string; topics: { text: string; covered: boolean }[] };
    expect(ag.goal).toBe("Lock launch date + budget");
    expect(ag.goalAttained).toBe("partial");
    expect(ag.topics.find((t) => t.text === "launch date")?.covered).toBe(true);
    expect(ag.topics.find((t) => t.text === "budget")?.covered).toBe(false); // missed → surfaced
  });

  it("no agenda in the payload for a prep-less meeting (no regression)", async () => {
    state.dissectText = JSON.stringify({ decisions: [{ decision: "x", context: "" }], actions: [], openItems: [] });
    await generateAndStoreMeetingDissect({ companyId: "co1", actorId: "u1", sessionId: "s5", segments: [seg("Al", "hi")] });
    expect((state.inserts[0]!.payload as Record<string, unknown>).agenda).toBeNull();
  });
});
