/**
 * Regression tests for the line under a chat topic's title.
 *
 * THE BUG BEING GUARDED IS `messages ?? 0`.
 *
 * It is the obvious tidy-up. It type-checks. And it reports every topic a rep
 * cannot read as having no messages in it — telling them a busy conversation is
 * dead. The messages policy hides a non-participant's view entirely, so `null`
 * there means "not visible to you", never "none".
 *
 * This is the same shape as two bugs this app has already guarded elsewhere: the
 * phantom skill grade (a D for a skill nobody measured) and the zero-that-was-
 * really-a-failure on the home screen. In each case a plausible number stands in
 * for an absence, and the reader has no way to tell.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { topicLine, type TopicLineInput } from '@/lib/chat/topic-line';

/** Deterministic, so the assertions are about the LOGIC, not about formatting. */
const fmt = { date: () => '3 Sep', time: () => '14:32' };

function topic(over: Partial<TopicLineInput> = {}): TopicLineInput {
  return { participants: 3, messages: 5, lastMessageAt: '2026-09-03T14:32:00Z', joined: true, ...over };
}

test('a topic the rep is NOT in never claims a message count', () => {
  // Even when counts somehow arrive, `joined` decides. A number here would be a
  // guess presented as a fact about a conversation they cannot see.
  const line = topicLine(topic({ joined: false, messages: 40, lastMessageAt: '2026-09-03T14:32:00Z' }), fmt);
  assert.match(line, /you are not in this one/);
  assert.ok(!/\b40\b/.test(line), 'leaked a count from a topic the rep cannot read');
  assert.ok(!/message/.test(line), 'implied a message count');
});

test('a topic the rep is not in still shows the roster', () => {
  // Participants ARE readable company-wide, so this part is real.
  assert.match(topicLine(topic({ joined: false }), fmt), /3 people/);
});

test('null messages is not reported as zero', () => {
  // The exact `messages ?? 0` failure.
  const line = topicLine(topic({ joined: false, messages: null }), fmt);
  assert.ok(!/\b0\b/.test(line), 'rendered a null count as zero');
});

test('a joined topic with no messages says so plainly', () => {
  // A real state: somebody has to speak first. Not a failure, and not hidden.
  const line = topicLine(topic({ messages: 0, lastMessageAt: null }), fmt);
  assert.match(line, /nothing said yet/);
  assert.match(line, /3 people/);
});

test('a joined topic with messages reports the count and when it last moved', () => {
  const line = topicLine(topic({ messages: 12 }), fmt);
  assert.match(line, /12 messages/);
  assert.match(line, /last 3 Sep, 14:32/);
});

test('a count without a timestamp does not invent one', () => {
  // Defensive: if the last-message time is missing, saying "last …" with nothing
  // after it would read as broken. It falls back to the honest short form.
  assert.match(topicLine(topic({ messages: 4, lastMessageAt: null }), fmt), /nothing said yet/);
});

test('singulars read as English', () => {
  assert.match(topicLine(topic({ participants: 1 }), fmt), /1 person/);
  assert.match(topicLine(topic({ messages: 1 }), fmt), /1 message\b/);
  assert.ok(!/1 messages/.test(topicLine(topic({ messages: 1 }), fmt)));
});

test('a topic with nobody in it does not crash or read oddly', () => {
  assert.match(topicLine(topic({ participants: 0, joined: false }), fmt), /0 people/);
});
