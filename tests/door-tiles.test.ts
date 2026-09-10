/**
 * Regression tests for the door counts on the macro home.
 *
 * THE BUG: `waiting.total + (totals?.doorsKnocked ?? 0)`.
 *
 * A rep knocks forty doors and every one reaches the server. Next morning they
 * open the app somewhere with no signal, the totals fetch returns null, and the
 * tile reads "0 DOORS TODAY" — the app telling somebody their work did not
 * happen, in a form indistinguishable from a real zero.
 *
 * This is the fourth instance of the shape in this app. The other three are
 * guarded in home-view.ts (the failed load rendering as 0), skills-view.ts (a D
 * for a skill nobody measured) and topic-line.ts (`messages ?? 0`).
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDoorTiles } from '@/lib/doors/door-tiles';

const W = (total: number, sold = 0, goBack = 0) => ({ total, sold, goBack });
const S = (doorsKnocked: number, sold = 0, goBacks = 0) => ({ doorsKnocked, sold, goBacks });
const val = (r: ReturnType<typeof buildDoorTiles>, k: string) =>
  r.tiles.find((t) => t.key === k)!;

test('a failed totals read NEVER renders as zero', () => {
  // The whole point. Nothing is known, so nothing is claimed.
  const r = buildDoorTiles({ waiting: W(0), totals: null });
  assert.equal(val(r, 'doors').value, '—');
  assert.equal(val(r, 'sold').value, '—');
  assert.equal(val(r, 'goBacks').value, '—');
  assert.equal(r.anyPartial, true);
});

test('a failed read with doors on the phone shows those, marked as a floor', () => {
  // "6" is true — they are holding six. It is just not the whole day.
  const r = buildDoorTiles({ waiting: W(6, 1, 2), totals: null });
  assert.equal(val(r, 'doors').value, '6');
  assert.equal(val(r, 'doors').partial, true);
  assert.match(val(r, 'doors').spoken, /at least 6/);
  assert.match(val(r, 'doors').spoken, /could not be counted/);
});

test('a real zero is a real zero, and says nothing about a failure', () => {
  // The server answered: the day genuinely has not started.
  const r = buildDoorTiles({ waiting: W(0), totals: S(0) });
  assert.equal(val(r, 'doors').value, '0');
  assert.equal(val(r, 'doors').partial, false);
  assert.equal(r.anyPartial, false);
});

test('phone and server are added when both are known', () => {
  const r = buildDoorTiles({ waiting: W(3, 1, 2), totals: S(40, 5, 9) });
  assert.equal(val(r, 'doors').value, '43');
  assert.equal(val(r, 'sold').value, '6');
  assert.equal(val(r, 'goBacks').value, '11');
  assert.equal(r.anyPartial, false);
});

test('a floor is never emphasised', () => {
  // Outlining a number that is not the answer draws the eye to the wrong thing.
  const r = buildDoorTiles({ waiting: W(4, 2, 1), totals: null });
  assert.equal(val(r, 'sold').emphasis, false);
});

test('a real sale IS emphasised, and a zero is not', () => {
  assert.equal(val(buildDoorTiles({ waiting: W(1, 1), totals: S(0) }), 'sold').emphasis, true);
  assert.equal(val(buildDoorTiles({ waiting: W(1, 0), totals: S(0) }), 'sold').emphasis, false);
});

test('anyPartial is false only when every tile is a true total', () => {
  assert.equal(buildDoorTiles({ waiting: W(2, 1, 1), totals: S(1, 1, 1) }).anyPartial, false);
  assert.equal(buildDoorTiles({ waiting: W(2, 1, 1), totals: null }).anyPartial, true);
});

test('all three tiles are always present, in a stable order', () => {
  const r = buildDoorTiles({ waiting: W(0), totals: null });
  assert.deepEqual(r.tiles.map((t) => t.key), ['doors', 'goBacks', 'sold']);
});

test("a season's worth of doors is grouped, not run together as digits", () => {
  // A working rep passes a thousand doors within a month. "12500" here beside
  // the Arena's "12,500" is one number written two ways, two taps apart.
  const r = buildDoorTiles({ waiting: W(0), totals: S(12500, 1200, 3400) });
  assert.equal(val(r, 'doors').value, '12,500');
});

test('the local-only count is grouped the same way', () => {
  // The partial figure is the rep's own queue, and it must not switch format
  // when it happens to be the number on screen.
  const r = buildDoorTiles({ waiting: W(1500), totals: null });
  assert.equal(val(r, 'doors').value, '1,500');
  assert.equal(val(r, 'doors').partial, true);
});
