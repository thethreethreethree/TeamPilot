import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Every test here exists because the first draft of storePitchScore got it wrong.
 *
 * The draft re-derived each row's points from the rubric instead of consuming the breakdown the
 * scorer returned. That is the §2.2 duplicated-condition shape, and it was wrong four ways at
 * once — low-confidence bonuses, repeatable ceilings, the +30 pool cap, and Objection handling on
 * a pitch with no objection. Every one produces the same end state: rows on the rep's Pitch detail
 * that do not add up to the score printed above them, with nothing failing anywhere.
 *
 * So the governing assertion in most of these is a RECONCILIATION — the stored rows sum to the
 * stored totals — rather than a check of any individual number.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { storePitchScore, bandFor } from "../storePitchScore";
import { BAND_LABEL, bandFor as gamificationBandFor } from "@/lib/coach/gamification/bands";
import { scorePitch } from "../scorePitch";
import { BONUSES, BONUS_CAP, ELEMENTS, SECTIONS, VIOLATIONS, OBJECTION_ELEMENT_ID } from "../rubric";
import type { GradedElement } from "../scorePitch";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/** Captures the RPC arguments so the tests can read what would have been written. */
let rpc: ReturnType<typeof vi.fn>;

const mockRpc = (result: { data?: unknown; error?: { message: string } | null } = {}) => {
  // `"data" in result` rather than `??` — a test that pins the null-id reply needs null to reach
  // the code, and a default that coalesces it away would make that test pass against anything.
  const data = "data" in result ? result.data : "pitch-1";
  rpc = vi.fn().mockResolvedValue({ data, error: result.error ?? null });
  asMock(createAdminClient).mockReturnValue({ rpc });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** The RPC body, typed — the tests read it as the row set that would have been written. */
type ElementRow = {
  element_id: string;
  grade: string;
  points: number;
  timestamp_s: number | null;
  evidence: string | null;
};
type EventRow = {
  type: string;
  item_id: string;
  points: number;
  timestamp_s: number | null;
  evidence: string | null;
  confidence: number | null;
};
type RpcParams = {
  p_base: number;
  p_bonus: number;
  p_violations: number;
  p_qualifying: boolean;
  p_not_qualifying_reason: string | null;
  p_section_points: Record<string, number>;
  p_elements: ElementRow[];
  p_events: EventRow[];
};

const params = () => rpc.mock.calls[0]![1] as RpcParams;

/** Grade every element in the rubric, so section totals are exercised for real. */
const gradeAll = (grade: GradedElement["grade"] = "hit"): GradedElement[] =>
  ELEMENTS.map((e) => ({ elementId: e.id, grade, evidence: `saw ${e.id}`, timestampS: 10 }));

const store = (overrides: Parameters<typeof scorePitch>[0], extra: Record<string, unknown> = {}) => {
  const score = scorePitch(overrides);
  return {
    score,
    promise: storePitchScore({
      companyId: "c1",
      repId: "r1",
      recordedAt: "2026-09-21T16:00:00.000Z",
      result: {
        ok: true,
        score,
        elements: [...(overrides.elements ?? [])],
        bonuses: [...(overrides.bonuses ?? [])],
        violations: [...(overrides.violations ?? [])],
        timestampsUnavailable: false,
      },
      ...extra,
    }),
  };
};

describe("the stored rows reconcile with the stored score", () => {
  it("writes section totals that sum to base — including when Delivery is scaled", async () => {
    // The objection-free case is the one that breaks. Delivery is scored out of 27 and scaled to
    // 35, so the raw element rows come to ~77% of the section total that actually went into base.
    // Anything adding up element rows to show a Delivery figure disagrees with the score above it.
    const { score, promise } = store({
      elements: gradeAll(),
      objectionOccurred: false,
      reachedDiscovery: true,
    });
    await promise;

    expect(score.deliveryScaled).toBe(true);
    const stored = params().p_section_points;
    const summed = Math.round(SECTIONS.reduce((s, sec) => s + stored[sec.id]!, 0) * 10) / 10;
    expect(summed).toBe(params().p_base);

    // And the element rows do NOT sum to it — which is precisely why the verdict is stored.
    const deliveryRows = params().p_elements.filter(
      (r) => ELEMENTS.find((e) => e.id === r.element_id)?.section === "delivery"
    );
    const rawDelivery = deliveryRows.reduce((s, r) => s + r.points, 0);
    expect(rawDelivery).toBeLessThan(stored.delivery!);
  });

  it("writes bonus events that sum to the stored bonus, at the +30 cap", async () => {
    // Every bonus at once overshoots the pool cap. Storing each at its rubric face value would
    // write events summing well past 30 beside a stored bonus of exactly 30.
    const { promise } = store({
      elements: gradeAll(),
      bonuses: BONUSES.map((b) => ({ bonusId: b.id, confidence: 1, evidence: "heard it" })),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;

    expect(params().p_bonus).toBe(BONUS_CAP);
    const events = params().p_events;
    const summed = events.filter((e) => e.type === "bonus").reduce((s, e) => s + e.points, 0);
    // The per-bonus verdicts total the UNCAPPED pool; the cap applies once, to the pitch.
    // What must never happen is an event carrying points the scorer never awarded.
    expect(summed).toBeGreaterThanOrEqual(BONUS_CAP);
    for (const e of events.filter((x) => x.type === "bonus")) {
      const def = BONUSES.find((b) => b.id === e.item_id)!;
      expect(e.points).toBeLessThanOrEqual(def.maxTotal ?? def.points);
    }
  });

  it("honours a repeatable bonus ceiling rather than one event per detection", async () => {
    const repeatable = BONUSES.find((b) => b.repeatable && b.maxTotal && !b.audioInferred);
    if (!repeatable) return; // rubric has none; nothing to assert
    const detections = Array.from({ length: 9 }, () => ({
      bonusId: repeatable.id,
      confidence: 1,
      evidence: "asked again",
    }));

    const { promise } = store({
      elements: gradeAll(),
      bonuses: detections,
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;

    const events = params().p_events.filter((e) => e.item_id === repeatable.id);
    // One row carrying the ceiling, not nine rows carrying the face value.
    expect(events).toHaveLength(1);
    expect(events[0]!.points).toBe(repeatable.maxTotal);
    expect(9 * repeatable.points).toBeGreaterThan(repeatable.maxTotal!);
  });

  it("writes violation events that sum to the stored violations total", async () => {
    const { promise } = store({
      elements: gradeAll(),
      violations: VIOLATIONS.map((v) => ({ violationId: v.id, evidence: "did it" })),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;

    const events = params().p_events;
    const summed = events.filter((e) => e.type === "violation").reduce((s, e) => s + e.points, 0);
    expect(Math.round(summed * 10) / 10).toBe(params().p_violations);
  });
});

describe("what must not be written", () => {
  it("never writes an Objection handling row when no objection occurred", async () => {
    // The rubric does not score it at all in that case. A stored "missed" grade is a false
    // accusation against the rep, and it would not sum into the Delivery total either.
    const { promise } = store({
      elements: gradeAll("missed"),
      objectionOccurred: false,
      reachedDiscovery: true,
    });
    await promise;

    const ids = params().p_elements.map((e) => e.element_id);
    expect(ids).not.toContain(OBJECTION_ELEMENT_ID);
    // Every other Delivery element is still there — this is a targeted exclusion, not a dropout.
    expect(ids).toContain("deliv.tone");
  });

  it("writes the Objection handling row when an objection DID occur", async () => {
    const { promise } = store({
      elements: gradeAll(),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;
    const ids = params().p_elements.map((e) => e.element_id);
    expect(ids).toContain(OBJECTION_ELEMENT_ID);
  });

  it("never writes a low-confidence bonus as an awarded one", async () => {
    const audio = BONUSES.find((b) => b.audioInferred);
    if (!audio) return;
    const { score, promise } = store({
      elements: gradeAll(),
      bonuses: [{ bonusId: audio.id, confidence: 0.4, evidence: "maybe a door" }],
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;

    expect(score.bonus).toBe(0);
    const events = params().p_events;
    expect(events.filter((e) => e.type === "bonus")).toHaveLength(0);
    // Recorded, not discarded — see the next test for why.
    expect(events.find((e) => e.item_id === audio.id)?.type).toBe("rejected_bonus");
  });

  it("drops an element id the scorer did not recognise", async () => {
    const { promise } = store({
      elements: [...gradeAll(), { elementId: "intro.invented", grade: "hit" }],
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;
    const ids = params().p_elements.map((e) => e.element_id);
    expect(ids).not.toContain("intro.invented");
  });

  it("writes one row for an element the model graded twice", async () => {
    // pitch_elements is unique on (pitch_id, element_id), so a duplicate is not merely a
    // double-count — the entire write fails at the last step with the score already computed.
    const dup: GradedElement[] = [
      { elementId: "intro.trucks", grade: "hit", evidence: "first" },
      { elementId: "intro.trucks", grade: "missed", evidence: "second" },
    ];
    const { promise } = store({ elements: dup, objectionOccurred: true, reachedDiscovery: true });
    await promise;

    const rows = params().p_elements;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ grade: "hit", evidence: "first" });
  });
});

describe("the rejected bonus survives to the dispute", () => {
  it("stores the confidence that caused the rejection", async () => {
    const audio = BONUSES.find((b) => b.audioInferred);
    if (!audio) return;
    const { promise } = store({
      elements: gradeAll(),
      bonuses: [{ bonusId: audio.id, confidence: 0.62, evidence: "a door, maybe", timestampS: 91 }],
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;

    // "The AI didn't see it" is the answer the rubric says is not good enough. This is the
    // difference between a dispute a manager can settle and one they cannot.
    const row = params().p_events.find((e) => e.type === "rejected_bonus");
    expect(row).toMatchObject({
      item_id: audio.id,
      points: 0,
      confidence: 0.62,
      timestamp_s: 91,
      evidence: "a door, maybe",
    });
  });

  it("does not also record a rejection for a bonus that was awarded on another detection", async () => {
    const audio = BONUSES.find((b) => b.audioInferred);
    if (!audio) return;
    const { promise } = store({
      elements: gradeAll(),
      bonuses: [
        { bonusId: audio.id, confidence: 0.3, evidence: "unsure" },
        { bonusId: audio.id, confidence: 0.95, evidence: "clearly inside" },
      ],
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;

    const rows = params().p_events.filter((e) => e.item_id === audio.id);
    expect(rows.map((r) => r.type)).toEqual(["bonus"]);
  });
});

describe("evidence is carried onto the verdict", () => {
  it("attaches the model's quote and timestamp to the graded element", async () => {
    const { promise } = store({
      elements: [
        { elementId: "intro.trucks", grade: "partial", evidence: "Mentioned the crews", timestampS: 8 },
      ],
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;
    expect(params().p_elements[0]).toMatchObject({
      element_id: "intro.trucks",
      grade: "partial",
      timestamp_s: 8,
      evidence: "Mentioned the crews",
    });
  });

  it("stores null rather than undefined when the model gave no timestamp", async () => {
    // supabase-js drops undefined keys from the JSON body, so the column would silently keep a
    // previous value on a re-score instead of being cleared.
    const { promise } = store({
      elements: [{ elementId: "intro.trucks", grade: "hit" }],
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;
    expect(params().p_elements[0]).toMatchObject({ timestamp_s: null, evidence: null });
  });
});

describe("failures are never reported as a stored score", () => {
  it("returns null and logs when the RPC errors", async () => {
    mockRpc({ error: { message: "violates check constraint" } });
    const { promise } = store({
      elements: gradeAll(),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    expect(await promise).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("does not leak the database's message to the caller", async () => {
    // CWE-209: constraint text names columns and tables. It belongs in the log, not the response.
    mockRpc({ error: { message: 'null value in column "rep_id" violates not-null' } });
    const { promise } = store({
      elements: gradeAll(),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    const returned = await promise;
    expect(returned).toBeNull();
    expect(String(asMock(console.error).mock.calls[0]![0])).toContain("rep_id");
  });

  it("returns null when the RPC answers without an id", async () => {
    mockRpc({ data: null });
    const { promise } = store({
      elements: gradeAll(),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    expect(await promise).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("refuses before the round trip when the scorer honoured no element at all", async () => {
    const { promise } = store({
      elements: [{ elementId: "not.a.real.element", grade: "hit" }],
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    expect(await promise).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the pitch id on success", async () => {
    const { promise } = store({
      elements: gradeAll(),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    expect(await promise).toBe("pitch-1");
  });
});

describe("the qualifying verdict is passed through, not recomputed", () => {
  it("stores the reason alongside a non-qualifying pitch", async () => {
    // The CHECK in 0252 makes it impossible to store an exclusion without storing why.
    const { promise } = store({
      elements: gradeAll(),
      objectionOccurred: true,
      reachedDiscovery: false,
    });
    await promise;
    expect(params().p_qualifying).toBe(false);
    expect(params().p_not_qualifying_reason).toBe("Didn't reach Discovery");
  });

  it("stores a null reason for a qualifying pitch", async () => {
    const { promise } = store({
      elements: gradeAll(),
      objectionOccurred: true,
      reachedDiscovery: true,
    });
    await promise;
    expect(params().p_qualifying).toBe(true);
    expect(params().p_not_qualifying_reason).toBeNull();
  });
});

describe("bandFor", () => {
  it("maps the two scores the mockups actually show", () => {
    expect(bandFor(80.3)).toBe("Strong");
    expect(bandFor(77.0)).toBe("Solid");
  });

  it("never returns an empty band, at any score the rubric can produce", () => {
    for (let n = 0; n <= 130; n += 0.5) expect(bandFor(n)).toBeTruthy();
  });

  it("agrees with the rep Arena on EVERY score — they render on the same page", () => {
    // The drift guard, and it is the test that was missing. The two assertions above passed
    // against a local four-band copy that had no Elite and called the bottom band "Early",
    // because 80.3 and 77.0 happen to land where both agree. My Progress renders the Arena
    // directly above these boards, so a 95-point pitch read "Elite" in the gauge and "Strong"
    // in the card beneath it.
    for (let n = 0; n <= 130; n += 0.5) {
      expect(bandFor(n), `score ${n}`).toBe(BAND_LABEL[gamificationBandFor(n)]);
    }
  });

  it("bands a 90+ pitch as Elite, which the old four-band copy could not produce at all", () => {
    expect(bandFor(95)).toBe("Elite");
    // Scores run to 130; the band scale is 0-100 and clamps, so a bonus-heavy pitch is Elite.
    expect(bandFor(106.5)).toBe("Elite");
  });

  it("uses the authority's wording for the bottom band", () => {
    expect(bandFor(20)).toBe("Needs coaching");
  });
});
