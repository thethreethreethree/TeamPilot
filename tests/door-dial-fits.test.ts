/**
 * THREE DIALS, ONE ROW - checked as arithmetic, because the eye was the only thing that caught it.
 *
 * WHAT SHIPPED. The dial was a fixed 132pt box and the row was `flex-row flex-wrap`. Three of those
 * plus two 8pt gaps is 412pt, against about 327pt of usable width on a 375pt phone once the screen's
 * px-5 (24 a side) is removed. So it ALWAYS wrapped: two dials on top, the third stranded
 * underneath, a triangle nobody designed. The founder found it in a screenshot.
 *
 * Every gate was green while it happened. It compiles, it lints, contrast passes, and 1,442 tests
 * knew nothing about it - a layout that cannot fit is not a value any of them observe. The comment
 * above the row even said wrapping was there so a LARGE text size would not clip a number, which
 * sounds careful and was describing a row that had never fit at any text size at all.
 *
 * SO THIS TEST IS THE SUM. It reads the real numbers out of the source and adds them up. It is not a
 * proxy for the rendering - it is exactly the calculation that was never done.
 *
 * IT READS CODE, NOT COMMENTARY. The first version of this file asserted that the string
 * "Tap to log one" no longer appears - and it failed, because the comment EXPLAINING that removal
 * quotes the old wording. A source-level test that greps a whole file is defeated by prose about the
 * file. Comments are stripped below, and that is the only reason these assertions mean anything.
 *
 * A33 source-level: the component imports react-native and cannot be rendered in this runner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/** Source with block and line comments removed, so an assertion cannot be answered by a comment. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const dial = code(read('src/components/door-dial.tsx'));
const page = code(read('src/components/door-home-page.tsx'));

/** The narrowest phone this app targets. An iPhone SE is 375pt wide. */
const NARROWEST_SCREEN = 375;
/** The door screen's own horizontal padding: px-5, and space-5 is 24 on this project's scale. */
const PAGE_PADDING = 24 * 2;
/** gap-2 between the three dials, twice. space-2 is 8. */
const GAPS = 8 * 2;

/**
 * The ring size, read out of the source.
 *
 * A LITERAL REGEX, NOT A CONSTRUCTED ONE. The first version built the pattern from a string and
 * silently matched nothing, because the backslash in \d does not survive being written into a
 * quoted string - so the test reported "SIZE must be a plain numeric const" about a const that was
 * sitting right there. A regex that matches nothing is the quietest possible way for a test to
 * stop testing.
 */
function ringSize(src: string): number {
  const m = /const SIZE = (\d+(?:\.\d+)?);/.exec(src);
  assert.ok(m, 'SIZE must be a plain numeric const so this test can add it up');
  return Number(m![1]);
}

test('three dials and their gaps fit the narrowest phone', () => {
  const size = ringSize(dial);
  const needed = size * 3 + GAPS;
  const available = NARROWEST_SCREEN - PAGE_PADDING;
  assert.ok(
    needed <= available,
    'three ' + size + 'pt dials plus ' + GAPS + 'pt of gaps need ' + needed + 'pt, and only ' +
      available + 'pt exist on a ' + NARROWEST_SCREEN + 'pt screen - this is the sum nobody did',
  );
});

test('the dial is still a legal touch target', () => {
  assert.ok(ringSize(dial) >= 48, 'the ring must not shrink below the 48dp touch floor');
});

test('the row cannot wrap', () => {
  const at = page.indexOf('flex-row');
  assert.notEqual(at, -1, 'the dial row must still be a row');
  assert.doesNotMatch(page.slice(at, at + 120), /flex-wrap/);
  assert.match(page, /flex-row items-start justify-center gap-2/);
});

test('each dial flexes, so the row divides rather than overflows', () => {
  assert.match(dial, /className="flex-1 items-center active:opacity-70"/);
});

test('the label renders outside the ring box, not inside it', () => {
  const ringOpen = dial.indexOf('style={{ width: SIZE, height: SIZE }}');
  const ringClose = dial.indexOf('</View>', ringOpen);
  // lastIndexOf, NOT indexOf: `${label}` inside the accessibility template contains the
  // substring `{label}` and sits ABOVE the ring, so indexOf found the wrong one and the test
  // failed against correct code.
  const label = dial.lastIndexOf('{label}');
  assert.ok(ringOpen !== -1, 'the ring must still be a fixed box');
  assert.ok(ringClose !== -1 && ringClose < label, 'the label must render after the ring box closes');
});

test('the longest label is held to one line and shrinks rather than spilling', () => {
  assert.match(dial, /numberOfLines=\{1\}/);
  assert.match(dial, /adjustsFontSizeToFit/);
  assert.doesNotMatch(dial, /tracking-widest/);
});

test('the dial no longer claims a tap logs a door', () => {
  assert.doesNotMatch(dial, /Tap to log one/);
  assert.match(dial, /Opens the door log\./);
});
