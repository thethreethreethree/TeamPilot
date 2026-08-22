import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit H3 (2026-08-22): the pitch derived-table writes must THROW on a Supabase error instead of swallowing it.
 * A swallowed `writePitchAnalysis` error let a pitch reach `complete` with no analysis row — rendered as
 * "Still processing…" forever (error dressed as no-data). These lock the honesty at the data layer.
 */

const state = vi.hoisted(() => ({ result: { error: null } as { error: { message: string } | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: async () => state.result,
      update: () => ({ eq: async () => state.result }),
    }),
  }),
}));

import { writePitchTranscript, writePitchAnalysis, setPitchStatus } from "../doorlog";

beforeEach(() => {
  state.result = { error: null };
});

const TR = { pitchId: "p1", companyId: "co1", repId: "r1", text: "hi", wordCount: 1 };
const AN = {
  pitchId: "p1", companyId: "co1", repId: "r1",
  summary: "s", strengths: [], improvements: [], scores: {}, model: "brain", promptVersion: "v1",
};

describe("doorlog writes — H3 error honesty (never swallow into a false success)", () => {
  it("writePitchTranscript throws when the upsert errors", async () => {
    state.result = { error: { message: "conn reset" } };
    await expect(writePitchTranscript(TR)).rejects.toThrow(/writePitchTranscript failed: conn reset/);
  });

  it("writePitchAnalysis throws when the upsert errors (so 'complete' is never reached without analysis)", async () => {
    state.result = { error: { message: "deadlock" } };
    await expect(writePitchAnalysis(AN)).rejects.toThrow(/writePitchAnalysis failed: deadlock/);
  });

  it("setPitchStatus throws when the update errors", async () => {
    state.result = { error: { message: "timeout" } };
    await expect(setPitchStatus({ pitchId: "p1", status: "complete" })).rejects.toThrow(/setPitchStatus failed: timeout/);
  });

  it("all three RESOLVE (no throw) on success", async () => {
    await expect(writePitchTranscript(TR)).resolves.toBeUndefined();
    await expect(writePitchAnalysis(AN)).resolves.toBeUndefined();
    await expect(setPitchStatus({ pitchId: "p1", status: "analyzing" })).resolves.toBeUndefined();
  });
});
