/**
 * Regression tests for closing a chat topic from the phone.
 *
 * THE INTERESTING CASE is one where matching the website would be WRONG.
 *
 * The web shows its Close button to ["CEO", "CFO", "COO", "admin"]. The
 * `close_topic` database function accepts a per-topic admin, or
 * `role in ('CEO', 'COO')` — nothing else. A CFO and a company 'admin' are
 * therefore shown a button on the website that the database refuses.
 *
 * Copying that here would put a control on a phone that fails every time it is
 * pressed, at the exact moment somebody is trying to record what their team
 * decided. So these tests pin the phone to the FUNCTION, not to the web's UI.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canCloseTopic,
  closeSummaryProblem,
  MIN_SUMMARY,
  summaryCount,
} from '@/lib/chat/close-topic';

test('a per-topic admin can close', () => {
  assert.equal(canCloseTopic({ topicRole: 'admin', companyRole: 'rep' }), true);
});

test('a CEO or COO can close any topic', () => {
  assert.equal(canCloseTopic({ topicRole: 'member', companyRole: 'CEO' }), true);
  assert.equal(canCloseTopic({ topicRole: null, companyRole: 'COO' }), true);
});

test('a CFO CANNOT close — the web shows them a button that fails', () => {
  // Not an oversight here. close_topic accepts ('CEO','COO') only.
  assert.equal(canCloseTopic({ topicRole: 'member', companyRole: 'CFO' }), false);
});

test('a company "admin" CANNOT close either — same web bug', () => {
  assert.equal(canCloseTopic({ topicRole: 'member', companyRole: 'admin' }), false);
});

test('an ordinary rep cannot close', () => {
  assert.equal(canCloseTopic({ topicRole: 'member', companyRole: 'rep' }), false);
  assert.equal(canCloseTopic({ topicRole: 'observer', companyRole: 'rep' }), false);
});

test('an unreadable company role does not grant the power', () => {
  // Failing closed. Guessing upward would show a control that then errors.
  assert.equal(canCloseTopic({ topicRole: 'member', companyRole: null }), false);
  assert.equal(canCloseTopic({ topicRole: null, companyRole: null }), false);
});

test('a topic admin still wins when the company role is unreadable', () => {
  assert.equal(canCloseTopic({ topicRole: 'admin', companyRole: null }), true);
});

test('an empty summary is refused with a reason, not a silent disable', () => {
  const why = closeSummaryProblem('   ');
  assert.ok(why && why.length > 0);
  assert.match(why, /what was decided/i);
});

test('a short summary says how much more is needed', () => {
  const why = closeSummaryProblem('Too short');
  assert.ok(why);
  assert.match(why ?? '', /more character/i);
});

test('the last character before the minimum reads as singular', () => {
  const why = closeSummaryProblem('a'.repeat(MIN_SUMMARY - 1));
  assert.match(why ?? '', /1 more character\b/);
  assert.ok(!/1 more characters/.test(why ?? ''));
});

test('a real summary passes', () => {
  assert.equal(
    closeSummaryProblem('We agreed to re-run the west territory next Tuesday.'),
    null,
  );
});

test('whitespace does not count towards the minimum', () => {
  // The case that actually catches a missing trim: 25 spaces is over the
  // character minimum and records nothing at all. Without the trim this passes
  // validation and closes a topic with a blank reason.
  assert.notEqual(closeSummaryProblem(' '.repeat(MIN_SUMMARY + 5)), null);
  // And a real summary padded either side is judged on its content.
  assert.notEqual(closeSummaryProblem('  ' + 'a'.repeat(5) + '   '), null);
  assert.equal(summaryCount('   hello   ').count, 5);
  assert.equal(summaryCount(' '.repeat(MIN_SUMMARY + 5)).enough, false);
});

test('the counter flips exactly at the minimum', () => {
  assert.equal(summaryCount('a'.repeat(MIN_SUMMARY - 1)).enough, false);
  assert.equal(summaryCount('a'.repeat(MIN_SUMMARY)).enough, true);
});
