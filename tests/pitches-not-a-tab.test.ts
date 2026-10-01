/**
 * PITCH PERFORMANCE IS NOT A TAB (founder, REV 1 + picker 2026-10-01).
 *
 * REV 1: "Take out today's performance (that's what the home page is)". The first reading, the Today's
 * Metrics tab, was ruled out by the founder; the second, confirmed in a picker, is the Pitch Performance
 * tab. It is removed the way Account was: the route stays, the tab goes. Two halves, both pinned:
 *
 *   - the tab is gone in BOTH modes (`href: null`, not `href: macro ? undefined : null`);
 *   - the screen is still REACHABLE, from the Door Log's two links, so no pitch history is stranded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const layout = read('src/app/(app)/(tabs)/_layout.tsx');

function screenBlock(name: string): string {
  const at = layout.indexOf(`name="${name}"`);
  assert.ok(at > 0, `the ${name} route must stay registered`);
  return layout.slice(at, layout.indexOf('/>', at));
}

test('Pitch Performance draws no tab, in either mode', () => {
  const block = screenBlock('pitches');
  assert.match(block, /href: null/, 'the pitches screen must not draw a tab');
  assert.doesNotMatch(block, /href: macro/, 'not a macro-only tab: no tab at all');
});

test('the screen is still reachable from the Door Log', () => {
  const doors = read('src/app/(app)/doors.tsx');
  const links = doors.match(/router\.push\('\/\(app\)\/\(tabs\)\/pitches'\)/g) ?? [];
  assert.ok(links.length >= 1, 'with the tab gone, the Door Log link is the way to pitch history');
});
