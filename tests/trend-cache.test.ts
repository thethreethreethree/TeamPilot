/**
 * Regression tests for the cached trend.
 *
 * The rule worth guarding is the one that differs from every other cache in this
 * app: these months are FROZEN. A month is sealed when it ends and cannot change
 * afterwards, so a week-old copy is not a week out of date — it is exactly right
 * for every month except possibly the current one. Copying the KPI board's
 * 24-hour window here would throw away a correct answer every day and leave a
 * rep offline staring at nothing.
 *
 * What can still go wrong is the newest month, which is why the age is stored
 * and said on screen.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCachedTrend, writeCachedTrend, clearCachedTrend } from '@/lib/sync/trend-cache';
import type { TrajectoryResponse } from '@/types/backend';

const res = (over: Partial<TrajectoryResponse> = {}): TrajectoryResponse => ({
  building: false,
  monthsCovered: 3,
  metrics: [
    {
      metric: 'conversionRate',
      layer: 1,
      points: [{ period: '2026-01', value: 29, sampleSize: 10 }],
      latest: 29,
      previous: null,
      delta: null,
      monthsWithData: 1,
    },
  ],
  ...over,
});

const KEY = 'trend.v1.rep-1';

/** Age a stored entry rather than waiting out the real clock. */
async function ageBy(ms: number) {
  const stored = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
  stored.at = new Date(Date.now() - ms).toISOString();
  await AsyncStorage.setItem(KEY, JSON.stringify(stored));
}

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('a trend comes back with the time it was fetched', async () => {
  await writeCachedTrend('rep-1', res());
  const got = await readCachedTrend('rep-1');
  assert.equal(got?.res.monthsCovered, 3);
  assert.ok(got && !Number.isNaN(got.at.getTime()), 'the age is recorded and readable');
});

test('nothing cached reads as absent', async () => {
  assert.equal(await readCachedTrend('rep-1'), null);
});

test('a copy days old is still served, because frozen months do not drift', async () => {
  // The distinction from the KPI cache. A day-old conversion rate is stale; a
  // day-old January is January.
  await writeCachedTrend('rep-1', res());
  await ageBy(3 * 24 * 60 * 60 * 1000);
  assert.equal((await readCachedTrend('rep-1'))?.res.monthsCovered, 3);
});

test('a copy just under a week old still comes back', async () => {
  await writeCachedTrend('rep-1', res());
  await ageBy(6 * 24 * 60 * 60 * 1000);
  assert.ok(await readCachedTrend('rep-1'));
});

test('a copy older than a week is refused, and dropped from disk', async () => {
  // Past this, enough months have likely closed that the shape itself is wrong.
  await writeCachedTrend('rep-1', res());
  await ageBy(8 * 24 * 60 * 60 * 1000);

  assert.equal(await readCachedTrend('rep-1'), null);
  assert.equal(await AsyncStorage.getItem(KEY), null, 'removed, not left to be found later');
});

test('one rep never sees another rep months', async () => {
  await writeCachedTrend('rep-1', res());
  assert.equal(await readCachedTrend('rep-2'), null);
});

test('a corrupt entry reads as absent rather than throwing', async () => {
  await AsyncStorage.setItem(KEY, '{ truncated');
  assert.equal(await readCachedTrend('rep-1'), null);
});

test('an entry with no metrics list is refused', async () => {
  // An empty trend would read as "you have no history" rather than as "this
  // could not be loaded" — a different claim, and a discouraging one.
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ res: { building: false, monthsCovered: 2 }, at: new Date().toISOString() }),
  );
  assert.equal(await readCachedTrend('rep-1'), null);
});

test('an entry with an unparseable timestamp is refused', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify({ res: res(), at: 'sometime' }));
  assert.equal(await readCachedTrend('rep-1'), null);
});

test('sign-out clears it', async () => {
  await writeCachedTrend('rep-1', res());
  await clearCachedTrend('rep-1');
  assert.equal(await readCachedTrend('rep-1'), null);
});

test('sign-out leaves the other rep on a shared phone alone', async () => {
  await writeCachedTrend('rep-1', res());
  await writeCachedTrend('rep-2', res({ monthsCovered: 9 }));

  await clearCachedTrend('rep-1');

  assert.equal(await readCachedTrend('rep-1'), null);
  assert.equal((await readCachedTrend('rep-2'))?.res.monthsCovered, 9);
});

test('sign-out leaves the other on-device stores alone', async () => {
  await AsyncStorage.setItem('kpi.v1.rep-1.self', '{"res":{"metrics":{}},"at":"now"}');
  await writeCachedTrend('rep-1', res());

  await clearCachedTrend('rep-1');

  assert.equal(await AsyncStorage.getItem('kpi.v1.rep-1.self'), '{"res":{"metrics":{}},"at":"now"}');
});
