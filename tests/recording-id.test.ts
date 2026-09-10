/**
 * The id that keeps a retried upload from becoming a second recording.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { newClientId } from '@/lib/audio/recording-id';

test('two recordings started in the same millisecond still differ', () => {
  // THE property that matters. The time component alone cannot separate two
  // starts inside one tick, so the random suffix is what prevents two calls
  // being de-duplicated into one. Freezing the clock proves it is load-bearing.
  const realNow = Date.now;
  Date.now = () => 1_700_000_000_000;
  try {
    const ids = new Set(Array.from({ length: 2000 }, () => newClientId()));
    assert.equal(ids.size, 2000, 'ids collided within a single millisecond');
  } finally {
    Date.now = realNow;
  }
});

test('ids are unique across many calls', () => {
  const ids = new Set(Array.from({ length: 5000 }, () => newClientId()));
  assert.equal(ids.size, 5000);
});

test('an id is prefixed and shaped so it is recognisable in a log', () => {
  const id = newClientId();
  assert.match(id, /^rec_[0-9a-z]+_[0-9a-z]{1,8}$/);
  assert.ok(id.startsWith('rec_'));
});

test('the id sorts by start time, so the oldest unsent recording is findable', () => {
  const realNow = Date.now;
  Date.now = () => 1_700_000_000_000;
  const earlier = newClientId();
  Date.now = () => 1_700_000_001_000;
  const later = newClientId();
  Date.now = realNow;
  // base36 of a larger millisecond value is longer-or-greater, so the time
  // segment orders correctly for ids generated on the same device.
  const seg = (s: string) => s.split('_')[1];
  assert.ok(seg(earlier) < seg(later), `${seg(earlier)} should sort before ${seg(later)}`);
});
