import { describe, it, expect } from "vitest";

/**
 * Pitch Score milestones.
 *
 * The two that matter most are the two whose definitions came from the sheet rather than from
 * their names, because the name-based reading is plausible and wrong:
 *
 *   Clean sweep is "every phase fully hit" — NOT "no violations".
 *   Full bundle names DTV, Wireless and ADT — NOT "any three bonuses".
 *
 * Both fixtures below are built so a name-based implementation would fail: the clean-sweep tests
 * include a pitch with no violations that is not a sweep, and the bundle tests include a pitch
 * with three bonuses that are the wrong three.
 */

import { derivePitchMilestones, PITCH_MILESTONE_KEYS } from "../milestones";
import { ELEMENTS } from "../rubric";
import type { AggregablePitch } from "../aggregate";

const SECTIONS_ZERO = {
  introduction: 0, discovery: 0, consulting: 0, close: 0, transitions: 0, delivery: 0,
};

const pitch = (
  recordedAt: string,
  over: {
    total?: number;
    qualifying?: boolean;
    bonuses?: Array<{ bonusId: string; points: number; capped?: boolean }>;
    violations?: Array<{ violationId: string; deduction: number; capped?: boolean }>;
    elements?: Array<{ elementId: string; grade: "hit" | "partial" | "missed" }>;
  } = {}
): AggregablePitch => ({
  repId: "rep1",
  recordedAt,
  score: {
    base: 45,
    bonus: 0,
    violations: 0,
    total: over.total ?? 60,
    qualifying: over.qualifying ?? true,
    notQualifyingReason: (over.qualifying ?? true) ? null : "Base under 40",
    sectionPoints: SECTIONS_ZERO,
    // `capped` defaulted rather than demanded of every fixture: it is the scorer's note about
    // the +30 pool and no milestone reads it, so requiring it in each case would be noise.
    bonusBreakdown: (over.bonuses ?? []).map((b) => ({ capped: false, ...b })),
    violationBreakdown: (over.violations ?? []).map((v) => ({ capped: false, ...v })),
  },
  elements: over.elements ?? [],
});

/** Every element in the rubric, all hit — the only thing that earns a Clean sweep. */
const allHit = () => ELEMENTS.map((e) => ({ elementId: e.id, grade: "hit" as const }));

describe("first pitch and century count COUNTED pitches", () => {
  it("dates the first counted pitch", () => {
    const m = derivePitchMilestones([pitch("2026-08-20"), pitch("2026-08-12"), pitch("2026-09-01")]);
    expect(m.firstPitch).toBe("2026-08-12");
  });

  it("ignores a pitch that did not qualify", () => {
    // A rep must not earn "First pitch" for a conversation the leaderboard refuses to count.
    const m = derivePitchMilestones([
      pitch("2026-08-01", { qualifying: false }),
      pitch("2026-08-12"),
    ]);
    expect(m.firstPitch).toBe("2026-08-12");
  });

  it("sorts before picking, so input order cannot decide the date", () => {
    const m = derivePitchMilestones([pitch("2026-09-09"), pitch("2026-01-02")]);
    expect(m.firstPitch).toBe("2026-01-02");
  });

  it("dates Century on the 100th counted pitch, not the 100th recorded", () => {
    // Real, ordered timestamps. An earlier fixture generated "2026-03-50" — the string sort
    // happened to still order them, which is exactly how a bad fixture passes for a bad reason.
    const at = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString();
    const rows = [
      ...Array.from({ length: 50 }, (_, i) => pitch(at(i))),
      ...Array.from({ length: 20 }, (_, i) => pitch(at(100 + i), { qualifying: false })),
      ...Array.from({ length: 50 }, (_, i) => pitch(at(200 + i))),
    ];
    const m = derivePitchMilestones(rows);
    // 50 counted, then 20 that do not count, then 50 more: the 100th COUNTED one is at(249).
    expect(m.century).toBe(at(249));
  });

  it("leaves Century unearned at 99", () => {
    const at = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString();
    const rows = Array.from({ length: 99 }, (_, i) => pitch(at(i)));
    expect(derivePitchMilestones(rows).century).toBeNull();
  });
});

describe("Triple digits is a single pitch over 100", () => {
  it("fires on 100, not 101", () => {
    expect(derivePitchMilestones([pitch("2026-09-18", { total: 100 })]).tripleDigits)
      .toBe("2026-09-18");
  });

  it("does not fire on 99.5", () => {
    expect(derivePitchMilestones([pitch("2026-09-18", { total: 99.5 })]).tripleDigits).toBeNull();
  });

  it("is not a total across pitches", () => {
    // Four pitches at 60 is 240 points and no triple digits. Only one pitch can earn it.
    const rows = Array.from({ length: 4 }, (_, i) => pitch(`2026-09-1${i}`, { total: 60 }));
    expect(derivePitchMilestones(rows).tripleDigits).toBeNull();
  });
});

describe("Full bundle names three specific products", () => {
  const bundle = [
    { bonusId: "bonus.directv", points: 5 },
    { bonusId: "bonus.wireless", points: 5 },
    { bonusId: "bonus.adt", points: 5 },
  ];

  it("fires when all three are pitched in one pitch", () => {
    expect(derivePitchMilestones([pitch("2026-09-10", { bonuses: bundle })]).fullBundle)
      .toBe("2026-09-10");
  });

  it("does NOT fire on three bonuses that are the wrong three", () => {
    // "Any three bonuses" is the plausible name-based reading, and the sheet says otherwise.
    const m = derivePitchMilestones([
      pitch("2026-09-10", {
        bonuses: [
          { bonusId: "bonus.inside", points: 5 },
          { bonusId: "bonus.referral", points: 5 },
          { bonusId: "bonus.laughs", points: 3 },
        ],
      }),
    ]);
    expect(m.fullBundle).toBeNull();
  });

  it("does not add the three up across separate pitches", () => {
    // "in one pitch" is the sheet's own wording.
    const m = derivePitchMilestones([
      pitch("2026-09-01", { bonuses: [{ bonusId: "bonus.directv", points: 5 }] }),
      pitch("2026-09-02", { bonuses: [{ bonusId: "bonus.wireless", points: 5 }] }),
      pitch("2026-09-03", { bonuses: [{ bonusId: "bonus.adt", points: 5 }] }),
    ]);
    expect(m.fullBundle).toBeNull();
  });

  it("does not count a bonus that was considered and rejected", () => {
    // A rejected bonus is stored at 0 points so the rep can see it was weighed. It awarded nothing.
    const m = derivePitchMilestones([
      pitch("2026-09-10", {
        bonuses: [
          { bonusId: "bonus.directv", points: 5 },
          { bonusId: "bonus.wireless", points: 5 },
          { bonusId: "bonus.adt", points: 0 },
        ],
      }),
    ]);
    expect(m.fullBundle).toBeNull();
  });
});

describe("Clean sweep is every phase fully hit, not an absence of violations", () => {
  it("fires when every element in every section is hit", () => {
    expect(derivePitchMilestones([pitch("2026-09-15", { elements: allHit() })]).cleanSweep)
      .toBe("2026-09-15");
  });

  it("does NOT fire on a pitch with no violations", () => {
    // The name-based reading. This pitch has a clean record and hit nothing.
    const m = derivePitchMilestones([pitch("2026-09-15", { violations: [], elements: [] })]);
    expect(m.cleanSweep).toBeNull();
  });

  it("still fires on a pitch that DID take a violation, if every phase was hit", () => {
    // The two are independent. A rep can be interrupted and still hit every phase.
    const m = derivePitchMilestones([
      pitch("2026-09-15", {
        elements: allHit(),
        violations: [{ violationId: "viol.talkingOver", deduction: 2 }],
      }),
    ]);
    expect(m.cleanSweep).toBe("2026-09-15");
  });

  it("treats a PARTIAL as not fully hit", () => {
    // The sheet says *fully*. A badge that accepted partials would sit above a section the
    // breakdown screen shows in amber.
    const els = allHit();
    els[0] = { elementId: els[0]!.elementId, grade: "partial" as never };
    expect(derivePitchMilestones([pitch("2026-09-15", { elements: els })]).cleanSweep).toBeNull();
  });

  it("fails the sweep when one whole section is missing", () => {
    const els = allHit().filter((e) => !e.elementId.startsWith("close."));
    expect(derivePitchMilestones([pitch("2026-09-15", { elements: els })]).cleanSweep).toBeNull();
  });

  it("is not blocked by an element the current rubric no longer knows", () => {
    // It belongs to no phase now, so it cannot stop a phase being fully hit — at either grade.
    // Both cases, because a MISSED retired element passes trivially and only a HIT one exercises
    // whether an unknown id can reach the per-section check at all.
    for (const grade of ["missed", "hit"] as const) {
      const els = [...allHit(), { elementId: "retired.element", grade }];
      expect(derivePitchMilestones([pitch("2026-09-15", { elements: els })]).cleanSweep)
        .toBe("2026-09-15");
    }
  });
});

describe("In the door is the rubric's own bonus", () => {
  it("fires on bonus.inside", () => {
    const m = derivePitchMilestones([
      pitch("2026-09-10", { bonuses: [{ bonusId: "bonus.inside", points: 5 }] }),
    ]);
    expect(m.inTheDoor).toBe("2026-09-10");
  });

  it("does not fire on a different bonus", () => {
    const m = derivePitchMilestones([
      pitch("2026-09-10", { bonuses: [{ bonusId: "bonus.referral", points: 5 }] }),
    ]);
    expect(m.inTheDoor).toBeNull();
  });
});

describe("a pitch with no date cannot earn a dated badge", () => {
  it("drops it rather than returning an undefined date", () => {
    const undated = { ...pitch("2026-09-01") };
    delete (undated as { recordedAt?: string }).recordedAt;
    const m = derivePitchMilestones([undated, pitch("2026-09-05")]);
    expect(m.firstPitch).toBe("2026-09-05");
  });
});

describe("a brand-new rep", () => {
  it("has earned nothing, and every key is present", () => {
    const m = derivePitchMilestones([]);
    // Present-and-null, not absent: the strip renders six badges either way, and a missing key
    // would render as an empty slot rather than an unearned one.
    expect(Object.keys(m).sort()).toEqual([...PITCH_MILESTONE_KEYS].sort());
    expect(Object.values(m).every((v) => v === null)).toBe(true);
  });
});
