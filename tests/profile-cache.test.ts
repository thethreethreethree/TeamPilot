/**
 * The cache that now decides what a manager's KPI board opens on.
 *
 * It used to hold "the rep's own name between screens". Since the KPI board
 * reads the cached company role to decide whether to open on whole-company
 * figures, a cache that returned the WRONG person's profile would hand one rep
 * another's scope. That makes these tests worth having.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  clearCachedProfile,
  getCachedProfile,
  putCachedProfile,
  type Profile,
} from '@/lib/profile-cache';

const profile = (over: Partial<Profile> = {}): Profile => ({
  fullName: 'Ana',
  companyId: 'c1',
  companyRole: 'rep',
  salesCoachRole: 'agent',
  ...over,
});

test("one user never receives another user's cached profile", () => {
  // The whole point of keying it. A manager's cached role reaching a rep would
  // open their KPI board on the whole company's figures.
  clearCachedProfile();
  putCachedProfile('manager', profile({ companyRole: 'CEO' }));
  assert.equal(getCachedProfile('rep'), null, "a rep was handed the manager's profile");
  assert.equal(getCachedProfile('manager')?.companyRole, 'CEO');
});

test('signing out clears it, so the next person on the phone gets nothing', () => {
  clearCachedProfile();
  putCachedProfile('u1', profile());
  clearCachedProfile();
  assert.equal(getCachedProfile('u1'), null);
});

test('a second user replaces the first rather than accumulating', () => {
  // Only one profile is held. If the previous user's row survived, a sign-out
  // sweep that clears "the" profile would leave one behind.
  clearCachedProfile();
  putCachedProfile('u1', profile({ fullName: 'Ana' }));
  putCachedProfile('u2', profile({ fullName: 'Ben' }));
  assert.equal(getCachedProfile('u2')?.fullName, 'Ben');
  assert.equal(getCachedProfile('u1'), null, "the first user's profile survived");
});

test('an unknown user gets null rather than the last one cached', () => {
  clearCachedProfile();
  putCachedProfile('u1', profile());
  assert.equal(getCachedProfile('someone-else'), null);
  assert.equal(getCachedProfile(''), null);
});

test('a cached profile keeps every field it was given', () => {
  clearCachedProfile();
  const p = profile({ companyRole: 'COO', salesCoachRole: null, companyId: 'c9' });
  putCachedProfile('u1', p);
  assert.deepEqual(getCachedProfile('u1'), p);
});
