/**
 * A manager opening their own sparse figures is the thing this prevents.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { COMPANY_SCOPE_ROLES, openingScope } from '@/lib/kpi-scope';

test('a manager opens on the whole-company figures', () => {
  // The website changed to this deliberately: a per-rep view stays mostly
  // "building" because outcomes are sparse per rep, while the pooled business
  // numbers are real today.
  for (const role of COMPANY_SCOPE_ROLES) {
    assert.equal(openingScope(role), 'company', `role ${role}`);
  }
});

test('a rep opens on their own figures', () => {
  assert.equal(openingScope('rep'), 'self');
  assert.equal(openingScope('sales'), 'self');
});

test('an unknown or unreadable role opens on self, never company', () => {
  // Asking for figures the account cannot see spends a request whose only
  // purpose is to be refused — which is exactly what this avoids.
  assert.equal(openingScope(null), 'self');
  assert.equal(openingScope(undefined), 'self');
  assert.equal(openingScope(''), 'self');
});

test('the role set matches the website', () => {
  assert.deepEqual([...COMPANY_SCOPE_ROLES], ['CEO', 'CFO', 'COO', 'admin']);
});
