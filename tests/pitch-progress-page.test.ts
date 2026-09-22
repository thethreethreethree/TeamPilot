/**
 * The Progress board — what it must NOT show, and what it must not re-derive.
 *
 * The founder ruled on 2026-09-22 that when the rubric sheet and `SalesCoach-KPI-System.md` disagree
 * about anything a REP sees, the KPI document wins, and the test is whether a figure is a target or
 * a position. A distance you can close by pitching better survives; a rank and a cushion do not.
 *
 * That ruling reversed two of three calls made in an earlier build, and the register's own lesson
 * was not that the calls were wrong — it was *"choosing at all, three times, without asking"*. So
 * this test guards the ruling rather than the taste.
 *
 * A33 source-level: the component imports react-native and cannot be rendered here. What is
 * protected is an ABSENCE, and absence is a property of the source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const board = code(read('src/components/pitch-progress-page.tsx'));

test('a rep is never shown a rank or a cushion', () => {
  /*
    The mockup draws "#2 on your team this week", "118 pts ahead of #3" and "rank #2". All three are
    POSITIONS and all three are gone. This board will not match the drawing, and that is the ruling
    working rather than a bug.
  */
  assert.doesNotMatch(board, /\brank\b/i, 'rank is a position, not a target');
  assert.doesNotMatch(board, /gaps\.ahead/, 'the cushion below is a position too');
  assert.doesNotMatch(board, /boardSize/);
});

test('the distance behind survives, because it is a target', () => {
  // "62 pts behind #1" is a gap a rep closes by pitching better. It is the one cross-agent figure
  // the ruling keeps, and keeping it is what leaves the competition real to them.
  assert.match(board, /gaps\.behind/);
});

test('it branches on whether a field ARRIVED, never on a role flag', () => {
  /*
    The route strips rank, boardSize and gaps.ahead before they leave the server. This board reads
    what it was given. A component asking "am I a manager?" can be wrong; a value that never arrives
    cannot be leaked by a rendering bug — which is why the protection lives at the route and the
    component only has to not undo it.
  */
  assert.doesNotMatch(board, /managerView/, 'a role flag here would be a second, weaker gate');
});

test('the gauge is told the real scale, not the Arena’s', () => {
  /*
    Pitch Score runs 0-130. `ArenaGauge` clamped to 100 until it was parameterised, so passing 106.5
    through it would have drawn a FULL gauge for a score that is not full — a genuinely high number
    rendered as a maximum.
  */
  assert.match(board, /max=\{rubric\.maxScore\}/);
  assert.doesNotMatch(board, /max=\{130\}/, 'the scale comes from the rubric, never a literal');
});

test('the band comes from the authority rather than a fourth copy', () => {
  /*
    `bandFor` and `bandLabel` live in gamification/points.ts and already clamp above 100, which is
    why 106.5 bands as Elite. The web reached that the hard way: a four-band copy shipped, and a
    95-point pitch read Elite in the Arena gauge and Strong in the card directly beneath it, on the
    same page, for the same rep.
  */
  assert.match(board, /from '@\/lib\/gamification\/points'/);
  assert.match(board, /bandFor\(agg\.avgPitchScore\)/);
  assert.doesNotMatch(board, /Elite|Strong|Solid|Developing/, 'no band table is re-typed here');
});

test('the competition card names its own window instead of following the toggle', () => {
  /*
    R-C. The leaderboard route accepts only week, month and all — a `day` selection falls back to
    ALL TIME, silently. A card that followed the toggle would have put an all-time standing above a
    one-day gauge, each rendering confidently, neither saying so. Reading `board.period` makes that
    impossible to express rather than merely unlikely.
  */
  assert.match(board, /PERIOD_LABELS\[board\.period\]/);
});

test('a failed optional read omits its card rather than drawing a zero', () => {
  /*
    The rule this app has now caught five times, most recently on the Arena: a failed leaderboard
    read told a rep they had closed no deals, on the screen entirely about their own performance.
    The competition card and today's gain are each optional, each fails alone, and each failure
    costs only its own card.
  */
  assert.match(board, /fetchLeaderboard\(p\)\.catch\(\(\) => null\)/);
  assert.match(board, /today != null \?/, 'today is omitted when unknown, never shown as +0');
});

test('the two elements with no data are absent, not faked', () => {
  /*
    No competition entity exists — no name, no end time — so "WEEK 38 SHOWDOWN · Ends Sun 11:59 PM"
    would be an invented deadline a rep plans around. And `bestPitchScore` is one number from
    reduce(Math.max), so the three tappable best-pitch cards have no list, no dates and no ids. The
    single figure IS shown, on the gauge, because that one exists.
  */
  assert.doesNotMatch(board, /SHOWDOWN|Ends Sun/i);
  assert.doesNotMatch(board, /See scoring/);
  assert.match(board, /Best \$\{agg\.bestPitchScore\}/);
});

test('the qualifying threshold is the server’s, not a literal', () => {
  // The counted card explains the exclusion using the rubric's own number. Typing 40 here is the
  // hard-coding the rubric endpoint was built to prevent.
  assert.match(board, /rubric\.qualifyingMinBase/);
  assert.doesNotMatch(board, /\b40\b/);
});
