import { describe, it, expect } from "vitest";

/**
 * The status resolver, and the two things it carries.
 *
 * **C8** — two screens in the mockups counted "open" differently for the same rep at the same
 * moment. Ruled 2026-09-22: open = status ≠ Fixed. Every state below asserts `open` alongside its
 * status, so an edit that makes Improving closed fails four times rather than once.
 *
 * **The guide's Step 5 table**, read 2026-09-22 and quoted where each rule is tested. An earlier
 * version of this resolver compared pitches-since-coaching against a rate frozen at detection —
 * a reasonable measurement, and not the one the guide specifies or the one the Rep progress board
 * prints ("MISSES THEN → NOW  4/5 → 1/5 ▼").
 */

import {
  statusOf,
  countPatterns,
  CLEAN_STREAK_TO_FIX,
  STALLED_AFTER_DAYS,
  COMPARISON_WINDOW,
  type StatusVerdict,
} from "../status";
import { missedOrPartial, type GradedPitch } from "../detect";
import type { Grade } from "../../pitchScore/rubric";

const NOW = new Date("2026-03-20T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

/** Day n of 2026-03, so ordering is legible in a failure message. */
const p = (day: number, grade: Grade): GradedPitch => ({
  pitchId: `p${day}`,
  recordedAt: `2026-03-${String(day).padStart(2, "0")}T10:00:00Z`,
  grade,
  points: grade === "hit" ? 4 : grade === "partial" ? 2 : 0,
});

/** `grades` oldest-first, laid onto consecutive days. */
const run = (grades: Grade[]): GradedPitch[] => grades.map((g, i) => p(i + 1, g));
const M: Grade = "missed";
const H: Grade = "hit";

const base = {
  applicable: [] as GradedPitch[],
  coachedAt: null as string | null,
  fixedAt: null as string | null,
  now: NOW,
};

describe("fixed — 'done right in 5 applicable pitches in a row; clears automatically'", () => {
  it("clears on the streak", () => {
    const v = statusOf({ ...base, coachedAt: daysAgo(10), applicable: run([M, M, M, H, H, H, H, H]) });
    expect(v.status).toBe("fixed");
    expect(v.open).toBe(false);
    expect(v.reason).toMatch(/5 clean/);
  });

  it("needs the streak CURRENT, not merely present", () => {
    // Five clean, then a miss. The rep had it and lost it.
    const v = statusOf({ ...base, coachedAt: daysAgo(10), applicable: run([H, H, H, H, H, M]) });
    expect(v.status).not.toBe("fixed");
  });

  it("one short is not fixed", () => {
    const v = statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M, H, H, H, H]) });
    expect(v.status).not.toBe("fixed");
    expect(v.open).toBe(true);
    expect(v.streak).toBe(CLEAN_STREAK_TO_FIX - 1);
  });

  it("a manager closing it by hand outranks everything, including a fresh miss", () => {
    const v = statusOf({ ...base, fixedAt: daysAgo(1), applicable: run([M]) });
    expect(v).toMatchObject({ status: "fixed", open: false });
  });

  it("clears without coaching — a rep can fix it themselves", () => {
    expect(statusOf({ ...base, coachedAt: null, applicable: run([M, H, H, H, H, H]) }).status).toBe("fixed");
  });
});

describe("new — 'detected, no coaching yet'", () => {
  it("is where an uncoached pattern sits, and it is open", () => {
    expect(statusOf({ ...base, applicable: run([M, M, M]) })).toMatchObject({ status: "new", open: true });
  });

  it("does not report improving before anyone coached", () => {
    // Improving on the numbers, but nobody engaged. The lifecycle starts when a human enters it,
    // and crediting coaching that never happened is the wrong thing to tell a manager.
    const v = statusOf({ ...base, coachedAt: null, applicable: run([M, M, M, M, M, H, H, H, H, M]) });
    expect(v.status).toBe("new");
  });
});

describe("improving — 'miss rate in the last 5 applicable is lower than the first 5, and at least one clean pitch'", () => {
  it("compares the first five against the last five", () => {
    // 5/5 then 1/5 — the board's "4/5 → 1/5 ▼" shape.
    const v = statusOf({ ...base, coachedAt: daysAgo(2), applicable: run([M, M, M, M, M, H, H, H, M, H]) });
    expect(v.status).toBe("improving");
    expect(v.open).toBe(true); // C8
    expect(v.reason).toBe("Misses 5/5 → 1/5");
  });

  it("requires AT LEAST ONE CLEAN pitch, not merely a lower rate", () => {
    // 5/5 → 4/5 is a lower rate with the rep still missing it every time they get a chance bar
    // none. Without this term a manager is told to ease off someone who has never landed it.
    const v = statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M, M, M, M, M, M, M, M, M, H]) });
    expect(v.status).toBe("improving");
    const noneClean = statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M, M, M, M, M, M, M, M, M, M]) });
    expect(noneClean.status).not.toBe("improving");
  });

  it("needs two full windows before it will say anything", () => {
    // Nine applicable pitches cannot be split into a first five and a last five that do not
    // overlap — the same pitch would be on both sides and flatten the comparison toward itself.
    const nine = statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M, M, M, M, M, H, H, H, H]) });
    expect(nine.status).not.toBe("improving");
    const ten = statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M, M, M, M, M, H, H, H, H, M]) });
    expect(ten.status).toBe("improving");
  });

  it("is not improving at the same rate", () => {
    const v = statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M, M, H, H, H, M, M, H, H, H]) });
    expect(v.status).toBe("coaching");
  });

  it("beats stalled when both could apply", () => {
    // Coached three weeks ago AND improving. Order settles it, and improvement is the more useful
    // truth to put in front of a manager.
    const v = statusOf({
      ...base,
      coachedAt: daysAgo(STALLED_AFTER_DAYS * 3),
      applicable: run([M, M, M, M, M, H, H, H, M, H]),
    });
    expect(v.status).toBe("improving");
  });

  it("says nothing on an item that stopped coming up", () => {
    expect(statusOf({ ...base, coachedAt: daysAgo(2), applicable: [] }).status).not.toBe("improving");
  });

  it("ignores the order the caller passes", () => {
    const shuffled = [p(10, H), p(1, M), p(7, H), p(3, M), p(9, H), p(2, M), p(8, H), p(5, M), p(4, M), p(6, M)];
    const v = statusOf({ ...base, coachedAt: daysAgo(1), applicable: shuffled });
    expect(v.reason).toBe("Misses 5/5 → 1/5");
  });
});

describe("stalled — 'coached 7+ days ago, no clean streak, miss rate not improved'", () => {
  it("fires on all three", () => {
    const v = statusOf({ ...base, coachedAt: daysAgo(STALLED_AFTER_DAYS), applicable: run([M, M, M]) });
    expect(v).toMatchObject({ status: "stalled", open: true });
  });

  it("does NOT fire while a clean streak is running", () => {
    // The third term, and the one easiest to drop: a streak of five is already Fixed above, so
    // this only shows up between one and four. That rep is landing it now.
    const v = statusOf({ ...base, coachedAt: daysAgo(STALLED_AFTER_DAYS + 5), applicable: run([M, M, M, H, H]) });
    expect(v.status).toBe("coaching");
    expect(v.streak).toBe(2);
  });

  it("is not stalled a day early", () => {
    const v = statusOf({ ...base, coachedAt: daysAgo(STALLED_AFTER_DAYS - 1), applicable: run([M, M]) });
    expect(v.status).toBe("coaching");
  });

  it("holds the boundary on a FRACTIONAL day, which is the only kind that occurs", () => {
    // Found by mutation: `>= 7` and `> 6` agree on whole days and differ at 6.5, and every case
    // here used whole days. Real coachedAt values are instants — coached 2pm Monday, viewed
    // Sunday morning is 6.8 days, and must not yet read Stalled.
    const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
    const applicable = run([M, M]);
    expect(statusOf({ ...base, coachedAt: hoursAgo(STALLED_AFTER_DAYS * 24 - 1), applicable }).status).toBe("coaching");
    expect(statusOf({ ...base, coachedAt: hoursAgo(STALLED_AFTER_DAYS * 24 + 1), applicable }).status).toBe("stalled");
  });

  it("distinguishes 'it has not come up' from 'coaching did not take'", () => {
    const quiet = statusOf({ ...base, coachedAt: daysAgo(STALLED_AFTER_DAYS + 3), applicable: [] });
    expect(quiet.reason).toMatch(/has not come up/i);
    const tried = statusOf({ ...base, coachedAt: daysAgo(STALLED_AFTER_DAYS + 3), applicable: run([M, M]) });
    expect(tried.reason).toMatch(/no improvement/i);
  });
});

describe("coaching — 'manager marked coached, assigned a drill, or added a note'", () => {
  it("is the state between being coached and any of the others", () => {
    expect(statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M]) })).toMatchObject({
      status: "coaching",
      open: true,
    });
  });
});

describe("C8 — open is a field, and it is anything not fixed", () => {
  const cases: Array<[string, StatusVerdict]> = [
    ["new", statusOf({ ...base, applicable: run([M]) })],
    ["coaching", statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M]) })],
    ["improving", statusOf({ ...base, coachedAt: daysAgo(1), applicable: run([M, M, M, M, M, H, H, H, M, H]) })],
    ["stalled", statusOf({ ...base, coachedAt: daysAgo(30), applicable: run([M, M]) })],
  ];

  it.each(cases)("%s is open", (_name, v) => {
    expect(v.open).toBe(true);
  });

  it("fixed is the only closed state", () => {
    expect(statusOf({ ...base, fixedAt: daysAgo(1) }).open).toBe(false);
  });

  it("every verdict carries a reason, because a status nobody can argue with is not evidence", () => {
    for (const [, v] of cases) expect(v.reason.length).toBeGreaterThan(0);
  });
});

describe("countPatterns keeps the board's two senses apart", () => {
  const verdicts: StatusVerdict[] = [
    { status: "fixed", open: false, reason: "", streak: 5 },
    { status: "improving", open: true, reason: "", streak: 1 },
    { status: "new", open: true, reason: "", streak: 0 },
    { status: "stalled", open: true, reason: "", streak: 0 },
  ];

  it("reproduces Anthony A. — one rep, two correct numbers", () => {
    const c = countPatterns(verdicts);
    // The Patterns-tab chip and the rep-detail tile: "Open patterns 3", Improving counted in.
    expect(c.open).toBe(3);
    // The Rep-progress list's third number: "1 fixed · 1 improving · 2 still open".
    expect(c.openNotImproving).toBe(2);
    expect(c.fixed).toBe(1);
    expect(c.improving).toBe(1);
  });

  it("the two differ by exactly the improving count", () => {
    const c = countPatterns(verdicts);
    expect(c.open - c.openNotImproving).toBe(c.improving);
  });

  it("counts nothing for nobody", () => {
    expect(countPatterns([])).toMatchObject({ open: 0, fixed: 0, openNotImproving: 0 });
  });
});

describe("the miss predicate reaches the resolver", () => {
  it("a Partial breaks the streak when the product counts Partials", () => {
    const applicable = run([M, H, H, H, H, "partial"]);
    // Under missedOnly a partial is clean, so the newest five are clean and it is Fixed.
    expect(statusOf({ ...base, applicable, coachedAt: daysAgo(1) }).status).toBe("fixed");
    // Under missedOrPartial the newest pitch is a miss, so the streak is 0.
    const v = statusOf({ ...base, applicable, coachedAt: daysAgo(1), isMiss: missedOrPartial });
    expect(v.streak).toBe(0);
    expect(v.status).not.toBe("fixed");
  });
});

describe("the windows are named so they can be argued with", () => {
  it("five and five, seven days, five clean to clear", () => {
    expect(COMPARISON_WINDOW).toBe(5);
    expect(CLEAN_STREAK_TO_FIX).toBe(5);
    expect(STALLED_AFTER_DAYS).toBe(7);
  });
});
