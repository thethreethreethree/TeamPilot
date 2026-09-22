/**
 * FOUR SEGMENTS, ONE ROW — checked as arithmetic against the real font, because nothing else can.
 *
 * WHAT THIS PREVENTS. Today's Metrics grew from two segments to four when the founder ruled that
 * Pitch Score takes "Progress" and the Arena becomes "Points". The control was four equal `flex-1`
 * columns, and four equal columns on a 375pt screen leave **79.75pt** each once the row's own px-4
 * and its three 8pt gaps are removed. "Breakdown" in the app's own face — Inter Medium, which is
 * what `font-emphasis` resolves to — measures **86.57pt at 16pt**. It did not fit, at any gap:
 * even a zero-gap row leaves 93.75pt, and any pill padding at all eats the difference.
 *
 * THE WIDTHS BELOW WERE MEASURED, NOT ESTIMATED. They come from the `hmtx` advance widths of
 * `node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf` — the exact file
 * `app/_layout.tsx` loads through `expo-font` — summed per glyph and scaled by `unitsPerEm`. A
 * character count would have been a proxy; this is the measurement. An em-factor guess of 0.55
 * would have put "Breakdown" at 79.2pt and passed a control that clips.
 *
 * THE FIX IS `grow` PLUS `flex-wrap`, NOT A SMALLER FONT. 14pt fits at the default scale with 4pt
 * to spare and clips at the first notch of Dynamic Type, on a single word that cannot wrap —
 * exactly the kind of fix that passes every gate and fails on a real phone. With `grow` the pills
 * are sized by their words and share the slack, so a larger text size costs HEIGHT (a second row)
 * rather than a destination's name.
 *
 * THIS IS THE THIRD TIME A LAYOUT REACHED A SCREENSHOT BEFORE A TEST. The three door dials that
 * always wrapped, the "Pitch Performa..." tab label, and this. All three compiled, linted, passed
 * contrast, and were invisible to every assertion in the suite. A33 source-level: React Native
 * measures at paint time, which this runner cannot reach — so the sum is done here instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const pager = code(read('src/components/swipe-pager.tsx'));
const metrics = code(read('src/app/(app)/(tabs)/metrics.tsx'));

/** An iPhone SE is 375pt wide. The narrowest phone this app targets. */
const NARROWEST_SCREEN = 375;
/** The tablist row's own `px-4`, both sides. */
const ROW_PADDING = 16 * 2;
/** `gap-2` between pills. */
const GAP = 8;
/** `text-base`. */
const LABEL_PT = 16;

/**
 * Rendered width in points at 16pt, measured from Inter_500Medium's advance widths.
 *
 * A LABEL WITH NO ENTRY HERE FAILS THE FIRST TEST, deliberately. Adding a segment must mean
 * measuring it, not estimating it — the estimate is what this file exists to replace.
 */
const MEASURED_PT: Record<string, number> = {
  Progress: 68.85,
  Breakdown: 86.57,
  Metrics: 57.52,
  Points: 47.65,
};

/** The labels Today's Metrics puts on its control, in order. */
function segmentLabels(): string[] {
  return [...metrics.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
}

test('every segment label has been measured, not guessed', () => {
  const labels = segmentLabels();
  assert.deepEqual(labels, ['Progress', 'Breakdown', 'Metrics', 'Points']);
  for (const l of labels) {
    assert.ok(
      MEASURED_PT[l] !== undefined,
      `"${l}" has no measured width — measure it against Inter_500Medium before shipping it`,
    );
  }
});

test('the four segments fit one row on the narrowest phone', () => {
  const labels = segmentLabels();
  const text = labels.reduce((sum, l) => sum + MEASURED_PT[l], 0);
  const used = text + ROW_PADDING + GAP * (labels.length - 1);
  assert.ok(
    used <= NARROWEST_SCREEN,
    `the control needs ${used.toFixed(2)}pt of ${NARROWEST_SCREEN}pt — it would wrap at the default text size`,
  );
});

test('it still fits at a 1.2 text scale, and wrapping is what happens beyond', () => {
  /*
    Dynamic Type is not optional here — the design law requires honouring `fontScale`. What matters
    is not that one row survives forever but that the FAILURE MODE is a second row rather than a
    clipped word. `flex-wrap` is what guarantees that, and `grow` (not `flex-1`) is what stops the
    pills being forced to a width their text overflows.
  */
  const labels = segmentLabels();
  const scaled = labels.reduce((sum, l) => sum + MEASURED_PT[l], 0) * 1.2;
  const used = scaled + ROW_PADDING + GAP * (labels.length - 1);
  assert.ok(used <= NARROWEST_SCREEN, `one row breaks at 1.2 scale: ${used.toFixed(2)}pt`);

  assert.match(pager, /accessibilityRole="tablist" className="flex-row flex-wrap/);
  assert.match(pager, /min-h-7 grow items-center/);
  assert.doesNotMatch(
    pager,
    /min-h-7 flex-1 items-center/,
    'flex-1 forces equal widths, which is what could not hold "Breakdown"',
  );
});

test('the equal-column layout would NOT have fit, which is why it changed', () => {
  /*
    The arithmetic that was never done, kept as a test so the reason survives the commit that
    explains it. Restoring `flex-1` re-creates exactly this.
  */
  const columns = (NARROWEST_SCREEN - ROW_PADDING - GAP * 3) / 4;
  assert.ok(columns < MEASURED_PT.Breakdown, 'the premise of this whole file no longer holds');
  assert.equal(Math.round(columns * 100) / 100, 79.75);
});

test('the label size is the one the widths were measured at', () => {
  // A width table is only true at a size. Changing `text-base` here without re-measuring would
  // leave every number above quietly describing a control that no longer exists.
  assert.equal(LABEL_PT, 16);
  assert.match(pager, /font-emphasis text-base/);
});
