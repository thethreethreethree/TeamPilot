/**
 * Finding one conversation among up to 200, on a phone.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  TOPIC_SEARCH_THRESHOLD,
  matchesTopic,
  searchTopics,
  type SearchableTopic,
} from '@/lib/chat/topic-search';

const topic = (over: Partial<SearchableTopic> = {}): SearchableTopic => ({
  title: 'Maple Estate objections',
  description: 'What the residents keep saying about the price',
  tags: ['pricing', 'maple'],
  ...over,
});

test('a topic is found by its title', () => {
  assert.equal(matchesTopic(topic(), 'maple'), true);
});

test('a topic is found by its description', () => {
  assert.equal(matchesTopic(topic(), 'residents'), true);
});

test('a topic is found by a tag, because that is what tags are for', () => {
  // The web's own create-topic help says "pick tags so the topic is findable".
  // A tag nobody can search is a promise the product does not keep.
  assert.equal(matchesTopic(topic({ title: 'Untitled', description: null }), 'pricing'), true);
});

test('every word must match, so a second word narrows', () => {
  assert.equal(matchesTopic(topic(), 'maple price'), true);
  assert.equal(matchesTopic(topic(), 'maple mortgage'), false);
});

test('a topic with no description and no tags is still searchable', () => {
  // Both are nullable/absent in practice; search must not throw on a bare topic.
  const bare: SearchableTopic = { title: 'Just a title', description: null };
  assert.equal(matchesTopic(bare, 'title'), true);
  assert.equal(matchesTopic(bare, 'nothing'), false);
});

test('a blank search matches everything, on the matcher itself', () => {
  // The caller short-circuits, so without asserting the matcher directly this
  // branch could be inverted and every other test would still pass.
  assert.equal(matchesTopic(topic(), ''), true);
  assert.equal(matchesTopic(topic(), '   '), true);
});

test('searching returns the list untouched when the box is empty', () => {
  const rows = [topic(), topic({ title: 'Another' })];
  assert.equal(searchTopics(rows, ''), rows);
  assert.equal(searchTopics(rows, '  ').length, 2);
});

test('search is case-insensitive in both directions', () => {
  assert.equal(matchesTopic(topic(), 'MAPLE'), true);
  assert.equal(matchesTopic(topic({ tags: ['PRICING'] }), 'pricing'), true);
});

test('filtering keeps the order the server returned', () => {
  const a = topic({ title: 'price one' });
  const b = topic({ title: 'price two' });
  const c = topic({ title: 'other', description: null, tags: [] });
  assert.deepEqual(searchTopics([a, b, c], 'price').map((t) => t.title), ['price one', 'price two']);
});

test('the threshold matches the other lists in this app', () => {
  assert.equal(TOPIC_SEARCH_THRESHOLD, 8);
});

test('a locked topic is still findable by its own members', () => {
  // Locked is a visibility flag enforced by the database, not a search filter.
  // A member who can see the topic must be able to find it like any other.
  const locked = { title: 'Private: the Henderson account', description: null, tags: ['sensitive'] };
  assert.equal(matchesTopic(locked, 'henderson'), true);
  assert.equal(matchesTopic(locked, 'sensitive'), true);
});
