/**
 * Regression tests for the rep's Arena figures (build spec 5.2).
 *
 * THREE RULES the obvious implementation gets wrong.
 *
 * A CORRECTION IS NOT ITS OWN SESSION. Corrections are negative ledger rows
 * against a session already banked. Counted as sessions they show a rep a
 * phantom call worth -12 points that never happened to them, and drag the
 * average down twice for one mistake.
 *
 * A CORRECTED SESSION KEEPS ITS ORIGINAL DATE. Taking the correction's
 * timestamp would move a call from March into May, reorder the chart, and put a
 * NEW flag on something months old.
 *
 * NOTHING IS FABRICATED WITH NO DATA. Spec section 0.5: never a rank, band or
 * verdict with nothing behind it. A rep with no scored call has a null average
 * and no band — never 0 and never "Needs coaching".
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildArena, milestones } from '@/lib/gamification/arena';
import { bandFor, type PointRow } from '@/lib/gamification/points';

const NOW = Date.parse('2026-09-03T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const r = (
  sessionId: string | null,
  points: number,
  createdAt: string,
): PointRow => ({ sessionId, points, band: null, createdAt });

test('an empty ledger fabricates nothing', () => {
  const a = buildArena([], { deals: 0, now: NOW });
  assert.equal(a.sessions, 0);
  assert.equal(a.total, 0);
  assert.equal(a.average, null, 'invented an average');
  assert.equal(a.band, null, 'invented a band for a rep who has never been scored');
  assert.equal(a.best, null);
  assert.deepEqual(a.bestPitches, []);
});

test('a correction folds into its session rather than becoming one', () => {
  const a = buildArena(
    [r('s1', 80, day(3)), r('s1', -12, day(1)), r('s2', 60, day(2))],
    { deals: 0, now: NOW },
  );
  assert.equal(a.sessions, 2, 'a correction was counted as its own session');
  assert.equal(a.average, 64); // (68 + 60) / 2
  assert.equal(a.best, 68);
});

test('a corrected session keeps its ORIGINAL date', () => {
  // Otherwise the call moves in time, the chart reorders, and a months-old
  // pitch can pick up a NEW flag.
  const a = buildArena([r('s1', 80, day(30)), r('s1', -5, day(1))], {
    deals: 0,
    now: NOW,
  });
  assert.equal(a.bestPitches[0].isNew, false, 'a correction made an old pitch look new');
});

test('the total counts every row, including a correction with no session', () => {
  // A manual correction still moved the rep's total; hiding it would make this
  // figure disagree with the scoreboard.
  const a = buildArena([r('s1', 80, day(2)), r(null, -10, day(1))], {
    deals: 0,
    now: NOW,
  });
  assert.equal(a.total, 70);
  assert.equal(a.sessions, 1, 'a session-less correction was counted as a session');
});

test('strong sessions are counted at 80 and above', () => {
  const a = buildArena(
    [r('s1', 79, day(3)), r('s2', 80, day(2)), r('s3', 95, day(1))],
    { deals: 0, now: NOW },
  );
  assert.equal(a.strongSessions, 2);
});

test('the band comes from the average', () => {
  const a = buildArena([r('s1', 90, day(2)), r('s2', 90, day(1))], {
    deals: 0,
    now: NOW,
  });
  assert.equal(a.band, 'elite');
});

test('best pitches are the top three by points, newest flagged', () => {
  const a = buildArena(
    [r('s1', 40, day(20)), r('s2', 95, day(2)), r('s3', 70, day(30)), r('s4', 88, day(10))],
    { deals: 0, now: NOW },
  );
  assert.deepEqual(a.bestPitches.map((p) => p.points), [95, 88, 70]);
  assert.equal(a.bestPitches[0].isNew, true, 'a two-day-old pitch was not flagged NEW');
  assert.equal(a.bestPitches[1].isNew, false, 'a ten-day-old pitch was flagged NEW');
});

test('a pitch exactly seven days old is not NEW', () => {
  const a = buildArena([r('s1', 90, day(7))], { deals: 0, now: NOW });
  assert.equal(a.bestPitches[0].isNew, false);
});

test('an unparseable date is never NEW', () => {
  const a = buildArena([r('s1', 90, 'not a date')], { deals: 0, now: NOW });
  assert.equal(a.bestPitches[0].isNew, false);
});

test('the chart holds the last seven sessions, oldest first', () => {
  const rows = Array.from({ length: 10 }, (_, i) => r(`s${i}`, i * 10, day(10 - i)));
  const a = buildArena(rows, { deals: 0, now: NOW });
  assert.equal(a.lastSeven.length, 7);
  assert.deepEqual(a.lastSeven.map((s) => s.points), [30, 40, 50, 60, 70, 80, 90]);
});

test('a rep with fewer than seven sessions shows what they have', () => {
  const a = buildArena([r('s1', 50, day(2)), r('s2', 60, day(1))], {
    deals: 0,
    now: NOW,
  });
  assert.equal(a.lastSeven.length, 2);
});

test('an UNREADABLE deal count leaves the deal badges unjudged, not unearned', () => {
  // A rep with twelve deals whose team board failed to load must not be told
  // they have not closed one. null is "cannot check", which is the truth.
  const a = buildArena([r('s1', 85, day(1))], { deals: null, now: NOW });
  const by = Object.fromEntries(milestones(a, null).map((m) => [m.key, m.earned]));
  assert.equal(by['deal'], null, 'reported a definite "no deals" on a missing count');
  assert.equal(by['closer'], null);
  // The badges that depend only on their own ledger are still decided.
  assert.equal(by['spark'], true);
  assert.equal(by['flame'], true);
  assert.equal(by['century'], false);
});

test('badges are earned on facts, and every one states what it takes', () => {
  const none = buildArena([], { deals: 0, now: NOW });
  for (const m of milestones(none, 0)) {
    assert.equal(m.earned, false, `${m.key} was not decided on a known-zero count`);
    assert.ok(m.requirement.length > 0, `${m.key} does not say what it takes`);
  }
  const some = buildArena([r('s1', 85, day(1))], { deals: 1, now: NOW });
  const earned = milestones(some, 1).filter((m) => m.earned).map((m) => m.key);
  assert.deepEqual(earned.sort(), ['deal', 'flame', 'spark']);
});

test('the century and closer badges need the real counts', () => {
  const many = buildArena(
    Array.from({ length: 100 }, (_, i) => r(`s${i}`, 50, day(1))),
    { deals: 10, now: NOW },
  );
  const earned = milestones(many, 10).map((m) => m.key + ':' + m.earned);
  assert.ok(earned.includes('century:true'));
  assert.ok(earned.includes('closer:true'));
});

test('a rep with only session-less corrections has no sessions and no band', () => {
  // Their whole ledger is adjustments not attached to a call. There is nothing
  // to average, so there is nothing to band — an em dash, not a judgement.
  const a = buildArena([r(null, -20, day(2)), r(null, -5, day(1))], {
    deals: 0,
    now: NOW,
  });
  assert.equal(a.sessions, 0);
  assert.equal(a.average, null);
  assert.equal(a.band, null);
  // The total still reflects them, so this screen agrees with the scoreboard.
  assert.equal(a.total, -25);
});

test('a call corrected below zero lands in the lowest band, as the web does', () => {
  // Not a fabricated judgement: the web's own bandFor clamps to 0-100, so a
  // negative clamps to 0 and bands there. Pinned so the two cannot drift.
  const a = buildArena([r('s1', 10, day(2)), r('s1', -40, day(1))], {
    deals: 0,
    now: NOW,
  });
  assert.equal(a.sessions, 1);
  assert.equal(a.average, -30);
  assert.equal(a.band, 'needs_coaching');
});

test('strong calls are counted across the WHOLE history, not a recent window', () => {
  // The web hit this exact bug and fixed it server-side (5a1074ba): a rep's
  // strong calls can all predate whatever window a truncated read returns, so a
  // veteran would see "0 strong" and lose the badge they had already earned.
  // This app avoids it by paging the entire ledger — pinned here so a future
  // limit cannot quietly reintroduce the window.
  const old = Array.from({ length: 250 }, (_, i) =>
    r(`old-${i}`, i < 40 ? 92 : 30, day(300 - i)),
  );
  const recent = Array.from({ length: 5 }, (_, i) => r(`new-${i}`, 20, day(5 - i)));
  const a = buildArena([...old, ...recent], { deals: 0, now: NOW });

  assert.equal(a.sessions, 255);
  assert.equal(a.strongSessions, 40, 'strong calls older than the recent rows were lost');
  assert.equal(milestones(a, 0).find((m) => m.key === 'flame')?.earned, true);
});

test('with only session_score rows, the figures match the server route exactly', () => {
  // What the phone now reads (build spec section 4: reason = 'session_score')
  // and what /api/coach/gamification/my-points computes must agree, or a rep
  // sees one total in the app and another on the website for the same history.
  //
  // The schema's unique index — one session_score row per session — is what
  // makes the folding a no-op here, so a plain mean equals the route's
  // total / count. Pinned because that equality is load-bearing, not incidental.
  const rows = [r('s1', 90, day(4)), r('s2', 60, day(3)), r('s3', 75, day(2))];
  const a = buildArena(rows, { deals: 0, now: NOW });

  const routeTotal = rows.reduce((n, x) => n + x.points, 0);
  const routeAvg = Math.round((routeTotal / rows.length) * 10) / 10;

  assert.equal(a.total, routeTotal);
  assert.equal(a.sessions, rows.length);
  assert.equal(a.average, routeAvg);
});

// ---------------------------------------------------------------------------
// Spec §2: a best pitch carries its BAND, not only its score
// ---------------------------------------------------------------------------

test('each best pitch carries the band its score falls in', () => {
  // "87 points" is only readable by somebody who already knows the scale. The
  // spec asks for the band beside the date for exactly that reason.
  const rows: PointRow[] = [
    { sessionId: 's-elite', points: 95, band: 'elite', createdAt: '2026-09-01T10:00:00.000Z' },
    { sessionId: 's-mid', points: 62, band: 'solid', createdAt: '2026-09-01T10:00:00.000Z' },
  ];
  const arena = buildArena(rows, { deals: 0, now: Date.parse('2026-09-02T10:00:00.000Z') });
  const bands = arena.bestPitches.map((b) => b.band);
  assert.ok(bands.every((b) => b !== undefined), 'a best pitch shipped with no band field');
  assert.notEqual(bands[0], bands[1], 'two very different scores were given the same band');
});

test('the band comes from the shared bandFor at EVERY boundary, not a re-implementation', () => {
  /**
   * THE FIRST VERSION OF THIS TEST DID NOT CATCH ITS OWN MUTATION.
   *
   * It asserted one score, 89.6, against `bandFor(89.6)` — and a naive
   * re-implementation (`points >= 80 ? 'elite' : 'strong'`) agrees at that
   * value, so replacing the shared call with a hand-rolled threshold passed all
   * twenty-one tests. A single sample cannot tell a correct rule from a wrong
   * one that happens to coincide there.
   *
   * So this walks every boundary in BANDS and one either side of it. A
   * re-implementation now has to reproduce all five ranges exactly, which is
   * the same thing as using the shared source.
   */
  const probes = [0, 39, 39.5, 40, 59, 60, 79, 80, 89, 89.4, 89.6, 90, 100];
  for (const points of probes) {
    const rows: PointRow[] = [
      { sessionId: `s-${points}`, points, band: null, createdAt: '2026-09-01T10:00:00.000Z' },
    ];
    const arena = buildArena(rows, { deals: 0, now: Date.parse('2026-09-02T10:00:00.000Z') });
    assert.equal(
      arena.bestPitches[0].band,
      bandFor(points),
      `a pitch scoring ${points} was banded by something other than bandFor`,
    );
    // The gauge's band, from the same single average, must agree with the row's.
    assert.equal(arena.band, bandFor(points), `the gauge and the row disagree at ${points}`);
  }
});

test('89.6 is ELITE — rounded before banding, not truncated', () => {
  // The exact value that put one score in two bands on two screens of the web
  // app this morning. Named on its own so a change to rounding fails a test
  // whose title says what broke.
  assert.equal(bandFor(89.6), 'elite');
  assert.equal(bandFor(89.4), 'strong');
});

test('a pitch whose score cannot be banded carries null, never a guessed band', () => {
  const rows: PointRow[] = [
    { sessionId: 's', points: Number.NaN, band: null, createdAt: '2026-09-01T10:00:00.000Z' },
  ];
  const arena = buildArena(rows, { deals: 0, now: Date.parse('2026-09-02T10:00:00.000Z') });
  for (const b of arena.bestPitches) {
    if (!Number.isFinite(b.points)) assert.equal(b.band, null);
  }
});

test('a corrected session is banded on its FOLDED total, not on the row the server banded', () => {
  /**
   * The reason `BestPitch.band` is derived rather than taken from `PointRow.band`,
   * pinned so nobody "simplifies" it back.
   *
   * `bySession` sums every row for a session, because a correction weeks later
   * still moved that session's score. The server's band is the band of THAT ROW.
   * Here the original row says 85 / "strong", a correction adds 6, and the
   * session displays 91 — which is elite. Taking the row's band would print
   * "Strong" beside the number 91.
   */
  const rows: PointRow[] = [
    { sessionId: 's', points: 85, band: 'strong', createdAt: '2026-09-01T10:00:00.000Z' },
    { sessionId: 's', points: 6, band: 'strong', createdAt: '2026-09-20T10:00:00.000Z' },
  ];
  const arena = buildArena(rows, { deals: 0, now: Date.parse('2026-09-21T10:00:00.000Z') });
  const pitch = arena.bestPitches[0];
  assert.equal(pitch.points, 91, 'the correction was not folded into the session');
  assert.equal(pitch.band, 'elite', 'the band followed the row rather than the figure beside it');
  assert.notEqual(pitch.band, rows[0].band, 'the row band and the shown band must be free to differ');
});
