import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The AI cost ledger writer (RSS Phase 0 step 6). Pins: a metered call becomes one ai_usage row with its
 * attribution; a call with no reported usage writes NOTHING (zeros would record it as free); before 0272 the
 * missing table is reported once, not per call; and nothing here can throw into the AI call.
 */
const state = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  error: null as { code?: string; message: string } | null,
  throwOnCreate: false,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (state.throwOnCreate) throw new Error("no service role key");
    return {
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          if (!state.error) state.inserts.push(row);
          return { error: state.error };
        },
      }),
    };
  },
}));

import { recordAiUsage, recordSttUsage, _resetUsageLedgerWarnings } from "../usageLedger";

const result = (usage?: { promptTokens?: number; completionTokens?: number }) => ({
  text: "ok",
  model: "deepseek-v4-flash",
  provider: "deepseek",
  latencyMs: 10,
  ...(usage ? { usage } : {}),
});

beforeEach(() => {
  state.inserts = [];
  state.error = null;
  state.throwOnCreate = false;
  _resetUsageLedgerWarnings();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("recordAiUsage", () => {
  it("writes one row with the provider that answered and the caller's attribution", async () => {
    await recordAiUsage(result({ promptTokens: 1200, completionTokens: 340 }) as never, {
      engine: "pitch_score",
      companyId: "co1",
      sessionId: "s1",
    });
    expect(state.inserts).toEqual([
      {
        company_id: "co1",
        session_id: "s1",
        engine: "pitch_score",
        provider: "deepseek",
        model: "deepseek-v4-flash",
        input_tokens: 1200,
        output_tokens: 340,
      },
    ]);
  });

  it("an unattributed call is still recorded, labelled as such", async () => {
    await recordAiUsage(result({ promptTokens: 5, completionTokens: 1 }) as never);
    expect(state.inserts[0]).toMatchObject({ engine: "unattributed", company_id: null, session_id: null });
  });

  it("no reported usage writes nothing — never a free-looking zero row", async () => {
    await recordAiUsage(result() as never, { engine: "pitch_score" });
    expect(state.inserts).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("a missing table is reported once per process, not once per call", async () => {
    state.error = { code: "PGRST205", message: "relation does not exist" };
    await recordAiUsage(result({ promptTokens: 1, completionTokens: 1 }) as never);
    await recordAiUsage(result({ promptTokens: 1, completionTokens: 1 }) as never);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("never throws into the AI call", async () => {
    state.throwOnCreate = true;
    await expect(recordAiUsage(result({ promptTokens: 1, completionTokens: 1 }) as never)).resolves.toBeUndefined();
  });
});

describe("recordSttUsage (speech-to-text audio seconds)", () => {
  it("one row with the measured audio length and the caller's attribution, no tokens", async () => {
    await recordSttUsage({ provider: "elevenlabs", model: "scribe_v1", audioSeconds: 312.46, attribution: { engine: "stt_batch", companyId: "co1", sessionId: "s1" } });
    expect(state.inserts).toEqual([
      { company_id: "co1", session_id: "s1", engine: "stt_batch", provider: "elevenlabs", model: "scribe_v1", input_tokens: 0, output_tokens: 0, audio_seconds: 312.5 },
    ]);
  });
  it("no measured length → no row (never recorded as free), and it never throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await recordSttUsage({ provider: "elevenlabs", model: "scribe_v1", audioSeconds: 0, attribution: { engine: "stt_batch" } });
    expect(state.inserts).toEqual([]);
    expect(warn).toHaveBeenCalled();
    state.throwOnCreate = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordSttUsage({ provider: "elevenlabs", model: "scribe_v1", audioSeconds: 5, attribution: { engine: "stt_batch" } })).resolves.toBeUndefined();
  });
});
