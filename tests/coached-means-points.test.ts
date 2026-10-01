/**
 * "SCORED" MEANS THE RUBRIC, IN THE APP TOO (founder, pickers 2026-09-30).
 *
 * The founder chose "coached calls" for the coaching grade's count, then "coached" for every points surface,
 * so that "scored" means the AT&T rubric alone. The website applied it the same day; the app had not, and the
 * website-vs-app parity run on 2026-10-01 found the app still saying "First session scored", "N scored calls"
 * and "counts scored sessions" for the points ledger. The rubric's own badges ("100 scored pitches") keep
 * "scored", and sentences about the act of grading ("once the coach has scored it") are not counts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const POINTS_SURFACES = [
  'src/app/(app)/(tabs)/account.tsx',
  'src/app/(app)/scoreboard.tsx',
  'src/components/arena-page.tsx',
  'src/components/pitch-progress-page.tsx',
  'src/lib/gamification/arena.ts',
];

/** Rendered text only: comments may still discuss the old wording. */
const rendered = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

for (const file of POINTS_SURFACES) {
  test(`${file} counts coached calls, never scored ones`, () => {
    const src = rendered(readFileSync(join(process.cwd(), file), 'utf8'));
    assert.doesNotMatch(src, /scored (call|session)|(call|session)s? scored|\} scored \{|\} scored \$\{/i);
  });
}

test('the door-pitch analysis chart says analyzed, not scored (a third measure)', () => {
  const src = rendered(readFileSync(join(process.cwd(), 'src/components/door-metrics-page.tsx'), 'utf8'));
  assert.doesNotMatch(src, /scored pitch/i);
});

test('the rubric keeps its own word', () => {
  const rubric = readFileSync(join(process.cwd(), 'src/lib/pitch-score/milestones.ts'), 'utf8');
  assert.match(rubric, /100 scored pitches/);
});
