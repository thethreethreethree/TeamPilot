import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The read side has exactly one way to undo 0254, and it is the obvious one: sum the element rows
 * to show section totals. On an objection-free pitch those rows are at raw rubric weight and
 * Delivery was scaled to 35, so the sum disagrees with the score on the same screen.
 *
 * The fixture below is built to make that visible — element rows that deliberately do NOT sum to
 * the stored section verdict — so a reader that recomputes fails rather than coincidentally agrees.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { readPitchScore } from "../readPitchScore";
import { SECTIONS } from "../rubric";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const PITCH = {
  id: "p1",
  rep_id: "rep1",
  session_id: "sess1",
  recorded_at: "2026-09-04T18:00:00.000Z",
  duration_s: 412,
  audio_url: "https://example.test/a.mp3",
  outcome: "sold",
  base: 62.4,
  bonus: 20,
  violations: 2,
  total: 80.4,
  band: "Strong",
  qualifying: true,
  not_qualifying_reason: null,
  delivery_scaled: true,
  rubric_version: "attfiber-v1",
  section_points: {
    introduction: 9.5,
    discovery: 12.0,
    consulting: 8.4,
    close: 8.6,
    transitions: 4.7,
    delivery: 19.2,
  },
};

// Raw rubric weight — 12.6 of Delivery, against a stored, scaled section verdict of 19.2.
const ELEMENT_ROWS = [
  { element_id: "deliv.tone", grade: "partial", points: 3.5, timestamp_s: 200, evidence: "wobbled" },
  { element_id: "deliv.pace", grade: "hit", points: 4, timestamp_s: null, evidence: null },
  { element_id: "intro.trucks", grade: "hit", points: 3, timestamp_s: 8, evidence: "crews" },
  { element_id: "deliv.spokenYes", grade: "partial", points: 2, timestamp_s: null, evidence: null },
  { element_id: "deliv.questionQuality", grade: "missed", points: 0, timestamp_s: null, evidence: null },
  { element_id: "retired.element", grade: "hit", points: 9, timestamp_s: null, evidence: null },
];

const EVENT_ROWS = [
  { type: "bonus", item_id: "bonus.directv", points: 5, timestamp_s: 300, evidence: "full pitch", confidence: null },
  { type: "rejected_bonus", item_id: "bonus.inside", points: 0, timestamp_s: 91, evidence: "a door, maybe", confidence: 0.62 },
];

const mockDb = (opts: { pitch?: unknown; error?: { message: string }; disputeEvents?: unknown[] } = {}) => {
  const from = vi.fn((table: string) => {
    if (table === "pitches") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({
        data: "pitch" in opts ? opts.pitch : PITCH,
        error: opts.error ?? null,
      });
      return chain;
    }
    // `events` is the dispute/answer thread — a different query shape (in + order + limit) from
    // the two pitch child tables, so the mock has to answer it differently or the reader gets
    // element rows where it expects events.
    if (table === "events") {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order"]) chain[m] = () => chain;
      chain.limit = async () => ({ data: opts.disputeEvents ?? [], error: null });
      return chain;
    }
    const rows = table === "pitch_elements" ? ELEMENT_ROWS : EVENT_ROWS;
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = async () => ({ data: rows, error: null });
    return chain;
  });
  const client = { from };
  asMock(createClient).mockResolvedValue(client);
  return client;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("section totals come from the verdict, not the rows", () => {
  it("returns the STORED Delivery total, which the element rows do not sum to", async () => {
    const pitch = await readPitchScore("sess1");
    const delivery = pitch!.sectionPoints.find((s) => s.id === "delivery")!;
    expect(delivery.points).toBe(19.2);

    // Proof the fixture discriminates: re-summing gives a different, wrong answer.
    const resummed = pitch!.elements
      .filter((e) => e.section === "delivery")
      .reduce((s, e) => s + e.points, 0);
    expect(resummed).toBe(9.5);
    expect(resummed).not.toBe(delivery.points);
  });

  it("returns every section in rubric order, with its max", async () => {
    const pitch = await readPitchScore("sess1");
    expect(pitch!.sectionPoints.map((s) => s.id)).toEqual(SECTIONS.map((s) => s.id));
    expect(pitch!.sectionPoints.map((s) => s.maxPoints)).toEqual(SECTIONS.map((s) => s.maxPoints));
  });

  it("gives an EMPTY section list for a pitch stored before 0254, not a re-summed guess", async () => {
    // A wrong reconciliation on this screen is worse than an absent one: the rep would see a
    // Delivery figure that contradicts their own score and have no way to tell which is right.
    mockDb({ pitch: { ...PITCH, section_points: null } });
    const pitch = await readPitchScore("sess1");
    expect(pitch!.sectionPoints).toEqual([]);
    expect(pitch!.base).toBe(62.4);
  });
});

describe("elements", () => {
  it("orders them by the rubric, not by how the model happened to grade them", async () => {
    const pitch = await readPitchScore("sess1");
    // intro.trucks was FOURTH from last in the stored rows; Introduction comes first in the rubric.
    expect(pitch!.elements[0]!.elementId).toBe("intro.trucks");
  });

  it("resolves the rubric label and max so every screen shows the same words", async () => {
    const pitch = await readPitchScore("sess1");
    const tone = pitch!.elements.find((e) => e.elementId === "deliv.tone")!;
    expect(tone).toMatchObject({ label: "Tone and certainty", maxPoints: 7, points: 3.5 });
  });

  it("keeps a retired element rather than dropping it, so an old pitch still explains itself", async () => {
    // A rubric bump can retire an element. The grade was real when it was given; hiding it would
    // leave points in `base` that nothing on screen accounts for.
    const pitch = await readPitchScore("sess1");
    const retired = pitch!.elements.find((e) => e.elementId === "retired.element")!;
    expect(retired).toMatchObject({ label: "retired.element", section: null, maxPoints: null });
  });

  it("preserves a null timestamp as null rather than 0", async () => {
    // 0 is a real offset — the start of the recording. Coercing null to it sends the rep's play
    // button to the beginning and presents that as where the evidence was.
    const pitch = await readPitchScore("sess1");
    expect(pitch!.elements.find((e) => e.elementId === "deliv.pace")!.timestampS).toBeNull();
  });
});

describe("events", () => {
  it("carries the rejected bonus and its confidence to the dispute", async () => {
    const pitch = await readPitchScore("sess1");
    expect(pitch!.events.find((e) => e.type === "rejected_bonus")).toMatchObject({
      itemId: "bonus.inside",
      points: 0,
      confidence: 0.62,
      evidence: "a door, maybe",
    });
  });
});

describe("the rep's own dispute threads come back with the pitch", () => {
  const ev = (kind: string, at: string, extra: Record<string, unknown> = {}) => ({
    id: `${kind}-${at}`,
    actor: kind.endsWith("answered") ? "mgr1" : "rep1",
    kind,
    subject: "pitch:p1",
    created_at: at,
    payload: { pitch_id: "p1", rep_id: "rep1", item_id: "deliv.tone", note: "n", ...extra },
  });

  it("pairs an answer with the dispute it answers", async () => {
    mockDb({
      disputeEvents: [
        ev("coach.pitch_score_disputed", "2026-09-20T10:00:00Z", { note: "I was confident" }),
        ev("coach.pitch_score_answered", "2026-09-20T11:00:00Z", { note: "You are right" }),
      ],
    });
    const pitch = await readPitchScore("sess1");
    expect(pitch!.disputes).toHaveLength(1);
    expect(pitch!.disputes[0]!.answer?.note).toBe("You are right");
    expect(pitch!.disputes[0]!.open).toBe(false);
  });

  it("shows an unanswered dispute as still open", async () => {
    mockDb({ disputeEvents: [ev("coach.pitch_score_disputed", "2026-09-20T10:00:00Z")] });
    const pitch = await readPitchScore("sess1");
    expect(pitch!.disputes[0]!.open).toBe(true);
    expect(pitch!.disputes[0]!.answer).toBeNull();
  });

  it("agrees with the manager's queue about a RE-FILED dispute being open again", async () => {
    // The same replay function decides this on both sides, which is the point. Two copies of the
    // rule would let the rep see "answered" while the manager sees "open", or the reverse.
    mockDb({
      disputeEvents: [
        ev("coach.pitch_score_disputed", "2026-09-20T10:00:00Z"),
        ev("coach.pitch_score_answered", "2026-09-20T11:00:00Z"),
        ev("coach.pitch_score_disputed", "2026-09-20T12:00:00Z", { note: "Still wrong" }),
      ],
    });
    const pitch = await readPitchScore("sess1");
    const newest = pitch!.disputes[0]!;
    expect(newest).toMatchObject({ note: "Still wrong", open: true });
  });

  it("returns an empty list when the rep has never disputed anything", async () => {
    const pitch = await readPitchScore("sess1");
    expect(pitch!.disputes).toEqual([]);
  });
});

describe("a failed read is not an unscored pitch", () => {
  it("logs and returns null when the query errors", async () => {
    mockDb({ error: { message: "permission denied for table pitches" } });
    expect(await readPitchScore("sess1")).toBeNull();
    // Returning null silently would tell a rep their pitch was never scored when the read failed —
    // the error-as-no-data class. The error must be on the record.
    expect(console.error).toHaveBeenCalled();
    expect(String(asMock(console.error).mock.calls[0]![0])).toContain("permission denied");
  });

  it("returns null without logging when there genuinely is no pitch", async () => {
    mockDb({ pitch: null });
    expect(await readPitchScore("sess1")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});
