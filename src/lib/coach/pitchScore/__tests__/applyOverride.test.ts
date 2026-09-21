import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Manager overrides.
 *
 * The recompute is pure and goes through scorePitch — the same function that produced the original
 * score — so these tests are mostly about what an override must NOT be allowed to change. Every
 * one of those is a way a manager could, without meaning to, make a corrected pitch the one pitch
 * in the system scored under different rules.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { applyOverride, recomputeWithOverride } from "../applyOverride";
import { BONUSES, ELEMENTS_BY_ID, BONUS_CAP } from "../rubric";
import { BAND_LABEL, bandFor as gamificationBandFor } from "@/lib/coach/gamification/bands";
import type { StoredPitch } from "../readPitchScore";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

let rpc: ReturnType<typeof vi.fn>;
const mockRpc = (result: { data?: unknown; error?: { message: string } } = {}) => {
  rpc = vi.fn().mockResolvedValue({
    data: "data" in result ? result.data : "ovr-1",
    error: result.error ?? null,
  });
  asMock(createAdminClient).mockReturnValue({ rpc });
};

const el = (elementId: string, grade: "hit" | "partial" | "missed") => {
  const def = ELEMENTS_BY_ID.get(elementId)!;
  return {
    elementId,
    label: def.label,
    section: def.section,
    grade,
    points: def.points * (grade === "hit" ? 1 : grade === "partial" ? 0.5 : 0),
    maxPoints: def.points,
    timestampS: null,
    evidence: null,
  };
};

/** A pitch that qualifies: Introduction + Discovery + Consulting all hit = 42 base. */
const basePitch = (over: Partial<StoredPitch> = {}): StoredPitch => ({
  id: "p1",
  repId: "rep1",
  sessionId: "s1",
  recordedAt: "2026-09-18T16:00:00Z",
  durationS: 400,
  audioUrl: null,
  outcome: "sold",
  base: 42,
  bonus: 0,
  violations: 0,
  total: 42,
  band: "Developing",
  qualifying: true,
  notQualifyingReason: null,
  deliveryScaled: false,
  rubricVersion: "attfiber-v1",
  sectionPoints: [],
  elements: [
    ...[...ELEMENTS_BY_ID.values()]
      .filter((d) => ["introduction", "discovery", "consulting"].includes(d.section))
      .map((d) => el(d.id, "hit")),
  ],
  events: [],
  overrides: [],
  disputes: [],
  ...over,
});

const REQ = {
  companyId: "c1",
  pitchId: "p1",
  actorId: "mgr1",
  itemType: "element" as const,
  itemId: "close.paperwork",
  newValue: "hit",
  reason: "Listened back — they did move straight to customer info at 8:44.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const params = () => rpc.mock.calls[0]![1] as Record<string, unknown>;

describe("the recompute goes through the scorer, not a second formula", () => {
  it("adds points for an element the scorer never graded", async () => {
    // The commonest real correction on a short pitch: the AI missed it entirely.
    const pitch = basePitch();
    const r = recomputeWithOverride(pitch, { itemType: "element", itemId: "close.paperwork", newValue: "hit" });
    expect(r.base).toBe(45); // 42 + 3
  });

  it("re-applies the +30 bonus cap rather than adding blindly", () => {
    // The fixture is DERIVED from the rubric rather than naming ids: a hand-picked list summed to
    // 28 on the first attempt, which would have made this test pass for the wrong reason. Take
    // bonuses until the raw total clears the cap, then add one more on top.
    const awarded: typeof BONUSES[number][] = [];
    let raw = 0;
    for (const b of BONUSES) {
      if (raw > BONUS_CAP) break;
      awarded.push(b);
      raw += b.points;
    }
    const spare = BONUSES.find((b) => !awarded.includes(b));
    expect(raw).toBeGreaterThan(BONUS_CAP); // the fixture actually exceeds the cap
    expect(spare).toBeTruthy(); // and there is one left to add

    const pitch = basePitch({
      events: awarded.map((b) => ({
        type: "bonus" as const, itemId: b.id, points: b.points,
        timestampS: null, evidence: null, confidence: null,
      })),
    });

    const before = recomputeWithOverride(pitch, { itemType: "element", itemId: "close.paperwork", newValue: "missed" });
    expect(before.bonus).toBe(BONUS_CAP); // already at the ceiling

    const after = recomputeWithOverride(pitch, { itemType: "bonus", itemId: spare!.id, newValue: "awarded" });
    expect(after.bonus).toBe(BONUS_CAP); // unchanged — a naive `bonus + points` would exceed it
  });

  it("removes a violation's deduction when a manager clears it", () => {
    const pitch = basePitch({
      events: [
        { type: "violation", itemId: "viol.talkingOver", points: 2, timestampS: null, evidence: null, confidence: null },
      ],
    });
    const before = recomputeWithOverride(pitch, { itemType: "element", itemId: "close.paperwork", newValue: "missed" });
    const after = recomputeWithOverride(pitch, { itemType: "violation", itemId: "viol.talkingOver", newValue: "removed" });
    expect(before.violations).toBe(2);
    expect(after.violations).toBe(0);
  });

  it("recomputes the qualifying verdict, because an override can cross the 40-base line", () => {
    // Concrete, not conditional. The fixture is exactly 42 base. disc.usage is worth 4, so
    // downgrading it to missed lands on 38 — below the line — and the pitch must STOP counting.
    const pitch = basePitch();
    const dropped = recomputeWithOverride(pitch, { itemType: "element", itemId: "disc.usage", newValue: "missed" });
    expect(dropped.base).toBe(38);
    expect(dropped.qualifying).toBe(false);
    expect(dropped.notQualifyingReason).toMatch(/under 40/i);

    // And back the other way: a pitch sitting under the line that gains an element starts counting.
    const low = basePitch({ elements: pitch.elements.filter((e) => e.elementId !== "disc.usage") });
    const raised = recomputeWithOverride(low, { itemType: "element", itemId: "disc.usage", newValue: "hit" });
    expect(raised.base).toBe(42);
    expect(raised.qualifying).toBe(true);
    expect(raised.notQualifyingReason).toBeNull();
  });
});

describe("what an override must NOT change", () => {
  it("cannot un-ring 'didn't reach Discovery'", () => {
    // Whether the pitch reached Discovery is a fact about the CONVERSATION. A manager who disputes
    // that is disputing the transcript, which is a re-score, not a correction.
    const pitch = basePitch({ qualifying: false, notQualifyingReason: "Didn't reach Discovery" });
    const r = recomputeWithOverride(pitch, { itemType: "element", itemId: "close.paperwork", newValue: "hit" });
    expect(r.qualifying).toBe(false);
    expect(r.notQualifyingReason).toBe("Didn't reach Discovery");
  });

  it("preserves the Delivery scaling verdict", () => {
    // deliveryScaled means the scorer judged that no objection occurred. Correcting one element
    // says nothing about that, and flipping it would rescale the whole section.
    const scaled = basePitch({ deliveryScaled: true, elements: [...basePitch().elements, el("deliv.tone", "hit")] });
    const r = recomputeWithOverride(scaled, { itemType: "element", itemId: "close.paperwork", newValue: "hit" });
    expect(r.deliveryScaled).toBe(true);
  });
});

describe("the log row says what actually changed", () => {
  it("reads the old value from the stored evidence, not from the caller", async () => {
    const pitch = basePitch({ elements: [...basePitch().elements, el("close.paperwork", "missed")] });
    await applyOverride(REQ, pitch);
    expect(params()).toMatchObject({ p_old_value: "missed", p_new_value: "hit" });
  });

  it("records a null old value when the element was never graded", async () => {
    await applyOverride(REQ, basePitch());
    expect(params().p_old_value).toBeNull();
  });

  it("distinguishes a previously-rejected bonus from one never seen", async () => {
    const pitch = basePitch({
      events: [
        { type: "rejected_bonus", itemId: "bonus.inside", points: 0, timestampS: null, evidence: null, confidence: 0.62 },
      ],
    });
    await applyOverride({ ...REQ, itemType: "bonus", itemId: "bonus.inside", newValue: "awarded" }, pitch);
    expect(params().p_old_value).toBe("removed");
  });

  it("sends the band from the shared authority, never a local copy", async () => {
    await applyOverride(REQ, basePitch());
    const total = params().p_total as number;
    expect(params().p_band).toBe(BAND_LABEL[gamificationBandFor(total)]);
  });
});

describe("refusals", () => {
  it("refuses an item id the rubric does not know, before writing", async () => {
    const r = await applyOverride({ ...REQ, itemId: "close.invented" }, basePitch());
    expect(r).toEqual({ ok: false, reason: "unknown_item" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a grade that is not a grade", async () => {
    const r = await applyOverride({ ...REQ, newValue: "excellent" }, basePitch());
    expect(r).toEqual({ ok: false, reason: "invalid_value" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses an element-style value on a bonus", async () => {
    const r = await applyOverride(
      { ...REQ, itemType: "bonus", itemId: "bonus.directv", newValue: "partial" },
      basePitch()
    );
    expect(r).toEqual({ ok: false, reason: "invalid_value" });
  });

  it("reports a failed write as a failure, never as a silent success", async () => {
    mockRpc({ error: { message: "violates check constraint" } });
    const r = await applyOverride(REQ, basePitch());
    expect(r).toEqual({ ok: false, reason: "write_failed" });
    expect(console.error).toHaveBeenCalled();
  });

  it("does not leak the database's message", async () => {
    mockRpc({ error: { message: 'null value in column "reason" violates not-null' } });
    const r = await applyOverride(REQ, basePitch());
    expect(JSON.stringify(r)).not.toMatch(/column|violates/i);
  });

  it("treats a non-id reply as a failure", async () => {
    mockRpc({ data: null });
    expect(await applyOverride(REQ, basePitch())).toEqual({ ok: false, reason: "write_failed" });
  });
});

describe("the reason travels with the change", () => {
  it("passes the manager's words through to the log", async () => {
    await applyOverride(REQ, basePitch());
    expect(params().p_reason).toContain("8:44");
  });
});
