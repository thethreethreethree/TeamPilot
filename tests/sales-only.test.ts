/**
 * The app's sales-call rule must match the website's, input for input.
 *
 * The website's isSalesCall defers to resolveCoachingMode: "meeting" and "huddle" are not sales calls; "sales", a
 * missing kind and any unknown kind are. These are the same inputs its own test pins
 * (TeamPilot src/lib/coach/v5/__tests__/salesOnly.test.ts). If the website's rule changes, this table changes with it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isSalesCall, sessionKindName } from '@/lib/sales-only';

const WEBSITE_VERDICT: [string | null | undefined, boolean][] = [
  ['sales', true],
  ['meeting', false],
  ['huddle', false],
  [null, true],
  [undefined, true],
  ['', true],
  ['webinar', true],
];

for (const [kind, expected] of WEBSITE_VERDICT) {
  test(`isSalesCall(${JSON.stringify(kind)}) matches the website: ${expected}`, () => {
    assert.equal(isSalesCall(kind), expected);
  });
}

test('a non-sales session is named by its kind', () => {
  assert.equal(sessionKindName('huddle'), 'huddle');
  assert.equal(sessionKindName('meeting'), 'meeting');
});
