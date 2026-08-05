import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSalesPivot — the floor behaviour changed by the no-minimum-length build (MIN_SEGMENTS 4 → 1).
 * salesPivot.test.ts covers parsePivot; this covers the OTHER half — the length gate. Pivot is a separate
 * surface (the session-summary turning point), NOT part of the after-pitch orchestrator, so afterPitch.generate
 * does not cover it. This locks: a short call (below the OLD floor of 4) is now pivoted (LLM called); only a
 * genuinely empty (0-segment) transcript short-circuits before the LLM; suppressed / error → EMPTY.
 */
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/coach/v5/salesPivotPrompt", () => ({
  buildSalesPivotSystemPrompt: () => "SYS",
  buildSalesPivotUserMessage: () => "USER",
}));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));

import { dissectCoachV5 } from "@/lib/claude";
import { generateSalesPivot } from "../salesPivot";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: `line ${i}`, seq: i });
const gen = (segments: ReturnType<typeof seg>[]) =>
  generateSalesPivot({ companyId: "co1", segments } as Parameters<typeof generateSalesPivot>[0]);

beforeEach(() => vi.clearAllMocks());

describe("generateSalesPivot — no minimum length (floor = genuine-empty only)", () => {
  it("ZERO segments → EMPTY, WITHOUT calling the LLM", async () => {
    const out = await gen([]);
    expect(out.hasSignal).toBe(false);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("a SHORT call (1 segment, below the old floor of 4) → the LLM IS called", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "{}" });
    await gen([seg("agent", 0)]);
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
  });

  it("a suppressed response → EMPTY", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: true, text: "" });
    expect((await gen([seg("agent", 0), seg("customer", 1)])).hasSignal).toBe(false);
  });

  it("never throws — an LLM error degrades to EMPTY", async () => {
    asMock(dissectCoachV5).mockRejectedValue(new Error("provider down"));
    expect((await gen([seg("agent", 0), seg("customer", 1)])).hasSignal).toBe(false);
  });
});
