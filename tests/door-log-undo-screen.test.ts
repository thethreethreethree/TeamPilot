/**
 * The Door Log screen's quiet undo (founder 2026-09-29), pinned at the source level — node --test cannot
 * render React Native. The behaviour behind it (queue, sweep, server) is tested in knock-undo.test.ts;
 * this pins that the SCREEN is wired to it the right way round.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/app/(app)/doors.tsx'), 'utf8');

test('every tap offers the undo, for THAT knock', () => {
  assert.match(src, /const k = await addKnock\(userId, outcome\);/);
  assert.match(src, /offerUndo\(k\.clientKnockId, LABEL\[outcome\]\);/);
});

test('it is quiet: offered for five seconds, then it goes', () => {
  assert.match(src, /const UNDO_MS = 5000;/);
  assert.match(src, /setTimeout\(\(\) => setUndoable\(\(u\) => \(u\?\.id === id \? null : u\)\), UNDO_MS\)/);
});

test('a door still on the phone is MARKED, not deleted — the sweep decides', () => {
  assert.match(src, /await markKnockUndone\(userId, u\.id\)/);
  assert.doesNotMatch(src, /removeKnock\(/, 'the screen must never delete a knock itself');
});

test('a door already confirmed is taken back on the server, and the total is re-read', () => {
  assert.match(src, /const r = await sendUndo\(u\.id\);/);
  assert.match(src, /fetchDayTotals\(today\)\.then\(\(t\) => setTotals\(t\)\)/);
});

test('a failed or late undo says the door is still counted', () => {
  assert.match(src, /Too late to undo that \$\{u\.label\}\. It stays counted\./);
  assert.match(src, /Couldn't undo that \$\{u\.label\}\. It is still counted\./);
});
