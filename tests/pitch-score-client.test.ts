/**
 * The Pitch Score client must stay a READER.
 *
 * WHY THIS TEST AND NOT A TYPE TEST. Types already compile; that proves nothing about the failure
 * this file exists for. The web build's own register records four duplicated decisions found in a
 * single day — a manager predicate, a lowest-section helper, a score band, a band table — and says
 * what they had in common: every one was CORRECT on the day it was written. A duplicate is never
 * wrong when you write it. One of them put 95 on a page reading Elite in the gauge and Strong in
 * the card beneath it.
 *
 * A phone-side copy would be the worst instance of that class, because the two implementations
 * would sit on different devices and nobody would ever see them disagree.
 *
 * So this sweeps the client for arithmetic rather than asserting a value. It is a test about what
 * the module must NOT grow.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MILESTONE_KEYS } from '@/lib/pitch-score/types';
import {
  PERIODS,
  PERIOD_LABELS,
  DEFAULT_PERIOD,
  isPeriod,
  periodHonoured,
  periodSubstituted,
} from '@/lib/pitch-score/period';
import type { BreakdownResponse, LeaderboardResponse } from '@/lib/pitch-score/types';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
/** Comments quote the very things these assertions forbid, so they are stripped first. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const api = code(read('src/lib/pitch-score/api.ts'));
const types = code(read('src/lib/pitch-score/types.ts'));

test('the client computes nothing — it only fetches', () => {
  /*
    No averaging, no summing, no banding, no comparison that could become a threshold. If one of
    these ever has to appear, it belongs on the server beside the aggregate that already produces
    every other number on these boards.
  */
  for (const forbidden of [/\breduce\(/, /\bMath\.(round|min|max|abs)\b/, /\/\s*length\b/, />=\s*\d/]) {
    assert.doesNotMatch(api, forbidden, `the read client must not compute: ${forbidden}`);
  }
  assert.doesNotMatch(types, /\bfunction\b/, 'the types module must hold no logic at all');
});

test('it reads, and never writes', () => {
  // The phone writes nothing in this revision: disputes, overrides and comments are web surfaces.
  assert.doesNotMatch(api, /coachPost|coachPatch|method:\s*['"]POST/);
  assert.match(api, /coachGet</);
});

test('the three routes are the deployed ones, spelled exactly', () => {
  // A typo here is a 404 that renders as "could not load", which reads to a rep as their own data
  // being missing rather than as a wrong path.
  assert.match(api, /'\/api\/coach\/sales-session\/pitch-score'/);
  for (const leaf of ['/breakdown?period=', '/leaderboard?period=', '/milestones']) {
    assert.ok(api.includes(leaf), `missing route leaf ${leaf}`);
  }
});

test('the period is carried in the URL, not remembered per board', () => {
  // Guide Step 2: "The period selection carries across Progress and Breakdown." Two boards reading
  // different periods would disagree while a rep switched between them.
  assert.deepEqual([...PERIODS], ['day', 'week', 'month', 'all']);
  assert.match(api, /encodeURIComponent\(period\)/);
});

test('a rep-shaped response round-trips with the position fields absent', () => {
  /*
    THE SHAPE THE RULING PRODUCES. `rank` and `boardSize` never leave the server for a rep, and
    `gaps.ahead` arrives null. This asserts the type admits that shape — so a component written
    against it must branch on PRESENCE, which is what makes a wrong role flag unable to invent a
    rank out of nothing.
  */
  const repView: LeaderboardResponse = {
    period: 'week',
    managerView: false,
    standing: {
      repId: 'r1',
      total_points: 1445,
      counted: 18,
      pitchesTotal: 23,
      avgPitchScore: 80.3,
      bestPitchScore: 106.5,
      prizeEligible: true,
    },
    gaps: { behind: 62, ahead: null },
    skippedPreVerdict: 0,
    capped: false,
  };
  assert.equal(repView.rank, undefined);
  assert.equal(repView.boardSize, undefined);
  assert.equal(repView.gaps.ahead, null);
  assert.equal(repView.gaps.behind, 62);
});

test('the aggregate carries the reasons a pitch was not counted', () => {
  /*
    Qualification is judged on BASE; the list displays TOTAL. So two rows can show near-identical
    numbers with opposite counted status — the mockup has a 44.0 labelled "Not counted" — and
    nothing on screen explains it unless the reasons are rendered. Typed as required, not optional,
    so a board cannot quietly omit them.
  */
  const agg: BreakdownResponse['aggregate']['notCountedReasons'] = {
    did_not_reach_discovery: 3,
    base_under_40: 2,
  };
  assert.equal(Object.values(agg).reduce((a, b) => a + b, 0), 5);
});

test('the six milestone keys are the sheet’s, in the sheet’s order', () => {
  assert.deepEqual(
    [...MILESTONE_KEYS],
    ['firstPitch', 'tripleDigits', 'inTheDoor', 'fullBundle', 'cleanSweep', 'century'],
  );
});

test('the period union is declared ONCE, not in both modules', () => {
  /*
    It was declared twice for about ten minutes — in `types.ts` and again in `period.ts` — inside
    the pair of files whose own docblocks warn about duplicated decisions. The two copies agreed,
    which is the property that makes this class invisible. `types.ts` now re-exports.
  */
  assert.doesNotMatch(types, /PERIODS = \[/, 'the union belongs to period.ts alone');
  assert.match(code(read('src/lib/pitch-score/period.ts')), /export const PERIODS = \[/);
});

test('the wire values are the server’s, and All time is not all_time', () => {
  /*
    THE LIVE HAZARD. This app already exports a period vocabulary from `lib/doors/metrics-view.ts`
    whose fourth key is `all_time`. The Pitch Score API's is `all`. The breakdown route does not
    reject an unknown value — it SILENTLY returns this week — so wiring the existing toggle to
    these routes would caption seven days of work as 'All time' with nothing on screen wrong.
  */
  assert.deepEqual([...PERIODS], ['day', 'week', 'month', 'all']);
  assert.equal(PERIOD_LABELS.all, 'All time');
  assert.ok(!(PERIODS as readonly string[]).includes('all_time'));
  // The default matches the route's own fallback, so first paint and server cannot disagree.
  assert.equal(DEFAULT_PERIOD, 'week');
});

test('a substituted period is caught rather than labelled', () => {
  assert.equal(periodHonoured('all', { period: 'all' }), true);
  // The exact substitution the route performs on an unrecognised value.
  assert.equal(periodHonoured('all', { period: 'week' }), false);
  assert.match(periodSubstituted('all', { period: 'week' }), /week figures, not all time/i);
});

test('a server that echoes nothing reads as NOT honoured', () => {
  /*
    Silence is indistinguishable from substitution from this side, and between the two readings the
    cautious one costs a caption while the trusting one costs a wrong number.
  */
  assert.equal(periodHonoured('week', {}), false);
  assert.equal(periodHonoured('week', null), false);
  assert.match(periodSubstituted('week', {}), /did not say which period/i);
});

test('isPeriod refuses the door vocabulary', () => {
  assert.equal(isPeriod('all'), true);
  assert.equal(isPeriod('all_time'), false);
  assert.equal(isPeriod(undefined), false);
});
