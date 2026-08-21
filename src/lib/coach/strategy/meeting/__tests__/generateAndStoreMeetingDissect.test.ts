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

const { generateAndStoreMeetingDissect } = await import("../generateMeetingDissect");

let s = 0;
const seg = (speaker: string, text: string) => ({ speaker, text, seq: s++ });

beforeEach(() => {
  state.dissectText = "";
  state.suppressed = false;
  state.inserts = [];
});

describe("generateAndStoreMeetingDissect", () => {
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

  it("stores an ATTEMPTED backoff marker even with no segments (silent/failed transcription — finding #1)", async () => {
    const d = await generateAndStoreMeetingDissect({ companyId: "co1", actorId: "u1", sessionId: "s3", segments: [] });
    expect(d.hasSignal).toBe(false);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.kind).toBe("meeting.dissect_attempted");
  });
});
