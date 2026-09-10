/**
 * The Home menu, and the one thing about it that is not a matter of taste.
 *
 * Account is the only route to SIGN OUT, and sign-out is this app's security boundary on a shared phone. That
 * destination has now moved twice for good reasons — hidden in Macro Mode to mirror the website, then out of the
 * tab bar because five tabs truncated the labels. Both moves were right; the second one is only safe because the
 * menu is on Home, which exists in both modes. These tests are the gate that keeps it that way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { homeMenuItems } from '@/lib/home-menu';

test('Account is in the menu in BOTH modes — a door rep must always be able to sign out', () => {
  // The regression that already happened once: a rep in Macro Mode could not reach Account at all, and so handed
  // a shared phone over still signed in.
  for (const macro of [true, false]) {
    const keys = homeMenuItems(macro).map((i) => i.key);
    assert.ok(keys.includes('account'), `Account missing with macro=${macro}`);
  }
});

test('the two modes offer the same menu, so nothing depends on remembering to add it twice', () => {
  assert.deepEqual(homeMenuItems(true), homeMenuItems(false));
});

test('every item is a WORD, not an icon — the menu is the navigation, the glyph is only the handle', () => {
  // The design law bans navigation hidden behind an unlabelled icon. A kebab satisfies it only if what it opens
  // reads as plain language, and if a screen reader is given something to say.
  for (const item of homeMenuItems(false)) {
    assert.ok(item.label.trim().length > 0, `${item.key} has no label`);
    assert.ok(item.hint.trim().length > 0, `${item.key} has no hint — the label would carry it alone`);
    assert.ok(!/^[^A-Za-z]*$/.test(item.label), `${item.key}'s label is not words`);
  }
});

test('every item names a real in-app route', () => {
  for (const item of homeMenuItems(false)) {
    assert.match(item.route, /^\/\(app\)\//, `${item.key} does not point into the app`);
  }
});

test("Account's hint says signing out is in there, because that is why a rep goes looking", () => {
  const account = homeMenuItems(false).find((i) => i.key === 'account');
  assert.ok(account);
  assert.match(account.hint, /signing out/i);
});
