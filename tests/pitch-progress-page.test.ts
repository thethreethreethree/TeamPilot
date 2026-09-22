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

test('the element with no data is absent, not faked', () => {
  /*
    No competition entity exists — no name, no end time — so "WEEK 38 SHOWDOWN · Ends Sun 11:59 PM"
    would be an invented deadline a rep plans around. The single best figure IS shown, on the gauge,
    because that one exists.
  */
  assert.doesNotMatch(board, /SHOWDOWN|Ends Sun/i);
  assert.doesNotMatch(board, /See scoring/);
  assert.match(board, /Best \$\{agg\.bestPitchScore\}/);
});

test('the best-pitch rows read the server’s list rather than a second-best guess', () => {
  /*
    THIS TEST REPLACED ITS OWN OPPOSITE. It used to assert the rows were ABSENT, because
    `bestPitchScore` is one number from reduce(Math.max) and nothing served a list. That was true
    when written and stopped being true when `/pitch-score/best` was deployed on 2026-09-22 — the
    exact shape of stale claim this project keeps finding, and the reason the docblock above the
    board was rewritten in the same commit rather than left describing an absence that had ended.

    What is guarded now is that the rows come from the READ. A board that sorted or filtered the
    list itself would be a fifth duplicated decision, and the two copies would sit on a phone and a
    server where nobody could ever see them disagree.
  */
  assert.match(board, /fetchBestPitches\(p\)/);
  assert.doesNotMatch(board, /\.sort\(|\.slice\(/, 'the order and the count are the server’s');
});

test('a failed best-pitches read is not the sentence “you have none”', () => {
  /*
    The confident zero, caught a sixth time before it shipped. An empty list is a real and
    discouraging statement about a rep, and a read that fell over says nothing of the kind. The
    endpoint already refuses to conflate them — it 500s rather than returning [] — and the board has
    to keep that distinction rather than collapsing it back into one branch.
  */
  assert.match(board, /fetchBestPitches\(p\)\.catch\(\(\) => null\)/);
  assert.match(board, /Could not load your best pitches/);
  assert.match(board, /best != null && best\.pitches\.length === 0/, 'empty is its own branch');
});

test('a pitch whose recording was deleted keeps its score and loses its tap', () => {
  /*
    `pitch_scores.session_id` is `on delete set null`, so a pitch outlives its recording. Dropping
    the row would erase a real score; offering the tap would open nothing. The row stays, the tap
    goes, and the row SAYS so — a card that is silently not tappable reads as a broken card.
  */
  assert.match(board, /disabled=\{url == null\}/);
  assert.match(board, /Recording deleted/);
});

test('the best-pitch rows name the window the server answered with', () => {
  // Same reason as the competition card: the header reads the echoed period, so a substitution
  // cannot be silent even though the route honours all four periods today.
  assert.match(board, /PERIOD_LABELS\[best\.period\]/);
});

test('the row links to the session page, not the door-log report card', () => {
  /*
    Two different screens in this product are called a pitch’s report card.
    `/doors/report-card/[pitchId]` is the Door Log one; `PitchScorePanel` — the Pitch Score
    breakdown these rows are about — renders on `/dashboard/sales-coach/[id]`, keyed by SESSION.
    Linking the wrong one would open a real page about the same call showing different numbers,
    which is worse than a dead link because nothing would look broken.
  */
  assert.match(board, /webPitchScoreUrl\(ENV\.API_BASE, p\.sessionId\)/);
  assert.doesNotMatch(board, /report-card/);
});

test('the qualifying threshold is the server’s, not a literal', () => {
  // The counted card explains the exclusion using the rubric's own number. Typing 40 here is the
  // hard-coding the rubric endpoint was built to prevent.
  assert.match(board, /rubric\.qualifyingMinBase/);
  assert.doesNotMatch(board, /\b40\b/);
});

test('the board names itself before it shows a number', () => {
  /*
    THE READY STATE HAD NO HEADING AT ALL. The first `accessibilityRole="header"` on a loaded
    board was "Your best pitches", two thirds of the way down, so a VoiceOver user moving by
    heading landed inside someone else's section - and the board was named only when it was EMPTY
    or BROKEN, which are the two states where its own headings already existed.

    It reads on sighted screens too, and got worse after the tab label was shortened: the tab says
    "Metrics", the segment says "Progress", and the Arena one swipe away also shows a points total,
    a best list and a milestone strip on a different scale. Nothing said the words Pitch Score.

    Guarded by ORDER, not just presence: a heading that arrives after the gauge fixes the sentence
    and not the problem.
  */
  const heading = board.indexOf('Your Pitch Score');
  const gauge = board.indexOf('<ArenaGauge');
  assert.ok(heading > 0, 'the loaded board does not name itself anywhere');
  assert.ok(heading < gauge, 'the name must come before the number it names');

  // Breakdown's peer heading, so the two boards are named the same way.
  const breakdown = code(read('src/components/pitch-breakdown-page.tsx'));
  assert.match(breakdown, /Your rubric averages/);
});
