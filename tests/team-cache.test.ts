/**
 * Regression tests for the cached team roster.
 *
 * This is the only thing this app stores about OTHER PEOPLE, and the only cache
 * whose staleness costs a conversation rather than a misread number. A "slipping"
 * flag from this morning, acted on this afternoon, means telling a rep who has
 * already turned it around that they are behind — and no later refresh takes
 * that back.
 *
 * So two things are guarded that the other caches do not need: a short window,
 * and the fact that it is swept on sign-out because the next person to hold the
 * phone must not find a roster of their colleagues' performance.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCachedTeam, writeCachedTeam, clearCachedTeam } from '@/lib/sync/team-cache';
import type { TeamResponse } from '@/types/backend';

const res = (over: Partial<TeamResponse> = {}): TeamResponse =>
  ({
    agents: [
      {
        agentId: 'a1',
        name: 'Sam Okafor',
        companyRole: 'rep',
        sessionCount: 20,
        firstSessionAt: '2026-06-01T09:00:00Z',
        establishingBaseline: false,
        conversionRate: { value: 38, sampleSize: 20, gated: false, sourceSessionIds: [] },
        relianceReduction: { value: null, sampleSize: 0, gated: true, sourceSessionIds: [] },
        quotaAttainment: { value: 72, sampleSize: 20, gated: false, sourceSessionIds: [] },
        objectionsPerSession: { value: 2, sampleSize: 20, gated: false, sourceSessionIds: [] },
        objectionResolutionRate: { value: 60, sampleSize: 20, gated: false, sourceSessionIds: [] },
        recommendationUptake: { value: 50, sampleSize: 20, gated: false, sourceSessionIds: [] },
        followUpRate: { value: 40, sampleSize: 20, gated: false, sourceSessionIds: [] },
        salesCycleLength: { value: 9, sampleSize: 20, gated: false, sourceSessionIds: [] },
        slipping: false,
        slippingReasons: [],
      },
    ],
    alertDropPct: 20,
    monthlyQuotaTarget: 10,
    ...over,
  }) as TeamResponse;

const KEY = 'team.v1.mgr-1';

async function ageBy(ms: number) {
  const stored = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
  stored.at = new Date(Date.now() - ms).toISOString();
  await AsyncStorage.setItem(KEY, JSON.stringify(stored));
}

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('a roster comes back with the time it was fetched', async () => {
  await writeCachedTeam('mgr-1', res());
  const got = await readCachedTeam('mgr-1');
  assert.equal(got?.res.agents.length, 1);
  assert.ok(got && !Number.isNaN(got.at.getTime()), 'the age is recorded and readable');
});

test('a copy a few hours old is still served', async () => {
  // A manager between calls should not be refused a roster they saw at lunch.
  await writeCachedTeam('mgr-1', res());
  await ageBy(4 * 60 * 60 * 1000);
  assert.ok(await readCachedTeam('mgr-1'));
});

test('a copy older than six hours is refused, and dropped from disk', async () => {
  // Shorter than every other cache here on purpose: acting on a stale flag means
  // telling a rep who has already recovered that they are behind.
  await writeCachedTeam('mgr-1', res());
  await ageBy(7 * 60 * 60 * 1000);

  assert.equal(await readCachedTeam('mgr-1'), null);
  assert.equal(await AsyncStorage.getItem(KEY), null, 'removed, not left to be found later');
});

test('a day-old roster is NOT served, unlike the KPI board', async () => {
  // The board's window is a day. Copying it here would be the mistake this
  // cache exists to avoid.
  await writeCachedTeam('mgr-1', res());
  await ageBy(23 * 60 * 60 * 1000);
  assert.equal(await readCachedTeam('mgr-1'), null);
});

test('one manager never sees another manager roster', async () => {
  await writeCachedTeam('mgr-1', res());
  assert.equal(await readCachedTeam('mgr-2'), null);
});

test('sign-out clears it — it holds colleagues figures', async () => {
  await writeCachedTeam('mgr-1', res());
  await clearCachedTeam('mgr-1');
  assert.equal(await readCachedTeam('mgr-1'), null);
});

test('sign-out leaves the other manager on a shared phone alone', async () => {
  await writeCachedTeam('mgr-1', res());
  await writeCachedTeam('mgr-2', res({ alertDropPct: 30 }));

  await clearCachedTeam('mgr-1');

  assert.equal(await readCachedTeam('mgr-1'), null);
  assert.equal((await readCachedTeam('mgr-2'))?.res.alertDropPct, 30);
});

test('a corrupt entry reads as absent rather than throwing', async () => {
  await AsyncStorage.setItem(KEY, '{ truncated');
  assert.equal(await readCachedTeam('mgr-1'), null);
});

test('an entry with no agents list is refused', async () => {
  // An empty roster would read as "you have no team" rather than as "this could
  // not be loaded".
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ res: { alertDropPct: 20 }, at: new Date().toISOString() }),
  );
  assert.equal(await readCachedTeam('mgr-1'), null);
});

test('sign-out leaves the other on-device stores alone', async () => {
  await AsyncStorage.setItem('trend.v1.mgr-1', '{"res":{"metrics":[]},"at":"now"}');
  await writeCachedTeam('mgr-1', res());

  await clearCachedTeam('mgr-1');

  assert.equal(await AsyncStorage.getItem('trend.v1.mgr-1'), '{"res":{"metrics":[]},"at":"now"}');
});
