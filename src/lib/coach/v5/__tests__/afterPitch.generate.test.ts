import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateAfterPitchSummary — the ASSEMBLER seam. The per-engine floors are guarded in
 * salesReview/Score/Dissect.generate; this guards the INTEGRATION point the founder's bug actually
 * surfaced through: the composite `hasSignal` (narrative || moments || scores || cueLoop) that decides
 * whether the After-Pitch page shows content or the "No conversation was captured" empty state, plus the
 * one true short-circuit (0 segments). "Breaks in the seams" (AMD-006 L3) — the engines can each be right
 * and the assembly still gate the page wrong, so the seam needs its own test.
 *
 * The three content engines are mocked (their own floors are unit-tested elsewhere); this exercises the
 * REAL assembly + composite-hasSignal logic. The cue-loop data layer is mocked empty so cueLoop is [].
 */
vi.mock("@/lib/data/salesCoach", () => ({
  getSessionTranscriptAdmin: vi.fn(),
  getSessionCuesAdmin: vi.fn(async () => []),
  getSessionCueOutcomesAdmin: vi.fn(async () => []),
  appendCueOutcome: vi.fn(async () => {}),
}));
vi.mock("@/lib/coach/v5/salesReview", () => ({ generateSalesReview: vi.fn() }));
vi.mock("@/lib/coach/v5/salesMoments", () => ({ generateSalesMoments: vi.fn() }));
vi.mock("@/lib/coach/v5/salesScore", () => ({ generateSalesScores: vi.fn() }));

import { getSessionTranscriptAdmin } from "@/lib/data/salesCoach";
import { generateSalesReview } from "@/lib/coach/v5/salesReview";
import { generateSalesMoments } from "@/lib/coach/v5/salesMoments";
import { generateSalesScores } from "@/lib/coach/v5/salesScore";
import { generateAfterPitchSummary } from "../afterPitch";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: "hi", seq: i });

const run = () =>
  generateAfterPitchSummary({ companyId: "co1", sessionId: "sess1" } as Parameters<typeof generateAfterPitchSummary>[0]);

// Default: engines return content (the fixed short-call path). Individual tests override.
function setEngines(opts: {
  narrative?: unknown;
  moments?: unknown;
  scores?: unknown;
}) {
  asMock(generateSalesReview).mockResolvedValue(
    opts.narrative ?? {
      hasSignal: true,
      strengths: [{ point: "clear opener", example: "you led with the offer" }],
      growthAreas: [{ opportunity: "ask more", nextStep: "open with a question" }],
      closing: "nice",
    }
  );
  asMock(generateSalesMoments).mockResolvedValue(
    opts.moments ?? { hasSignal: true, moments: [{ atSeq: 0, kind: "opener", label: "Open", note: "n", sentiment: "neutral", isBreakdown: false, correction: null }] }
  );
  asMock(generateSalesScores).mockResolvedValue(
    opts.scores ?? { hasSignal: true, categories: [{ key: "talk_ratio", label: "Talk / Listen", score: 5, display: "50 / 50", rationale: "balanced", citation: null, computed: true }] }
  );
}

beforeEach(() => vi.clearAllMocks());

describe("generateAfterPitchSummary — the assembler seam", () => {
  it("ZERO segments → EMPTY, WITHOUT calling any engine (the one true short-circuit)", async () => {
    asMock(getSessionTranscriptAdmin).mockResolvedValue([]);
    setEngines({});
    const out = await run();
    expect(out.hasSignal).toBe(false);
    expect(out.scores).toEqual([]);
    expect(generateSalesReview).not.toHaveBeenCalled();
    expect(generateSalesScores).not.toHaveBeenCalled();
  });

  it("a SHORT call whose engines return content → hasSignal:true, narrative/moments/scores assembled", async () => {
    asMock(getSessionTranscriptAdmin).mockResolvedValue([seg("agent", 0), seg("customer", 1)]);
    setEngines({});
    const out = await run();
    expect(out.hasSignal).toBe(true);
    expect(out.narrative.hasSignal).toBe(true);
    expect(out.moments).toHaveLength(1);
    expect(out.scores).toHaveLength(1);
    // The composite ran the engines on the real (short) transcript.
    expect(generateSalesScores).toHaveBeenCalledTimes(1);
  });

  it("composite hasSignal is a LOGICAL OR — scores alone carry it even if the narrative is empty", async () => {
    asMock(getSessionTranscriptAdmin).mockResolvedValue([seg("agent", 0), seg("customer", 1)]);
    setEngines({
      narrative: { hasSignal: false, strengths: [], growthAreas: [] },
      moments: { hasSignal: false, moments: [] },
      // scores non-empty → the page must still render (the founder's "only the scores" case).
    });
    const out = await run();
    expect(out.hasSignal).toBe(true);
    expect(out.scores).toHaveLength(1);
  });

  it("genuine capture gap — EVERY engine empty → EMPTY (honest 'nothing to debrief')", async () => {
    asMock(getSessionTranscriptAdmin).mockResolvedValue([seg("customer", 0), seg("customer", 1)]);
    setEngines({
      narrative: { hasSignal: false, strengths: [], growthAreas: [] },
      moments: { hasSignal: false, moments: [] },
      scores: { hasSignal: false, categories: [] },
    });
    const out = await run();
    expect(out.hasSignal).toBe(false);
    expect(out.focus).toBeNull();
  });
});
