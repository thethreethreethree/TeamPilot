/**
 * M8 — empty, failed and partial, across all three Pitch Score surfaces.
 *
 * ONE DONE-WHEN: **a failed read never renders as a zero.** This app has shipped that failure five
 * times and caught a sixth in the best-pitch list; the Arena's version told a rep they had closed
 * no deals, on the screen entirely about their own performance.
 *
 * SWEPT, NOT REASONED ABOUT. The inventory below was built by reading every `fetch*` call out of
 * the two boards, and the last test fails if a board grows a read that is not in it. A set you
 * reasoned about contains what you thought of; a set you swept for contains what is there.
 *
 * THREE KINDS OF READ, and each has exactly one honest failure:
 *
 *   FATAL     the board cannot be drawn without it. A gauge with no scale and a bar with no
 *             maximum are not degraded versions of themselves, so the whole board becomes the
 *             error — with a sentence that ends in something to do.
 *   OPTIONAL  its own card is lost and the board stands. The card must SAY it failed: an omission
 *             with no reason attached is this product's own named disease, a path that produces
 *             nothing while nothing says so.
 *   PARTIAL   the read succeeded and is not the whole period. `capped` and `skippedPreVerdict` are
 *             the server's verdict on itself, usually false, and printed anyway — a board that
 *             averages over a bound it silently hit reports a different number from the one its
 *             caption names, and nothing on screen looks wrong.
 *
 * A33 source-level: these components import react-native and cannot be rendered here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const progress = code(read('src/components/pitch-progress-page.tsx'));
const breakdown = code(read('src/components/pitch-breakdown-page.tsx'));
const sheet = code(read('src/components/pitch-rubric-sheet.tsx'));
const strip = code(read('src/components/pitch-milestones-strip.tsx'));
const caveats = code(read('src/components/pitch-read-caveats.tsx'));

/** Every read the two boards make, and what its failure costs. */
const READS = [
  { board: 'progress', call: 'fetchBreakdown(p)', kind: 'fatal' },
  { board: 'progress', call: 'fetchRubric()', kind: 'fatal' },
  { board: 'progress', call: 'fetchLeaderboard(p)', kind: 'optional' },
  { board: 'progress', call: 'fetchBestPitches(p)', kind: 'optional' },
  { board: 'progress', call: 'fetchMilestones()', kind: 'optional' },
  { board: 'progress', call: "fetchBreakdown('day')", kind: 'optional' },
  { board: 'breakdown', call: 'fetchBreakdown(p)', kind: 'fatal' },
  { board: 'breakdown', call: 'fetchRubric()', kind: 'fatal' },
] as const;

const src = (board: string) => (board === 'progress' ? progress : breakdown);

/**
 * Is this call's failure swallowed?
 *
 * THE STATEMENT, NOT AN ADJACENCY AND NOT A FIXED WINDOW. Both simpler readings were wrong here.
 * `.catch` immediately after the call misses the `day` read, which is
 * `fetchBreakdown('day').then(d => d.aggregate.totalPoints).catch(() => null)` and is the most
 * carefully optional read on the board. A fixed character window then over-reached the other way:
 * from `Promise.all([fetchBreakdown(p), ...])` it ran on into the NEXT statement's `.catch` and
 * pronounced a fatal read swallowed. Both of those are the same mistake as a grep that answers
 * itself — so the slice stops where the statement does.
 */
function swallows(board: string, call: string): boolean {
  const text = src(board);
  const at = text.indexOf(call);
  if (at < 0) return false;
  const end = text.indexOf(';', at);
  return text.slice(at, end < 0 ? text.length : end).includes('.catch(() => null)');
}

test('every optional read is caught, and every fatal one is not', () => {
  for (const r of READS) {
    const caught = swallows(r.board, r.call);
    if (r.kind === 'optional') {
      assert.ok(caught, `${r.board}: ${r.call} would take the whole board down with it`);
    } else {
      assert.ok(!caught, `${r.board}: ${r.call} is fatal and must not be swallowed`);
    }
  }
});

test('every optional failure says so, rather than leaving a hole', () => {
  /*
    THE HOUSE DISEASE, named in the build's own law: a path that produces nothing while nothing
    says so. The competition card was exactly that until today — it vanished on a failed read and a
    rep who saw it yesterday was left inventing a reason.

    `today` is the one optional read with no sentence, and deliberately: it is a clause inside
    another sentence ("+177 today · this week"), so its absence removes a phrase rather than a
    card. There is nothing to attach a reason to, and "+0 today" is the confident zero itself.
  */
  assert.match(progress, /Could not load where you stand in the competition/);
  assert.match(progress, /Could not load your best pitches/);
  assert.match(strip, /Could not load your milestones/);
  assert.match(progress, /today != null \?/);
  assert.doesNotMatch(progress, /\+0 today/);
});

test('a read that worked and found nothing is a different sentence from one that failed', () => {
  /*
    `board == null` is a failed leaderboard read. `board.standing == null` is the read working and
    the rep not being on the board for its window. Collapsing the two would tell a rep whose
    network dropped that they have no standing, which is a definite and discouraging claim.
  */
  assert.match(progress, /board == null \?/);
  assert.match(progress, /No competition standing in the/);
  assert.match(strip, /data == null \?/);
});

test('both boards have an empty state that teaches, not one that says “none”', () => {
  // An empty state is the best teaching moment in the product: say what belongs here and how to
  // get it. Both branch on whether any pitch was recorded at all, because "you have recorded
  // nothing" and "you recorded five and none counted" need opposite sentences.
  for (const [name, s] of [['progress', progress], ['breakdown', breakdown]] as const) {
    assert.match(s, /agg\.counted === 0/, `${name} has no empty state`);
    assert.match(s, /agg\.pitchesTotal > 0/, `${name} does not tell the two empties apart`);
    assert.match(s, /reaches Discovery/, `${name} does not say what counting takes`);
  }
});

test('the qualifying threshold is the server’s on BOTH boards, not a literal', () => {
  /*
    FOUND BY SWEEPING FOR THIS, not by knowing it. Progress was already reading
    `rubric.qualifyingMinBase` and had a test forbidding the literal; Breakdown's empty state said
    "scores 40 or more on the base" in a template string. Same sentence, same product, one of them
    hard-coded — and it is the exact hard-coding the rubric endpoint was built to prevent. The
    number is in `rubric_config` and changing it there would have moved one board and not the other.
  */
  for (const [name, s] of [['progress', progress], ['breakdown', breakdown]] as const) {
    assert.match(s, /rubric\.qualifyingMinBase/, `${name} does not read the threshold`);
    assert.doesNotMatch(s, /\b40 or more\b/, `${name} still hard-codes the threshold`);
  }
});

test('both boards print the read’s verdict on itself, from one wording', () => {
  /*
    `capped` was rendered on Breakdown and nowhere else; `skippedPreVerdict` was rendered nowhere at
    all — pitches the server deliberately excludes and COUNTS so a board can say so, on boards that
    never said so. One component now, because two panes of one screen showing two wordings of the
    same caveat is the duplicated decision this build is organised against.
  */
  assert.match(progress, /<PitchReadCaveats data=\{data\} \/>/);
  assert.match(breakdown, /<PitchReadCaveats data=\{data\} \/>/);
  assert.match(caveats, /data\.capped/);
  assert.match(caveats, /skippedPreVerdict/);
  assert.doesNotMatch(progress, /as far back as the read goes/, 'the wording lives in one place');
  assert.doesNotMatch(breakdown, /as far back as the read goes/);
});

test('a substituted period is captioned on both boards', () => {
  // The breakdown route returns THIS WEEK with a 200 for any value it does not recognise. Silence
  // here is seven days of work captioned "All time", with nothing on screen wrong.
  for (const [name, s] of [['progress', progress], ['breakdown', breakdown]] as const) {
    assert.match(s, /periodHonoured\(asked, data\)/, `${name} trusts the period it asked for`);
    assert.match(s, /periodSubstituted\(asked, data\)/, `${name} does not say what it got instead`);
  }
});

test('every surface announces its loading and its failure to a screen reader', () => {
  /*
    A sighted rep sees the board swap for an error. Without a live region a screen-reader user is
    told nothing at all — the screen simply stops having the thing they were reading.
  */
  for (const [name, s] of [['progress', progress], ['breakdown', breakdown]] as const) {
    assert.match(s, /accessibilityLabel="Loading your/, `${name} has an unlabelled spinner`);
    assert.match(s, /accessibilityRole="alert"[\s\S]{0,80}accessibilityLiveRegion="polite"/, name);
  }
  // The sheet is opened from a board that already has its rubric, so it has no read and no failure
  // of its own. Asserted so the absence is a finding rather than an oversight.
  assert.doesNotMatch(sheet, /fetch[A-Z]/);
});

test('the inventory above is complete', () => {
  /*
    The guard on this whole file. A board that grows a seventh read must add a row here and decide
    which of the three kinds it is — otherwise every assertion above still passes while the new
    read fails silently.
  */
  for (const [name, s] of [['progress', progress], ['breakdown', breakdown]] as const) {
    const found = new Set([...s.matchAll(/\b(fetch[A-Z]\w*\([^)]*\))/g)].map((m) => m[1]));
    const known = new Set<string>(READS.filter((r) => r.board === name).map((r) => r.call));
    for (const call of found) {
      assert.ok(known.has(call), `${name} reads ${call}, which is not in the inventory`);
    }
    assert.equal(found.size, known.size, `${name}: inventory lists a read the board does not make`);
  }
});
