import { describe, it, expect, vi } from "vitest";

/**
 * analyzePitch passes on the model that wrote the analysis (2026-10-03). Before, the name was dropped here and
 * the worker stored the literal "brain", so none of the 100 production analyses can be traced to a model.
 */
vi.mock("@/lib/brain", () => ({
  runBrainCall: vi.fn(async () => ({
    suppressed: false,
    model: "deepseek-v4-flash",
    provider: "deepseek",
    text: JSON.stringify({
      summary: "They opened well and asked for the sale.",
      strengths: ["clear opener"],
      improvements: ["ask one more question"],
      scores: { objection: 60, talk_listen: 70, questions: 50, tone: 80, close: 65 },
    }),
  })),
}));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));

import { analyzePitch } from "../analyze";

describe("analyzePitch", () => {
  it("returns the analysis with the model that wrote it", async () => {
    const a = await analyzePitch({ companyId: "co1", transcript: "hi", outcome: "sold", durationMs: 5000 });
    expect(a?.model).toBe("deepseek-v4-flash");
    expect(a?.summary).toMatch(/opened well/);
  });
});
