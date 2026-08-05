import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSessionWhy — the floor behaviour changed by the no-minimum-length build (MIN_AGENT_SEGMENTS 3 → 1).
 * The Why is a separate retrospective surface (the rep's own hypothesis + the coach's grounded read), NOT
 * part of the after-pitch orchestrator, so nothing else covers its floor. This locks: a short call with a
 * rep turn is now read (LLM called); only a genuinely rep-silent transcript (0 agent turns) short-circuits
 * before the LLM; suppressed / error → EMPTY.
 */
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));

import { dissectCoachV5 } from "@/lib/claude";
import { generateSessionWhy } from "../salesWhy";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: `line ${i}`, seq: i });
const gen = (segments: ReturnType<typeof seg>[]) =>
  generateSessionWhy({
    companyId: "co1",
    outcome: "sold",
    repHypothesis: "I think the opener landed.",
    segments,
  } as Parameters<typeof generateSessionWhy>[0]);

beforeEach(() => vi.clearAllMocks());

describe("generateSessionWhy — no minimum length (floor = rep-silent only)", () => {
  it("ZERO agent turns (rep-silent) → EMPTY, WITHOUT calling the LLM", async () => {
    const out = await gen([seg("customer", 0), seg("customer", 1)]);
    expect(out.hasSignal).toBe(false);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("a SHORT call (1 agent turn, below the old floor of 3) → the LLM IS called", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "{}" });
    await gen([seg("agent", 0)]);
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
  });

  it("a suppressed response → EMPTY", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: true, text: "" });
    expect((await gen([seg("agent", 0), seg("agent", 1)])).hasSignal).toBe(false);
  });

  it("never throws — an LLM error degrades to EMPTY", async () => {
    asMock(dissectCoachV5).mockRejectedValue(new Error("provider down"));
    expect((await gen([seg("agent", 0), seg("agent", 1)])).hasSignal).toBe(false);
  });
});
