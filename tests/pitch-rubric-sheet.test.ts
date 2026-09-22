/**
 * The rubric sheet must not know the rubric.
 *
 * The guide's requirement for this screen is one sentence: *"read-only, rendered from
 * `rubric_config` so it never goes stale"*. The reason is `pitches.rubric_version` — a score is
 * pinned to the config it was computed under, so a sheet carrying a transcription would explain
 * September's pitches with December's numbers, and every value would still look plausible.
 *
 * A33 source-level, deliberately: the component imports react-native and cannot be rendered here.
 * What is protected is not a rendered value but the ABSENCE of typed-in ones, and absence is a
 * property of the source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/**
 * Source with comments and Tailwind class strings removed.
 *
 * Both are stripped for the same reason: they are full of numbers that are not rubric values.
 * `px-5`, `mt-0.5` and `pb-12` are spacing tokens, and the docblock deliberately quotes the very
 * figures this test forbids — a sweep that read either would fail on prose describing its own rule.
 */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/className="[^"]*"/g, '')
    .replace(/className=\{`[^`]*`\}/g, '');

const sheet = code(read('src/components/pitch-rubric-sheet.tsx'));
const board = code(read('src/components/pitch-breakdown-page.tsx'));

test('not one rubric figure is typed into the sheet', () => {
  /*
    130 is the max score, 40 the qualifying base, 30 the bonus cap. Each appears on the sheet and
    none may appear in its source. This is the assertion the whole endpoint exists to make possible:
    before it, these numbers had nowhere to come from but a developer's keyboard.
  */
  for (const literal of ['130', '40']) {
    assert.doesNotMatch(
      sheet,
      new RegExp(`\\b${literal}\\b`),
      `${literal} is a rubric value and must come from the server, not the source`,
    );
  }
  // The only 100 permitted is the percentage conversion in the grade-credit sentence.
  const hundreds = sheet.match(/\b100\b/g) ?? [];
  assert.equal(hundreds.length, 1, 'the only 100 should be the credit-to-percent conversion');
  assert.match(sheet, /credit \* 100/);
});

test('every part of the rubric response is actually rendered', () => {
  /*
    The mirror of the test above. Serving the rubric and then not reading half of it is how the
    endpoint shipped without its competition thresholds in the first place — the sheet was its only
    consumer, and nothing noticed until the sheet needed them.
  */
  for (const field of [
    'rubric.version',
    'rubric.baseMax',
    'rubric.bonusCap',
    'rubric.maxScore',
    'rubric.gradeCredit',
    'rubric.qualifyingMinBase',
    'rubric.prizeEligibleMinPitches',
    'rubric.neverGradeForAccuracy',
    'rubric.sections',
    'rubric.elements',
    'rubric.bonuses',
    'rubric.violations',
  ]) {
    assert.ok(sheet.includes(field), `the sheet never reads ${field}`);
  }
});

test('the version is shown, because a rep disputing a score needs to know which rubric', () => {
  // "attfiber-v1" at the foot is the difference between a sheet and a claim.
  assert.match(sheet, /Rubric \{rubric\.version\}/);
});

test('it opens OVER the boards rather than being a fourth destination', () => {
  /*
    The guide lists Scoring rubric beside Progress, Breakdown and Pitch detail as though it were a
    board. `WHATSAPP.txt` corrects that in its own words: "Page 4 will be the 'score rubric' button
    that is on page 1 and 2 (on the app)". The newer, more specific instruction wins, and a Modal is
    what makes it true — the figures a rep was reading are still behind it.
  */
  assert.match(sheet, /<Modal/);
  assert.match(sheet, /onRequestClose=\{onClose\}/, 'the OS back gesture must close it');
});

test('the grade words are derived from the server’s credit, not written out', () => {
  /*
    "Half points" is `gradeCredit.partial`, not a phrase typed here. If the rubric ever changes what
    a partial is worth, the sentence changes with it instead of quietly becoming wrong — which is
    the same failure as a stale number, wearing words.
  */
  assert.doesNotMatch(sheet, /Half points/);
  assert.match(sheet, /gradeCredit\[key\]/);
});

test('the board opens the sheet, and the button exists only because the sheet does', () => {
  /*
    The board shipped WITHOUT this button while the sheet did not exist. A control that opens
    nothing teaches a rep the app is broken, and removing exactly that shape — a hint naming an
    action the screen could not perform — has been a recurring correction in this codebase.
  */
  assert.match(board, /<PitchRubricSheet/);
  assert.match(board, /setSheetOpen\(true\)/);
  assert.match(board, /accessibilityLabel="How points work/);
});
