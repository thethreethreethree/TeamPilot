/**
 * Regression tests for the skill grades.
 *
 * ONE RULE MATTERS MORE THAN THE REST, and it is the server's own, quoted from
 * `skillGrade.ts`: an unmeasured skill "returns an honest not-yet grade — NOT a
 * low letter".
 *
 * A rep who has never been measured on questions must never see a D for it.
 * That is not a rounding error; it is a false statement about a person, on a
 * screen they have every reason to believe, about the thing they are judged on
 * at work. The failure mode is silent — a D looks exactly like a real D — and
 * the tempting implementations all produce it: `score ?? 0`, a falsy check, or a
 * band lookup that falls through to the floor.
 *
 * The bands themselves are transcribed from the server rather than remembered,
 * so they are tested at their boundaries — an off-by-one there hands a rep the
 * wrong letter for their work.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSkillsView, gradeSkill, type Skill } from '@/lib/skills-view';

function skill(over: Partial<Skill> = {}): Skill {
  return { key: 'questions', label: 'Questions', score: 7, sampleSize: 5, read: 'ok', ...over };
}

test('an UNMEASURED skill is not-yet, never a low letter', () => {
  for (const missing of [null, undefined, Number.NaN]) {
    const g = gradeSkill(missing as number | null);
    assert.equal(g.letter, null, String(missing));
    assert.equal(g.tier, 'not-yet', String(missing));
  }
});

test('a genuine zero IS a D — it was measured', () => {
  // The distinction the whole file turns on. Zero is a result; null is silence.
  const g = gradeSkill(0);
  assert.equal(g.letter, 'D');
  assert.equal(g.tier, 'weak');
});

test('the band boundaries match the server exactly', () => {
  // Transcribed from skillGrade.ts. An off-by-one here hands a rep the wrong
  // letter for their own work.
  const cases: [number, string][] = [
    [10, 'A+'],
    [9.5, 'A+'],
    [9.4, 'A'],
    [9.0, 'A'],
    [8.9, 'A-'],
    [8.5, 'A-'],
    [8.4, 'B+'],
    [8.0, 'B+'],
    [7.9, 'B'],
    [7.0, 'B'],
    [6.9, 'B-'],
    [6.5, 'B-'],
    [6.4, 'C+'],
    [6.0, 'C+'],
    [5.9, 'C'],
    [5.5, 'C'],
    [5.4, 'C-'],
    [5.0, 'C-'],
    [4.9, 'D'],
  ];
  for (const [score, letter] of cases) {
    assert.equal(gradeSkill(score).letter, letter, `score ${score}`);
  }
});

test('a score outside the scale is clamped, not rejected', () => {
  assert.equal(gradeSkill(99).letter, 'A+');
  assert.equal(gradeSkill(-5).letter, 'D');
});

test('an unscored skill draws NO bar', () => {
  // A zero-width bar reads as a zero score, which is the same lie as the D.
  const v = buildSkillsView({ skills: [skill({ score: null })] });
  assert.equal(v.rows[0].fraction, null);
});

test('a scored skill draws a bar in proportion', () => {
  const v = buildSkillsView({ skills: [skill({ score: 7 })] });
  assert.equal(v.rows[0].fraction, 0.7);
  assert.equal(buildSkillsView({ skills: [skill({ score: 0 })] }).rows[0].fraction, 0);
});

test('all-unscored is reported as nothing measured, not as an empty list', () => {
  // Different screens: "no skills" would be wrong — the skills exist, the
  // measurements do not.
  const v = buildSkillsView({
    skills: [skill({ score: null }), skill({ key: 'tone', label: 'Tone', score: null })],
  });
  assert.equal(v.nothingMeasured, true);
});

test('one measured skill among many is NOT nothing measured', () => {
  const v = buildSkillsView({
    skills: [skill({ score: null }), skill({ key: 'tone', label: 'Tone', score: 8 })],
  });
  assert.equal(v.nothingMeasured, false);
});

test('a failed load reads as nothing measured rather than throwing', () => {
  assert.equal(buildSkillsView({ skills: null }).nothingMeasured, true);
});

test('the spoken label carries the sample size, because weight changes meaning', () => {
  // A B from two calls and a B from forty are not the same claim, and a screen
  // reader user gets only this sentence.
  const v = buildSkillsView({ skills: [skill({ score: 7, sampleSize: 2 })] });
  assert.match(v.rows[0].spoken, /2 calls/);
  assert.match(v.rows[0].spoken, /7 out of 10/);
});

test('an unmeasured skill says so aloud', () => {
  const v = buildSkillsView({ skills: [skill({ score: null })] });
  assert.match(v.rows[0].spoken, /not measured yet/i);
  // And never speaks a grade it does not have.
  assert.ok(!/\b[A-D][+-]?\b/.test(v.rows[0].spoken.replace(/Questions/g, '')));
});
