/**
 * Regression tests for the cached KPI figures.
 *
 * The danger here is specific and it is not a crash: a number that is stale but
 * looks current. A rep who reads "conversion rate 38%" has no way to tell it was
 * true yesterday, and will act on it. So the two things that must hold are that
 * a stale entry is REFUSED rather than served, and that anything served comes
 * back with the time it was true so the screen can say so.
 *
 * The third is scope. An admin's company view and their own view are different
 * answers to different questions; showing one in place of the other would be
 * wrong in a way nobody would notice.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCachedKpi, writeCachedKpi, clearCachedKpi } from '@/lib/sync/kpi-cache';
import type { KpiResponse } from '@/types/backend';

const res = (over: Partial<KpiResponse> = {}): KpiResponse =>
  ({
    sessionCount: 12,
    minSessions: 5,
    scope: 'self',
    metrics: {
      conversionRate: { value: 38, sampleSize: 12, gated: false, sourceSessionIds: [] },
    },
    deltas: {},
    sessions: {},
    ...over,
  }) as KpiResponse;

/** Rewrite a stored entry's timestamp rather than waiting out the real clock. */
async function ageBy(key: string, ms: number) {
  const stored = JSON.parse((await AsyncStorage.getItem(key)) as string);
  stored.at = new Date(Date.now() - ms).toISOString();
  await AsyncStorage.setItem(key, JSON.stringify(stored));
}

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('figures come back with the time they were true', async () => {
  await writeCachedKpi('rep-1', 'self', res());
  const got = await readCachedKpi('rep-1', 'self');
  assert.equal(got?.res.metrics.conversionRate.value, 38);
  assert.ok(got && !Number.isNaN(got.at.getTime()), 'the age is recorded and readable');
});

test('nothing cached reads as absent', async () => {
  assert.equal(await readCachedKpi('rep-1', 'self'), null);
});

test('figures older than a day are refused, and dropped from disk', async () => {
  // A conversion rate goes out of date with every call a rep makes. A day is
  // context; more than that quietly misleads.
  await writeCachedKpi('rep-1', 'self', res());
  const key = 'kpi.v1.rep-1.self';
  await ageBy(key, 25 * 60 * 60 * 1000);

  assert.equal(await readCachedKpi('rep-1', 'self'), null);
  assert.equal(await AsyncStorage.getItem(key), null, 'removed, not left to be found later');
});

test('figures just under a day old still come back', async () => {
  await writeCachedKpi('rep-1', 'self', res());
  await ageBy('kpi.v1.rep-1.self', 23 * 60 * 60 * 1000);
  assert.equal((await readCachedKpi('rep-1', 'self'))?.res.sessionCount, 12);
});

test('the company view is never served in place of your own', async () => {
  // Different questions, different answers. Serving one for the other would be
  // wrong in a way nobody would spot.
  await writeCachedKpi('rep-1', 'company', res({ scope: 'company', sessionCount: 400 }));
  assert.equal(await readCachedKpi('rep-1', 'self'), null);
  assert.equal((await readCachedKpi('rep-1', 'company'))?.res.sessionCount, 400);
});

test('one rep never sees another rep figures', async () => {
  await writeCachedKpi('rep-1', 'self', res());
  assert.equal(await readCachedKpi('rep-2', 'self'), null);
});

test('a corrupt entry reads as absent rather than throwing', async () => {
  await AsyncStorage.setItem('kpi.v1.rep-1.self', '{ truncated');
  assert.equal(await readCachedKpi('rep-1', 'self'), null);
});

test('an entry with no metrics is refused', async () => {
  // A board of empty rows reads as "you have no numbers", which is a different
  // claim from "these could not be loaded".
  await AsyncStorage.setItem(
    'kpi.v1.rep-1.self',
    JSON.stringify({ res: { sessionCount: 3 }, at: new Date().toISOString() }),
  );
  assert.equal(await readCachedKpi('rep-1', 'self'), null);
});

test('an entry with an unparseable timestamp is refused', async () => {
  await AsyncStorage.setItem(
    'kpi.v1.rep-1.self',
    JSON.stringify({ res: res(), at: 'sometime' }),
  );
  assert.equal(await readCachedKpi('rep-1', 'self'), null);
});

test('sign-out clears every scope for that rep', async () => {
  await writeCachedKpi('rep-1', 'self', res());
  await writeCachedKpi('rep-1', 'company', res({ scope: 'company' }));

  await clearCachedKpi('rep-1');

  assert.equal(await readCachedKpi('rep-1', 'self'), null);
  assert.equal(await readCachedKpi('rep-1', 'company'), null);
});

test('sign-out leaves the other rep on a shared phone alone', async () => {
  await writeCachedKpi('rep-1', 'self', res());
  await writeCachedKpi('rep-2', 'self', res({ sessionCount: 99 }));

  await clearCachedKpi('rep-1');

  assert.equal(await readCachedKpi('rep-1', 'self'), null);
  assert.equal((await readCachedKpi('rep-2', 'self'))?.res.sessionCount, 99);
});

test('sign-out leaves the other on-device stores alone', async () => {
  await AsyncStorage.setItem('sessions.v1.rep-1', '{"rows":[],"at":"now"}');
  await AsyncStorage.setItem('recordings.v1.rep-1', '[]');
  await writeCachedKpi('rep-1', 'self', res());

  await clearCachedKpi('rep-1');

  assert.equal(await AsyncStorage.getItem('sessions.v1.rep-1'), '{"rows":[],"at":"now"}');
  assert.equal(await AsyncStorage.getItem('recordings.v1.rep-1'), '[]');
});

test('a newer answer replaces the older one', async () => {
  await writeCachedKpi('rep-1', 'self', res({ sessionCount: 12 }));
  await writeCachedKpi('rep-1', 'self', res({ sessionCount: 13 }));
  assert.equal((await readCachedKpi('rep-1', 'self'))?.res.sessionCount, 13);
});
