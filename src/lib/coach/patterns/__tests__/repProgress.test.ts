import { describe, it, expect } from "vitest";
import {
  teamCards,
  rankRepsByAttention,
  repTiles,
  repAlerts,
  checkInAgenda,
  timeline,
} from "../repProgress";
import type { PatternRow } from "../readPatterns";
import type { StatusVerdict } from "../status";

/**
 * The Rep progress board's arithmetic.
 *
 * Every number here is printed beside a named person, which sets what these tests are for. Not
 * "does it add up" — that part is easy. What they pin is the handful of ways a plausible number
 * would be a false statement about someone:
 *
 *   · "avg 0.0 days to fix" for a rep who has fixed nothing, which reads as instant
 *   · "2/3 acknowledged" against a pattern that was never coached, asking a rep for something
 *     nobody gave them
 *   · points recovered counting patterns still open, so the figure rises while nothing is fixed
 *   · a rep sorted to the top of "needs attention" with no fact behind the pill
 *   · a timeline bar starting at the window's edge, dating a problem a month late
 */

const verdict = (over: Partial<StatusVerdict> = {}): StatusVerdict => ({
  status: "coaching",
  open: true,
  reason: "Being coached",
  streak: 0,
  comparison: null,
  ...over,
});

const row = (over: Partial<PatternRow> = {}): PatternRow =>
  ({
    id: "p1",
    repId: "rep1",
    itemId: "intro.trucks",
    itemKind: "element",
    label: "Trucks / neighborhood notice",
    section: "INTRODUCTION",
    firstSeen: "2026-09-10T10:00:00Z",
    missesAtDetection: 3,
    applicableAtDetection: 10,
    costPerPitch: 2.3,
    strip: [],
    coachedAt: null,
    fixedAt: null,
    repReviewed: false,
    events: [],
    verdict: verdict(),
    daysOpen: 9,
    ...over,
  }) as PatternRow;

const NOW = new Date("2026-09-19T12:00:00Z");

const FIXED = verdict({ status: "fixed", open: false, reason: "5 clean pitches in a row", streak: 5 });
const IMPROVING = verdict({ status: "improving", open: true, reason: "Misses 4/5 → 1/5", streak: 2 });
const STALLED = verdict({ status: "stalled", open: true, reason: "Coached 8 days ago with no improvement" });
const NEW = verdict({ status: "new", open: true, reason: "Detected, not coached yet" });

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

describe("the five team cards", () => {
  it("counts open patterns and the reps who have them", () => {
    const cards = teamCards(
      [
        row({ id: "a", repId: "r1", verdict: NEW }),
        row({ id: "b", repId: "r1", verdict: IMPROVING }),
        row({ id: "c", repId: "r2", verdict: STALLED }),
        // A rep whose only pattern is fixed is NOT one of the reps it is open "across".
        row({ id: "d", repId: "r3", verdict: FIXED, fixedAt: "2026-09-11T10:00:00Z" }),
      ],
      NOW
    );
    expect(cards.openPatterns).toBe(3);
    expect(cards.acrossReps).toBe(2);
  });

  it("has NO average days-to-fix when nothing has been fixed", () => {
    // 0.0 in that tile reads as "fixed instantly", which is the opposite of the truth.
    expect(teamCards([row({ verdict: NEW })], NOW).avgDaysToFix).toBeNull();
  });

  it("averages first-seen to fixed, in days", () => {
    const cards = teamCards(
      [
        row({ id: "a", firstSeen: "2026-09-02T10:00:00Z", fixedAt: "2026-09-11T10:00:00Z", verdict: FIXED }),
        row({ id: "b", firstSeen: "2026-09-01T10:00:00Z", fixedAt: "2026-09-12T10:00:00Z", verdict: FIXED }),
      ],
      NOW
    );
    expect(cards.avgDaysToFix).toBe(10); // 9 and 11
  });

  it("finds the close date of a pattern that cleared ITSELF, with no fixed_at column", () => {
    // The streak rule is the main way a pattern closes and it writes an event, not a column.
    // Reading only fixed_at would make most fixes invisible to "FIXED THIS MONTH".
    const cards = teamCards(
      [
        row({
          verdict: FIXED,
          fixedAt: null,
          firstSeen: "2026-09-02T10:00:00Z",
          events: [{ kind: "fixed", at: "2026-09-11T10:00:00Z" }],
        }),
      ],
      NOW
    );
    expect(cards.fixedThisMonth).toBe(1);
    expect(cards.avgDaysToFix).toBe(9);
  });

  it("counts only THIS month as fixed this month", () => {
    const cards = teamCards(
      [row({ verdict: FIXED, fixedAt: "2026-08-20T10:00:00Z" })],
      NOW
    );
    expect(cards.fixedThisMonth).toBe(0);
  });

  it("does not count LAST YEAR's September as this month", () => {
    // Found by mutation: dropping the year check survived, because every fixture was in 2026.
    // A card reading "FIXED THIS MONTH 6" that quietly includes last September is a number a
    // manager would never think to doubt.
    const cards = teamCards(
      [row({ verdict: FIXED, firstSeen: "2025-09-02T10:00:00Z", fixedAt: "2025-09-11T10:00:00Z" })],
      NOW
    );
    expect(cards.fixedThisMonth).toBe(0);
  });

  it("ignores a close that predates the detection rather than averaging a negative span", () => {
    // Found by mutation, and NOT equivalent: `first_seen` is written by the detector and a
    // `fixed` event's `created_at` by whichever server appended it. A few seconds of skew is
    // ordinary; a backdated row is not impossible. Either produces "avg -0.1 days to fix", which
    // is not a slightly-wrong number, it is a nonsense one printed on a manager's dashboard.
    const cards = teamCards(
      [row({ verdict: FIXED, firstSeen: "2026-09-11T10:00:00Z", fixedAt: "2026-09-02T10:00:00Z" })],
      NOW
    );
    expect(cards.avgDaysToFix).toBeNull();
  });

  it("awaits a review only where coaching actually happened", () => {
    const cards = teamCards(
      [
        row({ id: "a", coachedAt: "2026-09-11T10:00:00Z", repReviewed: false, verdict: STALLED }),
        row({ id: "b", coachedAt: "2026-09-11T10:00:00Z", repReviewed: true, verdict: IMPROVING }),
        // Never coached — a rep cannot acknowledge what nobody said.
        row({ id: "c", coachedAt: null, repReviewed: false, verdict: NEW }),
      ],
      NOW
    );
    expect(cards.awaitingRepReview).toBe(1);
  });

  it("recovers points only from FIXED patterns", () => {
    // Counting open ones would let the figure climb while nothing had been fixed.
    const cards = teamCards(
      [
        row({ id: "a", costPerPitch: 2.3, verdict: FIXED, fixedAt: "2026-09-11T10:00:00Z" }),
        row({ id: "b", costPerPitch: 6, verdict: STALLED }),
      ],
      NOW
    );
    expect(cards.pointsRecovered).toBe(2.3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

describe("the rep list, needs-attention first", () => {
  const names = new Map([["r1", "Anthony A."], ["r2", "John Knudtson"]]);

  it("splits the open set the way the board does — improving is counted apart, and also within", () => {
    // Anthony A. on the board: "1 fixed · 1 improving · 2 open" in the list, "Open patterns 3" in
    // the panel. Those agree — the list partitions what the panel totals — and BOTH come from one
    // resolver, which is the whole point of the C8 ruling.
    const [a] = rankRepsByAttention(
      [
        row({ id: "a", repId: "r1", verdict: FIXED, fixedAt: "2026-09-11T10:00:00Z" }),
        row({ id: "b", repId: "r1", verdict: IMPROVING }),
        row({ id: "c", repId: "r1", verdict: STALLED }),
        row({ id: "d", repId: "r1", verdict: NEW }),
      ],
      names,
      NOW
    );
    expect(a).toMatchObject({ fixed: 1, improving: 1, stillOpen: 2, openTotal: 3 });
  });

  it("flags Needs 1:1 on a STALLED pattern, and says why in a sentence the rep could read", () => {
    const [a] = rankRepsByAttention([row({ repId: "r1", verdict: STALLED })], names, NOW);
    expect(a!.attention).toBe("needs_1_1");
    expect(a!.attentionReason).toMatch(/coached over a week ago with no change/i);
  });

  it("flags Follow up on a pattern open a week with NO coaching", () => {
    // A different ask from Needs 1:1: nobody has tried anything yet, so repeating an approach
    // that failed is not the advice.
    const [a] = rankRepsByAttention(
      [row({ repId: "r1", verdict: NEW, coachedAt: null, firstSeen: "2026-09-10T10:00:00Z" })],
      names,
      NOW
    );
    expect(a!.attention).toBe("follow_up");
  });

  it("counts EXACTLY seven days as overdue, not eight", () => {
    // Found by mutation: `>=` survived being loosened to `>` because every fixture sat well past
    // the line. The board's own alert reads "has been open 7 days without coaching", so seven is
    // inside. An off-by-one here silently gives every pattern an extra day of grace.
    const [a] = rankRepsByAttention(
      [row({ repId: "r1", verdict: NEW, coachedAt: null, firstSeen: "2026-09-12T12:00:00Z" })],
      names,
      NOW
    );
    expect(a!.attention).toBe("follow_up");
  });

  it("does not call six days overdue", () => {
    const [a] = rankRepsByAttention(
      [row({ repId: "r1", verdict: NEW, coachedAt: null, firstSeen: "2026-09-13T12:00:00Z" })],
      names,
      NOW
    );
    expect(a!.attention).toBe("new_rep");
  });

  it("calls a rep with only fresh uncoached patterns a New rep, not a problem", () => {
    const [a] = rankRepsByAttention(
      [row({ repId: "r1", verdict: NEW, coachedAt: null, firstSeen: "2026-09-18T10:00:00Z" })],
      names,
      NOW
    );
    expect(a!.attention).toBe("new_rep");
  });

  it("calls a rep with nothing open On track, and says so", () => {
    const [a] = rankRepsByAttention(
      [row({ repId: "r1", verdict: FIXED, fixedAt: "2026-09-11T10:00:00Z" })],
      names,
      NOW
    );
    expect(a!.attention).toBe("on_track");
    expect(a!.attentionReason).toBe("Nothing open");
  });

  it("every row carries a reason, because a pill nobody can argue with is a verdict", () => {
    const rows = rankRepsByAttention(
      [
        row({ id: "a", repId: "r1", verdict: STALLED }),
        row({ id: "b", repId: "r2", verdict: FIXED, fixedAt: "2026-09-11T10:00:00Z" }),
      ],
      names,
      NOW
    );
    for (const r of rows) expect(r.attentionReason.length).toBeGreaterThan(0);
  });

  it("sorts needs-1:1 above follow-up above new above on-track", () => {
    const rows = rankRepsByAttention(
      [
        row({ id: "a", repId: "ok", verdict: FIXED, fixedAt: "2026-09-11T10:00:00Z" }),
        row({ id: "b", repId: "fresh", verdict: NEW, firstSeen: "2026-09-18T10:00:00Z" }),
        row({ id: "c", repId: "overdue", verdict: NEW, firstSeen: "2026-09-01T10:00:00Z" }),
        row({ id: "d", repId: "bad", verdict: STALLED }),
      ],
      new Map(),
      NOW
    );
    expect(rows.map((r) => r.repId)).toEqual(["bad", "overdue", "fresh", "ok"]);
  });

  it("breaks a tie by name, so the list does not reshuffle between renders", () => {
    const rows = rankRepsByAttention(
      [
        row({ id: "a", repId: "r2", verdict: STALLED }),
        row({ id: "b", repId: "r1", verdict: STALLED }),
      ],
      names,
      NOW
    );
    expect(rows.map((r) => r.fullName)).toEqual(["Anthony A.", "John Knudtson"]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

describe("the rep panel's tiles", () => {
  it("counts acknowledgement against COACHED patterns, not all of them", () => {
    // The board reads "2/2" beside a rep with three open patterns, one never coached. A 2/3 here
    // would ask a rep to acknowledge coaching that did not happen.
    const t = repTiles([
      row({ id: "a", coachedAt: "2026-09-11T10:00:00Z", repReviewed: true, verdict: STALLED }),
      row({ id: "b", coachedAt: "2026-09-09T10:00:00Z", repReviewed: true, verdict: IMPROVING }),
      row({ id: "c", coachedAt: null, repReviewed: false, verdict: NEW }),
    ]);
    expect(t).toMatchObject({ reviewed: 2, reviewable: 2, openPatterns: 3, notCoachedYet: 1 });
  });

  it("has no average for a rep who has fixed nothing", () => {
    expect(repTiles([row({ verdict: NEW })]).avgDaysToFix).toBeNull();
  });

  it("reproduces Anthony A.'s panel from the board", () => {
    const t = repTiles([
      row({ id: "a", verdict: FIXED, firstSeen: "2026-09-02T10:00:00Z", fixedAt: "2026-09-11T10:00:00Z", costPerPitch: 2.3 }),
      row({ id: "b", coachedAt: "2026-09-11T10:00:00Z", repReviewed: true, verdict: STALLED }),
      row({ id: "c", coachedAt: "2026-09-09T10:00:00Z", repReviewed: true, verdict: IMPROVING }),
      row({ id: "d", coachedAt: null, verdict: NEW }),
    ]);
    // Open patterns 3 · 1 not coached yet · Fixed 1 · Avg 9.0 · +2.3 · 2/2
    expect(t).toEqual({
      openPatterns: 3,
      notCoachedYet: 1,
      fixed: 1,
      avgDaysToFix: 9,
      pointsRecovered: 2.3,
      reviewed: 2,
      reviewable: 2,
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

describe("the alert box keeps two different asks apart", () => {
  it("says Stalled for a pattern that was coached and did not move", () => {
    const [a] = repAlerts([row({ label: "Stalls when the provider assumption is wrong", verdict: STALLED })], NOW);
    expect(a!.kind).toBe("stalled");
    expect(a!.text).toMatch(/Try a different approach in a 1:1/);
  });

  it("says Waiting on you for a pattern nobody has coached", () => {
    // Merging the two would send a manager to repeat an approach that has already failed — or
    // to "try something different" when nothing has been tried.
    const [a] = repAlerts(
      [row({ label: "No spoken yes at hinge moments", verdict: NEW, coachedAt: null, daysOpen: 7 })],
      NOW
    );
    expect(a!.kind).toBe("waiting_on_you");
    expect(a!.text).toMatch(/open 7 days without coaching/);
  });

  it("raises Waiting on you at exactly seven days, matching the board's wording", () => {
    // Same boundary as the pill, and it has its own copy of the comparison — so it needs its own
    // test, or one of the two drifts and the list and the box disagree about the same pattern.
    const alerts = repAlerts(
      [row({ verdict: NEW, coachedAt: null, firstSeen: "2026-09-12T12:00:00Z", daysOpen: 7 })],
      NOW
    );
    expect(alerts.map((a) => a.kind)).toEqual(["waiting_on_you"]);
  });

  it("does not raise it at six days", () => {
    expect(
      repAlerts([row({ verdict: NEW, coachedAt: null, firstSeen: "2026-09-13T12:00:00Z", daysOpen: 6 })], NOW)
    ).toEqual([]);
  });

  it("stays silent about a pattern that is being worked", () => {
    expect(repAlerts([row({ verdict: IMPROVING, coachedAt: "2026-09-18T10:00:00Z" })], NOW)).toEqual([]);
  });

  it("re-uses the resolver's own wording rather than authoring a second one", () => {
    // The manager reads the reason twice on this screen — in the box and in the table. Two
    // authors for one sentence is two sentences that drift.
    const [a] = repAlerts([row({ verdict: STALLED })], NOW);
    expect(a!.text).toContain("coached 8 days ago with no improvement");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

describe("the check-in agenda is derived, never generated", () => {
  const own = [
    // A Stalled pattern HAS a coaching date — that is what stalled means. Writing the fixture
    // without one made it match the uncoached pass too, and the agenda listed it twice.
    row({ id: "a", label: "Stalls when the provider assumption is wrong", verdict: STALLED, coachedAt: "2026-09-11T10:00:00Z" }),
    row({ id: "b", label: "Talks over the customer", verdict: IMPROVING, coachedAt: "2026-09-09T10:00:00Z" }),
    row({ id: "c", label: "No spoken yes at hinge moments", verdict: NEW, coachedAt: null }),
  ];

  it("reproduces the board's three items, in its order", () => {
    const items = checkInAgenda(own);
    expect(items).toHaveLength(3);
    expect(items[0]!.text).toMatch(/Replay one missed clip of .*provider assumption/);
    expect(items[1]!.text).toMatch(/Call out the progress on .*Talks over the customer.*2 clean in a row/);
    expect(items[2]!.text).toMatch(/Introduce .*hinge moments.* and play the clips/);
  });

  it("carries the fact behind every item, so a manager can disagree with a fact", () => {
    // The §3.3 line: advice a human cannot argue with is an assertion, and this board hands
    // three of them about a named person.
    for (const i of checkInAgenda(own)) expect(i.because.length).toBeGreaterThan(0);
  });

  it("names the pattern each item is about, so 'Open clips' knows which one", () => {
    expect(checkInAgenda(own).map((i) => i.patternId)).toEqual(["a", "b", "c"]);
  });

  it("drops the streak clause when there is no streak, rather than saying '0 clean in a row'", () => {
    const items = checkInAgenda([
      row({ id: "b", label: "Talks over", verdict: verdict({ status: "improving", open: true, streak: 0 }) }),
    ]);
    expect(items[0]!.text).toBe("Call out the progress on “Talks over”.");
  });

  it("lists a pattern ONCE even when the row matches two passes", () => {
    // The state a partial write leaves behind: a verdict says stalled, the coaching date is
    // missing. "Call this out" and "introduce this" about one pattern is worse than either.
    const items = checkInAgenda([row({ id: "a", label: "X", verdict: STALLED, coachedAt: null })]);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toMatch(/Replay one missed clip/);
  });

  it("stops at three, because the board's card has three lines", () => {
    // Found by mutation: the slice survived, because every fixture had exactly three items. A
    // rep with six open patterns would get a check-in agenda nobody could run in a check-in.
    const many = [
      row({ id: "a", verdict: STALLED, coachedAt: "2026-09-11T10:00:00Z" }),
      row({ id: "b", verdict: STALLED, coachedAt: "2026-09-11T10:00:00Z" }),
      row({ id: "c", verdict: IMPROVING, coachedAt: "2026-09-09T10:00:00Z" }),
      row({ id: "d", verdict: NEW, coachedAt: null }),
      row({ id: "e", verdict: NEW, coachedAt: null }),
    ];
    expect(checkInAgenda(many)).toHaveLength(3);
    // And the three it keeps are the most urgent, not the first three encountered.
    expect(checkInAgenda(many).map((i) => i.patternId)).toEqual(["a", "b", "c"]);
  });

  it("is empty for a rep with nothing open", () => {
    expect(checkInAgenda([row({ verdict: FIXED, fixedAt: "2026-09-11T10:00:00Z" })])).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

describe("the timeline", () => {
  const WINDOW = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-19T00:00:00Z") };

  it("runs a bar from first-seen to today when the pattern is open", () => {
    const [b] = timeline([row({ firstSeen: "2026-09-10T00:00:00Z", verdict: STALLED })], WINDOW);
    expect(b!.from).toBeCloseTo(9 / 18, 5);
    expect(b!.to).toBe(1);
    expect(b!.clippedStart).toBe(false);
  });

  it("ends the bar where the pattern was fixed", () => {
    const [b] = timeline(
      [row({ firstSeen: "2026-09-01T00:00:00Z", fixedAt: "2026-09-10T00:00:00Z", verdict: FIXED })],
      WINDOW
    );
    expect(b!.to).toBeCloseTo(9 / 18, 5);
  });

  it("SAYS when a bar runs off the left, instead of dating the problem a month late", () => {
    // Clamped silently, a pattern first seen in August reads as one that started on 1 September.
    const [b] = timeline([row({ firstSeen: "2026-08-20T00:00:00Z", verdict: STALLED })], WINDOW);
    expect(b!.from).toBe(0);
    expect(b!.clippedStart).toBe(true);
  });

  it("places the three legend markers and nothing else", () => {
    const [b] = timeline(
      [
        row({
          firstSeen: "2026-09-01T00:00:00Z",
          verdict: IMPROVING,
          events: [
            { kind: "coached", at: "2026-09-10T00:00:00Z" },
            { kind: "drill_assigned", at: "2026-09-10T00:00:00Z" },
            { kind: "rep_reviewed", at: "2026-09-10T00:00:00Z" },
            // Real kinds, not on the legend. Drawing them would add marks the key cannot explain.
            { kind: "note", at: "2026-09-11T00:00:00Z" },
            { kind: "clip_disputed", at: "2026-09-11T00:00:00Z" },
          ],
        }),
      ],
      WINDOW
    );
    expect(b!.markers.map((m) => m.kind)).toEqual(["coached", "drill_assigned", "rep_reviewed"]);
    expect(b!.markers[0]!.x).toBeCloseTo(9 / 18, 5);
  });

  it("DROPS a marker outside the window rather than pinning it to an edge", () => {
    // A Ⓒ at the left edge is a specific claim that coaching happened on the first of the month.
    const [b] = timeline(
      [row({ verdict: STALLED, events: [{ kind: "coached", at: "2026-08-15T00:00:00Z" }] })],
      WINDOW
    );
    expect(b!.markers).toEqual([]);
  });

  it("drops an undated marker too", () => {
    const [b] = timeline(
      [row({ verdict: STALLED, events: [{ kind: "coached", at: "not-a-date" }] })],
      WINDOW
    );
    expect(b!.markers).toEqual([]);
  });

  it("returns nothing for a zero-width window rather than dividing by it", () => {
    const t = new Date("2026-09-01T00:00:00Z");
    expect(timeline([row()], { from: t, to: t })).toEqual([]);
  });
});
