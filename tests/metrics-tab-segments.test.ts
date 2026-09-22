/**
 * M7 — the four segments of Today's Metrics, and the two rulings that put them there.
 *
 * R-A: the boards live under **Today's Metrics**, not Pitch Performance. The mockup's own bottom
 * bar highlights that tab on p1 — amber icon, amber label — and the build plan had it wrong.
 *
 * R-D: the drawing's "Progress" is the Pitch Score board, and this phone already had a Progress
 * page that was something else. The founder was asked which is "the system" and answered **name
 * both**: Pitch Score takes `Progress`, the Arena becomes `Points`, and the Arena keeps its own
 * route so nothing a rep learned is deleted.
 *
 * WHAT IS GUARDED HERE IS THE OBLIGATION THAT CAME WITH THAT ANSWER. Two point totals, two
 * milestone sets and two "best" figures now sit one swipe apart. Each has to say what it counts,
 * or a rep is being handed the reconciliation privately — which the web's own register names as
 * the cost of this decision that has never been priced.
 *
 * A33 source-level: these components import react-native and cannot be rendered in this runner.
 * What is protected is structure and copy, both of which are properties of the source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const tab = code(read('src/app/(app)/(tabs)/metrics.tsx'));
const arena = code(read('src/lib/gamification/arena.ts'));

test('the control is the drawing’s three segments plus the one R-D added', () => {
  assert.deepEqual(
    [...tab.matchAll(/label: '([^']+)'/g)].map((m) => m[1]),
    ['Progress', 'Breakdown', 'Metrics', 'Points'],
  );
});

test('Progress is the Pitch Score board and lands first', () => {
  /*
    Index 0 is what the mockup shows and also the answer to the question a rep opened the app to
    ask. The Arena held index 0 until today and is now index 3 — a real change to muscle memory,
    mitigated by its own route surviving rather than by pretending it did not move.
  */
  const first = tab.indexOf("label: 'Progress'");
  const last = tab.indexOf("label: 'Points'");
  assert.ok(first > 0 && last > first, 'Progress must come before Points');
  assert.match(tab, /<PitchProgressPage period=\{period\}/);
  assert.match(tab, /<ArenaPage \/>/);
});

test('one period selection carries across Progress and Breakdown, and no further', () => {
  /*
    Guide Step 2, verbatim: "The period selection carries across Progress and Breakdown." Two
    boards reading different periods would disagree while a rep switched between them, and the
    gauge is the last place anyone would notice. Metrics and Points have their own windows.
  */
  assert.match(tab, /useState<Period>\(DEFAULT_PERIOD\)/);
  assert.equal(tab.match(/period=\{period\} onPeriodChange=\{setPeriod\}/g)?.length, 2);
  assert.doesNotMatch(tab, /<DoorMetricsPage period/);
  assert.doesNotMatch(tab, /<ArenaPage period/);
});

test('every pane keeps its own boundary, now that four screens share a tree', () => {
  /*
    Without one, a throw in any single pane replaces the whole tab — and a rep standing at a door
    loses their field figures because a gauge failed. Four panes, four boundaries.
  */
  assert.equal(tab.match(/<PaneBoundary /g)?.length, 4);
});

test('the Arena keeps the route reps already learned', () => {
  // `/(app)/progress` renders the same page in its own shell, so links from Home, Account and the
  // Scoreboard keep working. Moving a screen is survivable; deleting its address is not.
  assert.match(code(read('src/app/(app)/progress.tsx')), /<ArenaPage \/>/);
});

test('the two systems each name what they count, beside the number', () => {
  /*
    THE OBLIGATION R-D CAME WITH. The Arena's badges counted "calls" and "pitches" in words
    identical to the Pitch Score strip's; they now say "session". The Pitch Score surfaces say
    which scale they are on and that the two do not compare.
  */
  assert.match(arena, /First session scored/);
  assert.match(arena, /100 sessions/);
  assert.doesNotMatch(arena, /'First pitch'/);

  const progress = code(read('src/components/pitch-progress-page.tsx'));
  assert.match(progress, /the two do/, 'the Progress board must say the totals do not compare');
  assert.match(code(read('src/components/pitch-milestones-strip.tsx')), /Milestones · pitches/);
});
