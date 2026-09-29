/**
 * "Start Knocking" at the bottom of the page a rep LANDS on (REV 1; founder picker 2026-09-29).
 *
 * Source-level, like door-dial-fits.test.ts: node --test cannot render React Native, so these read the
 * screens as text and pin the three things that matter —
 *   1. page 0 (DoorHomePage) renders the button,
 *   2. it is the LAST thing in that page and OUTSIDE the `state === 'ready'` block, so a target that is
 *      loading, missing or failed still leaves a rep able to start,
 *   3. there is ONE button: neither page hand-builds its own copy of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const page0 = read('src/components/door-home-page.tsx');
const home = read('src/app/(app)/(tabs)/index.tsx');

test('the landing page (page 0) renders Start Knocking', () => {
  assert.match(page0, /<StartKnockingButton\s+onPress=\{\(\) => router\.push\('\/\(app\)\/doors'\)\}\s*\/>/);
});

test('it is the last thing on the page, outside the ready-only block', () => {
  const button = page0.indexOf('<StartKnockingButton');
  const ready = page0.indexOf("{state === 'ready' && view ? (");
  const readyEnd = page0.indexOf(') : null}', ready);
  const scrollEnd = page0.indexOf('</ScrollView>');
  assert.ok(ready > 0 && readyEnd > ready, 'the ready block is where the test expects it');
  assert.ok(button > readyEnd, 'the button comes after the ready-only block, so every state shows it');
  assert.ok(button < scrollEnd, 'and inside the page');
  assert.equal(page0.slice(button, scrollEnd).match(/<[A-Z]/g)?.length, 1, 'nothing else renders after it');
});

test('page 1 uses the same component', () => {
  assert.match(home, /<StartKnockingButton\s+onPress=/);
});

test('there is one button, not copies', () => {
  for (const [name, src] of [['door-home-page', page0], ['index', home]] as const) {
    assert.doesNotMatch(src, />\s*Start Knocking\s*</, `${name} must not hand-build its own Start Knocking`);
  }
});
