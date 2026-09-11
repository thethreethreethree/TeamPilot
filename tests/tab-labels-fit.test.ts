/**
 * A TAB LABEL THAT DOES NOT FIT IS A DESTINATION WITHOUT A NAME.
 *
 * WHAT SHIPPED. The Pitch Performance tab rendered as "Pitch Performa..." on the founder's own
 * phone - clipped mid-word. `headerShown` is false for the tab group and that screen carries no
 * standing heading, so the tab label is the ONLY place the destination is ever named. The design
 * law's navigation rule asks for a tab bar or "a clearly labelled menu"; a label cut mid-word is
 * that rule failing without failing anything.
 *
 * No gate could see it. It compiles, it lints, contrast passes, and truncation is a rendering
 * outcome no test in this suite observes. It took a human looking at a screenshot.
 *
 * THE BOUND IS MEASURED, NOT CHOSEN. "Today's Metrics" is 15 characters and renders in full in that
 * same screenshot; "Pitch Performance" is 17 and does not. So 15 is a length actually observed to
 * fit on a real device, and it is the cap - not a number that felt about right.
 *
 * A33 source-level: React Navigation measures and truncates at paint time, which this runner cannot
 * reach. Character count is a proxy, and a deliberately conservative one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/app/(app)/(tabs)/_layout.tsx'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Observed to fit on a 375pt screen: "Today's Metrics" renders in full at this length. */
const LONGEST_THAT_FITS = 15;

/** What the tab bar actually shows: tabBarLabel when present, otherwise title. */
function tabLabels(): string[] {
  const out: string[] = [];
  for (const block of code.split('<Tabs.Screen').slice(1)) {
    const label = /tabBarLabel: '([^']+)'/.exec(block);
    const title = /title: (?:'([^']+)'|"([^"]+)")/.exec(block);
    const shown = label?.[1] ?? title?.[1] ?? title?.[2];
    if (shown) out.push(shown);
  }
  return out;
}

test('every tab bar label is short enough to render whole', () => {
  const labels = tabLabels();
  assert.ok(labels.length >= 8, `expected every tab to be found, got ${labels.length}`);
  const tooLong = labels.filter((l) => l.length > LONGEST_THAT_FITS);
  assert.deepEqual(
    tooLong,
    [],
    `these tab labels are longer than one measured to fit (${LONGEST_THAT_FITS}): ${tooLong
      .map((l) => `"${l}" (${l.length})`)
      .join(', ')} — a clipped label is a destination with no name`,
  );
});

test('the pitches tab keeps its full name somewhere', () => {
  /*
    Shortening the LABEL must not delete the NAME. `title` still carries "Pitch Performance" for
    anywhere that shows one, so the short form is a display choice rather than a rename.
  */
  assert.match(code, /title: 'Pitch Performance'/);
  assert.match(code, /tabBarLabel: 'Pitches'/);
});
