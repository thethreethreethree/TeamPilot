/**
 * A TAB LABEL THAT DOES NOT FIT IS A DESTINATION WITHOUT A NAME.
 *
 * WHAT SHIPPED, TWICE. First "Pitch Performance" rendered as "Pitch Performa..." on the founder's
 * phone. This file was written to stop that, and on 2026-09-22 the tab beside it rendered
 * "Today's Metri..." on an emulator while every assertion here passed.
 *
 * WHY IT PASSED — AND THIS IS THE POINT OF THE REWRITE. The bound was a CHARACTER COUNT, 15, and
 * the reason given was: *"'Today's Metrics' is 15 characters and renders in full in that same
 * screenshot, so 15 is a length actually observed to fit."* That sentence was false. A character
 * count is not a width: "Pitches" and "Today's" are both 7 characters and differ by 3.98dp,
 * and an apostrophe is a third of an "m". The old bound was a proxy read off one screenshot and
 * if it were the thing itself.
 *
 * SO THIS MEASURES GLYPHS AND THE CONTAINER. The widths below come from the `hmtx` advance widths
 * of `@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf` — the exact file `_layout.tsx` names
 * through `fontFamily.emphasis[0]` — summed per character and scaled by `unitsPerEm` at the tab
 * bar's own `fontSize.xs`.
 *
 * AND THE CONTAINER IS WHY THE FIRST TWO FIXES FAILED. React Navigation gives each of four tabs an
 * equal share, and `BottomTabItem`'s `tabVerticalUiKit` style takes `padding: 5` a side out of it.
 * `elements/Label.js` then hard-sets `numberOfLines: 1`, so what does not fit is cut rather than
 * wrapped. "Today's Metrics" is 92.77dp inside 92.86dp of usable width: it missed by nine
 * hundredths of a point, which no character count could ever have expressed.
 *
 * A33 source-level: React Navigation measures and truncates at paint time, which this runner
 * cannot reach. This is the arithmetic that paint performs, done here instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/app/(app)/(tabs)/_layout.tsx'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The narrowest phone this app targets is 375pt; the emulator this was measured on is 411.4dp. */
const NARROWEST_SCREEN = 375;
/** Four tabs in macro mode, which is the crowded case. Standard mode also shows four. */
const TABS = 4;
/** `BottomTabItem`'s `tabVerticalUiKit: { padding: 5 }`, both sides. Not reachable via tabBarItemStyle. */
const ITEM_PADDING = 5 * 2;

const USABLE = NARROWEST_SCREEN / TABS - ITEM_PADDING;

/**
 * Rendered width in dp at `fontSize.xs` (12), measured from Inter_500Medium's advance widths.
 *
 * A LABEL WITH NO ENTRY HERE FAILS, deliberately. Adding or renaming a tab must mean measuring it.
 * An estimate is what this file exists to replace.
 */
const MEASURED_DP: Record<string, number> = {
  Home: 33.89,
  Pitches: 42.46,
  Metrics: 43.14,
  'Role Play': 52.73,
  Analytics: 52.96,
  Sessions: 51.68,
  'Team Chat': 62.47,
  // Kept as the counter-example, and it is not a label any more — only a `title`.
  "Today's Metrics": 92.77,
};

/**
 * What the tab bar actually SHOWS: tabBarLabel when present, otherwise title.
 *
 * Screens with a bare `href: null` are excluded - they are routes, not tabs, and Account is one.
 * `href: macro ? undefined : null` is NOT excluded: that tab is shown in one of the two modes and
 * has to fit when it is.
 */
function tabLabels(): string[] {
  const out: string[] = [];
  for (const block of code.split('<Tabs.Screen').slice(1)) {
    if (/href: null/.test(block.split('/>')[0])) continue;
    const label = /tabBarLabel: '([^']+)'/.exec(block);
    const title = /title: (?:'([^']+)'|"([^"]+)")/.exec(block);
    const shown = label?.[1] ?? title?.[1] ?? title?.[2];
    if (shown) out.push(shown);
  }
  return out;
}

test('every label the bar shows has been measured, not counted', () => {
  const labels = tabLabels();
  // Seven: four macro (Home, Pitches, Metrics, Role Play) and three standard (Analytics,
  // Sessions, Team Chat), Home being shared. `kpi` and `account` are routes with `href: null`.
  assert.equal(labels.length, 7, `expected every shown tab to be found, got ${labels.length}`);
  for (const l of labels) {
    assert.ok(
      MEASURED_DP[l] !== undefined,
      `"${l}" has no measured width — measure it against Inter_500Medium before shipping it`,
    );
  }
});

test('every label fits the slot it is given, on the narrowest phone', () => {
  const tooWide = tabLabels().filter((l) => MEASURED_DP[l] > USABLE);
  assert.deepEqual(
    tooWide,
    [],
    `these labels exceed the ${USABLE.toFixed(2)}dp a tab actually has: ${tooWide
      .map((l) => `"${l}" (${MEASURED_DP[l]}dp)`)
      .join(', ')} — a clipped label is a destination with no name`,
  );
});

test('the counter-example still would not fit, which is why the bound moved', () => {
  /*
    Kept as a live assertion rather than a sentence in a comment. If this ever starts passing, the
    arithmetic above has drifted from the thing it models and the whole file needs re-deriving
    against a real screenshot — not adjusting until it agrees.
  */
  assert.ok(
    MEASURED_DP["Today's Metrics"] > USABLE,
    'the label that was observed to clip now measures as fitting — the model is wrong, not the label',
  );
  // And a character count would have waved it through, which is the failure being retired.
  assert.equal("Today's Metrics".length, 15);
  assert.equal('Pitches'.length, "Today's".length);
  assert.notEqual(MEASURED_DP.Pitches, 46.44, 'seven characters each, and 3.98dp apart in reality');
});

test('a shortened label never deletes the name', () => {
  /*
    Two tabs now show a short form. Both keep the full name in `title` for anywhere that renders
    one, so the shortening is a display decision rather than a rename — and R-A, which places the
    Pitch Score boards "under Today's Metrics", is satisfied by the title rather than the label.
  */
  assert.match(code, /title: 'Pitch Performance'/);
  assert.match(code, /tabBarLabel: 'Pitches'/);
  assert.match(code, /title: "Today's Metrics"/);
  assert.match(code, /tabBarLabel: 'Metrics'/);
});
