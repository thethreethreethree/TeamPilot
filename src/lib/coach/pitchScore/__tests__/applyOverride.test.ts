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
import { REMOTE_RUBRIC, DOOR_RUBRIC } from "../rubricRegistry";
import { scorePitch } from "../scorePitch";
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

describe("a phone/video score is corrected under ITS rubric (2026-11-25)", () => {
  // Before: recompute and the known-item check used the door rubric, so correcting any item on a phone/video score
  // dropped the phone-only items ("Reason for the call", "Into enrollment, on the call") and their points, and a
  // phone-only item could not be corrected at all ("not in the current rubric").
  const remoteOnly = REMOTE_RUBRIC.elements.filter((e) => !DOOR_RUBRIC.elementsById.has(e.id)).map((e) => e.id);
  const graded = REMOTE_RUBRIC.elements.map((e) => ({ elementId: e.id, grade: "hit" as const }));
  const original = scorePitch({ elements: graded, objectionOccurred: true, reachedDiscovery: true, rubric: REMOTE_RUBRIC });
  const pitch = {
    rubricVersion: REMOTE_RUBRIC.version,
    elements: graded.map((g) => ({ elementId: g.elementId, grade: g.grade })),
    events: [],
    deliveryScaled: false,
    notQualifyingReason: null,
  } as unknown as StoredPitch;

  it("the remote rubric really has phone-only items (the case this guards)", () => {
    expect(remoteOnly.length).toBeGreaterThan(0);
    expect(original.base).toBe(100);
  });

  it("re-grading a shared item moves the score by that item alone; phone-only items keep their points", () => {
    const after = recomputeWithOverride(pitch, { itemType: "element", itemId: "disc.usage", newValue: "missed" });
    expect(after.rubricVersion).toBe(REMOTE_RUBRIC.version);
    expect(after.base).toBe(96); // 100 − the 4-point Internet usage
    for (const id of remoteOnly) expect(after.elementBreakdown.some((e) => e.elementId === id)).toBe(true);
  });

  it("a phone-only item can itself be corrected", async () => {
    mockRpc();
    const res = await applyOverride({ companyId: "c", pitchId: "p", actorId: "m", itemType: "element", itemId: "intro.reasonForCall", newValue: "partial", reason: "r" }, pitch);
    expect(res).toMatchObject({ ok: true, base: 98.5 });
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_new_points: 1.5, p_base: 98.5 });
  });
});

describe("N/A by a manager's correction (0331)", () => {
  const pitch = {
    rubricVersion: DOOR_RUBRIC.version,
    elements: DOOR_RUBRIC.elements.map((e) => ({ elementId: e.id, grade: e.id === "intro.trucks" ? ("missed" as const) : ("hit" as const) })),
    events: [],
    deliveryScaled: false,
    notQualifyingReason: null,
  } as unknown as StoredPitch;

  it("marking a missed item N/A gives its section back its full value, logged at 0 points", async () => {
    mockRpc();
    const res = await applyOverride({ companyId: "c", pitchId: "p", actorId: "m", itemType: "element", itemId: "intro.trucks", newValue: "na", reason: "No crews in this area" }, pitch);
    expect(res).toMatchObject({ ok: true, base: 100 });
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_new_value: "na", p_new_points: 0, p_base: 100 });
  });

  it("refuses N/A on the last applicable item of a section", async () => {
    mockRpc();
    const introIds = DOOR_RUBRIC.elements.filter((e) => e.section === "introduction").map((e) => e.id);
    const allButOne = { ...pitch, elements: pitch.elements.map((e) => (introIds.slice(1).includes(e.elementId) ? { ...e, grade: "na" } : e)) } as unknown as StoredPitch;
    const res = await applyOverride({ companyId: "c", pitchId: "p", actorId: "m", itemType: "element", itemId: introIds[0]!, newValue: "na", reason: "r" }, allButOne);
    expect(res).toEqual({ ok: false, reason: "section_all_na" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("N/A is not a value for a bonus", async () => {
    mockRpc();
    const res = await applyOverride({ companyId: "c", pitchId: "p", actorId: "m", itemType: "bonus", itemId: "bonus.directv", newValue: "na", reason: "r" }, pitch);
    expect(res).toEqual({ ok: false, reason: "invalid_value" });
  });
});

describe("N/A guard with no objection (review 2026-11-25)", () => {
  it("when no objection happened, the last real Delivery item can't be marked N/A (Delivery would fall to 0)", async () => {
    mockRpc();
    const delivery = DOOR_RUBRIC.elements.filter((e) => e.section === "delivery" && e.id !== DOOR_RUBRIC.objectionElementId).map((e) => e.id);
    const pitch = {
      rubricVersion: DOOR_RUBRIC.version,
      elements: DOOR_RUBRIC.elements
        .filter((e) => e.id !== DOOR_RUBRIC.objectionElementId)
        .map((e) => ({ elementId: e.id, grade: delivery.slice(1).includes(e.id) ? ("na" as const) : ("hit" as const) })),
      events: [],
      deliveryScaled: true,
      notQualifyingReason: null,
    } as unknown as StoredPitch;
    const res = await applyOverride({ companyId: "c", pitchId: "p", actorId: "m", itemType: "element", itemId: delivery[0]!, newValue: "na", reason: "r" }, pitch);
    expect(res).toEqual({ ok: false, reason: "section_all_na" });
  });
});
