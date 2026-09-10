/**
 * Regression tests for the two per-user preferences.
 *
 * TWO FAILURES, both already made once in this app on a different screen.
 *
 * The first is guessing a default for a value that could not be READ. Migration
 * 0110 backfilled existing rows to 'expert', so reading a missing value as
 * 'expert' looks defensible — and it silently shows a rep who is really on
 * Standard the wrong switch. Their next tap, meant to change nothing, writes
 * Expert over their real setting.
 *
 * The second is the Macro Mode complaint, verbatim: a rep toggles something with
 * no signal, a refresh lands, and the switch snaps back to the server's stale
 * answer. To them the app undid their choice. What they last chose is what they
 * see until the write actually goes out.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  UNREAD,
  effectivePreferences,
  experienceLabel,
  isPending,
  readExperienceMode,
  readLearningMode,
  readPreferences,
  type Preferences,
} from '@/lib/preferences';

const server = (learningMode: boolean | null, experienceMode: 'standard' | 'expert' | null): Preferences => ({
  learningMode,
  experienceMode,
});

test('an unreadable experience mode is NULL, never a guessed default', () => {
  // 'expert' is what the migration backfilled, which is exactly why it is the
  // tempting wrong answer here.
  assert.equal(readExperienceMode(undefined), null);
  assert.equal(readExperienceMode(null), null);
  assert.equal(readExperienceMode(''), null);
  assert.equal(readExperienceMode('advanced'), null);
  assert.equal(readExperienceMode(1), null);
});

test('the two real experience values read back as themselves', () => {
  assert.equal(readExperienceMode('standard'), 'standard');
  assert.equal(readExperienceMode('expert'), 'expert');
});

test('an unreadable learning mode is NULL, not false', () => {
  // false is a real setting. Reporting a failed read as false would tell a rep
  // their Learning Mode is off when nobody knows.
  assert.equal(readLearningMode(undefined), null);
  assert.equal(readLearningMode(null), null);
  assert.equal(readLearningMode('true'), null);
  assert.equal(readLearningMode(0), null);
  assert.equal(readLearningMode(false), false);
  assert.equal(readLearningMode(true), true);
});

test('a missing profile row is entirely unread', () => {
  assert.deepEqual(readPreferences(null), UNREAD);
});

test('a real row reads both fields', () => {
  assert.deepEqual(
    readPreferences({ learning_mode_enabled: true, experience_mode: 'standard' }),
    { learningMode: true, experienceMode: 'standard' },
  );
});

test('a half-readable row keeps the half it could read', () => {
  // One bad column must not discard the other.
  assert.deepEqual(
    readPreferences({ learning_mode_enabled: false, experience_mode: 'nonsense' }),
    { learningMode: false, experienceMode: null },
  );
});

test('a pending change WINS over the server, so a refresh cannot undo the rep', () => {
  // The Macro Mode complaint, in test form.
  const shown = effectivePreferences(server(false, 'expert'), { learningMode: true });
  assert.equal(shown.learningMode, true);
  // ...and leaves the untouched preference alone.
  assert.equal(shown.experienceMode, 'expert');
});

test('no pending change shows the server exactly', () => {
  assert.deepEqual(effectivePreferences(server(true, 'standard'), null), server(true, 'standard'));
  assert.deepEqual(effectivePreferences(server(true, 'standard'), {}), server(true, 'standard'));
});

test('a pending change is shown even when the server is unreadable', () => {
  // Offline from the first frame: the rep's own choice is the only truth there is.
  const shown = effectivePreferences(UNREAD, { experienceMode: 'standard' });
  assert.equal(shown.experienceMode, 'standard');
});

test('a pending value equal to the server is not reported as pending', () => {
  // Nothing is waiting to be sent, so saying so would be noise.
  assert.equal(isPending(server(true, 'expert'), { learningMode: true }, 'learningMode'), false);
});

test('a pending value that differs IS reported as pending', () => {
  assert.equal(isPending(server(false, 'expert'), { learningMode: true }, 'learningMode'), true);
  assert.equal(
    isPending(server(false, 'expert'), { experienceMode: 'standard' }, 'experienceMode'),
    true,
  );
});

test('nothing pending is nothing pending', () => {
  assert.equal(isPending(server(true, 'expert'), null, 'learningMode'), false);
  assert.equal(isPending(server(true, 'expert'), {}, 'experienceMode'), false);
});

test('an unread experience level is labelled as unread, not as a level', () => {
  assert.equal(experienceLabel(null), 'Not loaded');
  assert.equal(experienceLabel('standard'), 'Standard');
  assert.equal(experienceLabel('expert'), 'Expert');
});
