import { describe, it, expect, vi } from "vitest";

/**
 * D5 scoring floor (founder 2026-11-22: 100 rep words, Gong's floor). Under it a call is refused BEFORE the model runs —
 * no cost, no score, no points — with its own reason, so the rep reads "too short", not "no rep speech".
 */
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));

import { dissectCoachV5 } from "@/lib/claude";
import { generatePitchScore, repWordCount } from "../generatePitchScore";
import { scoringDecision } from "@/lib/coach/remote/session/state";

const seg = (speaker: "agent" | "customer", text: string, seq: number) => ({ id: `s${seq}`, sessionId: "x", speaker, text, seq, spokenAt: null, createdAt: "2026-11-22T00:00:00Z" }) as never;
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("D5 scoring floor", () => {
  it("counts the rep's words across lines", () => {
    expect(repWordCount([{ text: "one two  three" }, { text: "" }, { text: "four" }])).toBe(4);
  });

  it("refuses a call under 100 rep words without calling the model", async () => {
    const r = await generatePitchScore({ companyId: "c1", segments: [seg("agent", words(99), 0), seg("customer", words(300), 1)] });
    expect(r).toEqual({ ok: false, failure: "too_little_rep_speech" });
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("lets a call with 100 rep words through to grading", async () => {
    (dissectCoachV5 as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ text: "", suppressed: false });
    await generatePitchScore({ companyId: "c1", segments: [seg("agent", words(60), 0), seg("agent", words(40), 1)] });
    expect(dissectCoachV5).toHaveBeenCalled();
  });

  it("the Remote Sales session rule agrees", () => {
    expect(scoringDecision(3, true, 99)).toEqual({ score: false, reason: "BELOW_SCORING_FLOOR" });
    expect(scoringDecision(3, true, 100)).toEqual({ score: true });
  });
});
