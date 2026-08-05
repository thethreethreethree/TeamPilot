import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSalesIntel — the floor behaviour changed by the no-minimum-length build (MIN_SEGMENTS 3 → 1).
 * salesIntel.test.ts covers parseIntel / groundCompetitors; this covers the length gate. Intel is the
 * conversation-intelligence extraction (competitors + topics); the build lowered its floor so a short call
 * still yields its intel. This locks: a short call (below the old floor of 3) reaches the LLM; only a
 * 0-segment transcript short-circuits before it; suppressed / error → empty {competitors:[], topics:[]}.
 */
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));
vi.mock("@/lib/coach/v5/salesIntelPrompt", () => ({
  buildSalesIntelSystemPrompt: () => "SYS",
  buildSalesIntelUserMessage: () => "USER",
}));

import { dissectCoachV5 } from "@/lib/claude";
import { generateSalesIntel } from "../salesIntel";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: `line ${i}`, seq: i });
const gen = (segments: ReturnType<typeof seg>[]) =>
  generateSalesIntel({ companyId: "co1", segments } as Parameters<typeof generateSalesIntel>[0]);

beforeEach(() => vi.clearAllMocks());

describe("generateSalesIntel — no minimum length (floor = genuine-empty only)", () => {
  it("ZERO segments → empty, WITHOUT calling the LLM", async () => {
    const out = await gen([]);
    expect(out).toEqual({ competitors: [], topics: [] });
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("a SHORT call (1 segment, below the old floor of 3) → the LLM IS called", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "{}" });
    await gen([seg("agent", 0)]);
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
  });

  it("a suppressed response → empty", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: true, text: "" });
    expect(await gen([seg("agent", 0), seg("customer", 1)])).toEqual({ competitors: [], topics: [] });
  });

  it("never throws — an LLM error degrades to empty", async () => {
    asMock(dissectCoachV5).mockRejectedValue(new Error("provider down"));
    expect(await gen([seg("agent", 0), seg("customer", 1)])).toEqual({ competitors: [], topics: [] });
  });
});
