/**
 * Regression tests for day-grouping on the session list.
 *
 * The reason these exist: the first version built a LOCAL calendar day key and
 * then labelled it by appending "T00:00:00Z", parsing a local key as UTC. East
 * of Greenwich that is harmless, so it passed on the machine it was written on
 * (UTC+8). At UTC-5 it labelled 28 August as "Thu 27 Aug" — every older group
 * showing the wrong day for every rep in the Americas.
 *
 * So the timezone case below is not decoration. Run the suite under a western
 * zone as well as a local one:
 *
 *   npm test
 *   TZ=PST8PDT npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupByDay, dayKey } from '@/lib/group-sessions';
import type { CoachingSession } from '@/types/backend';

/** Built in LOCAL time, so the fixtures mean the same thing in every timezone. */
const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).toISOString();

const NOW = new Date(2026, 8, 2, 14, 0); // 2 September 2026, 14:00 local

const session = (
  id: string,
  started_at: string,
  client_label: string | null,
  outcome: CoachingSession['outcome'] = 'sold',
): CoachingSession =>
  ({
    id,
    started_at,
    client_label,
    outcome,
    audio_duration_seconds: null,
    deal_value: null,
  }) as CoachingSession;

const rows: CoachingSession[] = [
  session('a', at(2026, 9, 2, 13, 10), 'Blue house on Elm'),
  session('b', at(2026, 9, 2, 9, 30), 'Corner shop', 'no_sale'),
  session('c', at(2026, 9, 1, 16, 0), 'Mrs Patel', 'follow_up'),
  session('d', at(2026, 8, 28, 11, 0), null),
];

const idsFor = (query: string) =>
  groupByDay(rows, query, NOW).flatMap((s) => s.data.map((r) => r.id));

test('groups into one section per calendar day, newest first', () => {
  const g = groupByDay(rows, '', NOW);
  assert.equal(g.length, 3);
  assert.equal(g[0].title, 'Today');
  assert.equal(g[1].title, 'Yesterday');
});

test('an older day is labelled with its OWN date, in every timezone', () => {
  // The bug this file exists for. Under TZ=PST8PDT the old code said "Thu 27 Aug".
  const g = groupByDay(rows, '', NOW);
  assert.equal(g[2].title, 'Fri 28 Aug');
});

test('keeps the order the query returned within a day', () => {
  const g = groupByDay(rows, '', NOW);
  assert.deepEqual(
    g[0].data.map((r) => r.id),
    ['a', 'b'],
  );
});

test('search matches the client label, case-insensitively', () => {
  assert.deepEqual(idsFor('elm'), ['a']);
  assert.deepEqual(idsFor('MRS'), ['c']);
});

test('search also matches the outcome, as a rep would say it', () => {
  assert.deepEqual(idsFor('no sale'), ['b']);
});

test('search survives a session with no label', () => {
  // Row "d" has client_label: null — the crash this guards against.
  assert.deepEqual(idsFor('house'), ['a']);
  assert.equal(idsFor('').length, 4);
});

test('no match yields no sections, not an empty section', () => {
  assert.deepEqual(groupByDay(rows, 'zzzz', NOW), []);
});

test('an unparseable date is bucketed honestly, never dropped', () => {
  // Losing a rep's session because its timestamp was odd would be the worse bug.
  assert.equal(dayKey('not-a-date'), 'unknown');
  const g = groupByDay([session('z', 'nope', 'Bad row')], '', NOW);
  assert.equal(g[0].title, 'Undated');
  assert.equal(g[0].data.length, 1);
});

test('no sessions yields no sections', () => {
  assert.deepEqual(groupByDay([], '', NOW), []);
});

/* ── searching what the rep typed about a call ─────────────────────────── */

const withContext = (over: Partial<CoachingSession>): CoachingSession =>
  ({
    id: 'x',
    client_label: 'Rowan & Co',
    started_at: '2026-09-02T10:00:00Z',
    outcome: 'sold',
    territory: null,
    approach: null,
    offer: null,
    ...over,
  }) as CoachingSession;

const found = (rows: CoachingSession[], q: string) =>
  groupByDay(rows, q, new Date('2026-09-02T12:00:00Z')).flatMap((s) => s.data);

test('search finds a call by its territory', () => {
  // The rep typed "Northside" into this call themselves. Not finding it by that
  // word made their own answers unfindable.
  const rows = [withContext({ id: 'a', territory: 'Northside' }), withContext({ id: 'b' })];
  assert.deepEqual(found(rows, 'northside').map((r) => r.id), ['a']);
});

test('search finds a call by how it was approached', () => {
  const rows = [withContext({ id: 'a', approach: 'Referral from next door' }), withContext({ id: 'b' })];
  assert.deepEqual(found(rows, 'referral').map((r) => r.id), ['a']);
});

test('search finds a call by what was offered', () => {
  const rows = [withContext({ id: 'a', offer: 'Annual plan with install' }), withContext({ id: 'b' })];
  assert.deepEqual(found(rows, 'annual').map((r) => r.id), ['a']);
});

test('the label and outcome still match, as they always did', () => {
  const rows = [withContext({ id: 'a', client_label: 'Rowan & Co' }), withContext({ id: 'b', client_label: 'Someone else', outcome: 'no_sale' })];
  assert.deepEqual(found(rows, 'rowan').map((r) => r.id), ['a']);
  assert.deepEqual(found(rows, 'no sale').map((r) => r.id), ['b']);
});

test('a session with no context is not matched by an empty field', () => {
  // Every context field is null here. A naive implementation that treated null
  // as an empty string matching everything would return every call for any
  // query — which reads as search being broken.
  const rows = [withContext({ id: 'a' })];
  assert.deepEqual(found(rows, 'northside'), []);
});

test('an empty query still returns everything', () => {
  const rows = [withContext({ id: 'a' }), withContext({ id: 'b' })];
  assert.equal(found(rows, '').length, 2);
});
