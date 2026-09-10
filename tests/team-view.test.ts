/**
 * Regression tests for the team roster.
 *
 * This is the one screen in the app about OTHER PEOPLE, and that changes what a
 * mistake costs. A wrong number on your own board is annoying; a wrong flag here
 * sends a manager into a conversation with a rep about a problem that does not
 * exist.
 *
 * Three things are guarded:
 *
 *   - a rep still establishing a baseline is never flagged. There is nothing to
 *     have slipped from, and flagging them puts a manager on to someone whose
 *     only fault is being new.
 *   - "slipping" is against the rep's OWN recent months, never against the team.
 *     Copy that loses that turns a coaching prompt into a leaderboard.
 *   - a gated metric shows nothing, never zero. "0% conversion" reported for a
 *     rep with four calls is a false statement about a person.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTeamView, slippingNote } from '@/lib/team-view';
import type { MetricResult, TeamAgent, TeamResponse } from '@/types/backend';

const m = (value: number | null, over: Partial<MetricResult> = {}): MetricResult => ({
  value,
  sampleSize: 12,
  gated: value === null,
  sourceSessionIds: [],
  ...over,
});

const agent = (over: Partial<TeamAgent> = {}): TeamAgent =>
  ({
    agentId: 'a1',
    name: 'Sam Okafor',
    companyRole: 'rep',
    sessionCount: 20,
    firstSessionAt: '2026-06-01T09:00:00Z',
    establishingBaseline: false,
    conversionRate: m(38),
    relianceReduction: m(null),
    quotaAttainment: m(72),
    objectionsPerSession: m(2.1),
    objectionResolutionRate: m(64),
    recommendationUptake: m(50),
    followUpRate: m(40),
    salesCycleLength: m(9),
    slipping: false,
    slippingReasons: [],
    ...over,
  }) as TeamAgent;

const res = (agents: TeamAgent[]): TeamResponse => ({
  agents,
  alertDropPct: 20,
  monthlyQuotaTarget: 10,
});

const find = (v: ReturnType<typeof buildTeamView>, id: string) =>
  v.rows.find((r) => r.agentId === id);

/* ── the numbers ───────────────────────────────────────────────────────── */

test('a rep reads with their name and their figures', () => {
  const v = buildTeamView(res([agent()]));
  const row = find(v, 'a1')!;
  assert.equal(row.name, 'Sam Okafor');
  assert.equal(row.conversion.display, '38%');
  assert.equal(row.quota.display, '72%');
});

test('a nameless profile is still identifiable', () => {
  // A blank row in a list of people is unusable — a manager cannot act on it.
  const v = buildTeamView(res([agent({ name: null })]));
  assert.equal(find(v, 'a1')!.name, 'Unnamed rep');
});

test('a gated metric shows nothing, never zero', () => {
  // "0% conversion" for a rep with four calls is a false statement about a
  // person, and the kind a manager would act on.
  const v = buildTeamView(res([agent({ conversionRate: m(null, { sampleSize: 4 }) })]));
  const row = find(v, 'a1')!;
  assert.equal(row.conversion.display, null);
  assert.equal(row.conversion.building, true);
});

/* ── the slipping flag ─────────────────────────────────────────────────── */

test('a flagged rep is flagged, with plain reasons', () => {
  const v = buildTeamView(
    res([agent({ slipping: true, slippingReasons: ['conversion', 'quality'] })]),
  );
  const row = find(v, 'a1')!;
  assert.equal(row.slipping, true);
  assert.match(row.slippingNote!, /closing fewer.*call quality/);
});

test('the note says the comparison is against THEMSELVES', () => {
  // The difference between a coaching prompt and a leaderboard. A manager who
  // reads it as a ranking will use it as one.
  const note = slippingNote(agent({ slipping: true, slippingReasons: ['conversion'] }))!;
  assert.ok(note.includes('their own recent months'), note);
});

test('the note never carries a verdict on the person', () => {
  const words = ['underperform', 'bad', 'poor', 'weak', 'failing', 'lazy', 'worst'];
  const note = (
    slippingNote(agent({ slipping: true, slippingReasons: ['conversion', 'quality'] })) ?? ''
  ).toLowerCase();
  for (const w of words) assert.ok(!note.includes(w), `"${note}" contains "${w}"`);
});

test('a rep still establishing a baseline is NEVER flagged', () => {
  // There is nothing to have slipped from. Flagging them points a manager at
  // someone whose only fault is being new.
  const v = buildTeamView(
    res([
      agent({ establishingBaseline: true, slipping: true, slippingReasons: ['conversion'] }),
    ]),
  );
  const row = find(v, 'a1')!;
  assert.equal(row.slipping, false);
  assert.equal(row.slippingNote, null);
  assert.equal(row.establishingBaseline, true, 'but the manager can still see why');
});

test('a rep with no flag has no note', () => {
  assert.equal(buildTeamView(res([agent()])).rows[0].slippingNote, null);
});

/* ── ordering ──────────────────────────────────────────────────────────── */

test('flagged reps come first — that is why a manager opens this', () => {
  const v = buildTeamView(
    res([
      agent({ agentId: 'fine', name: 'A' }),
      agent({ agentId: 'flagged', name: 'B', slipping: true, slippingReasons: ['conversion'] }),
    ]),
  );
  assert.deepEqual(v.rows.map((r) => r.agentId), ['flagged', 'fine']);
});

test('everyone else keeps the order the server sent', () => {
  // That order is org rank, which the server chose deliberately.
  const v = buildTeamView(
    res([agent({ agentId: 'x' }), agent({ agentId: 'y' }), agent({ agentId: 'z' })]),
  );
  assert.deepEqual(v.rows.map((r) => r.agentId), ['x', 'y', 'z']);
});

test('the flagged count matches the flagged rows', () => {
  const v = buildTeamView(
    res([
      agent({ agentId: 'a', slipping: true, slippingReasons: ['conversion'] }),
      agent({ agentId: 'b', slipping: true, establishingBaseline: true, slippingReasons: ['conversion'] }),
      agent({ agentId: 'c' }),
    ]),
  );
  assert.equal(v.slippingCount, 1, 'the new rep is not counted');
  assert.equal(v.rows.filter((r) => r.slipping).length, 1);
});

test('an empty team is an empty roster rather than a crash', () => {
  const v = buildTeamView(res([]));
  assert.deepEqual(v.rows, []);
  assert.equal(v.slippingCount, 0);
});
