/**
 * A reply must not read as a standalone statement.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  PREVIEW_MAX,
  indexParents,
  previewOf,
  replyContext,
  type ReplyParent,
} from '@/lib/chat/reply-context';

const name = (id: string | null) => (id === 'u1' ? 'Ana' : id ? 'A teammate' : 'System');
const parents = (rows: ReplyParent[]) => indexParents(rows);

test('a message that is not a reply gets no reply marker', () => {
  const c = replyContext({ replyToId: null }, parents([]), name);
  assert.equal(c.kind, 'none');
});

test('a reply whose parent is loaded shows who wrote it and what it said', () => {
  const c = replyContext(
    { replyToId: 'm1' },
    parents([{ id: 'm1', authorId: 'u1', body: 'Should we drop the price?' }]),
    name,
  );
  assert.equal(c.kind, 'parent');
  assert.equal((c as { author: string }).author, 'Ana');
  assert.equal((c as { preview: string }).preview, 'Should we drop the price?');
});

test('a reply whose parent is NOT loaded still shows it is a reply', () => {
  // THE case that matters: the app loads the newest page, so a reply to
  // something said last week has no parent in memory. Rendering nothing would
  // silently turn the reply back into a flat statement.
  const c = replyContext({ replyToId: 'gone' }, parents([]), name);
  assert.equal(c.kind, 'unloaded');
});

test('a long parent is trimmed to one line with an ellipsis', () => {
  const long = 'x'.repeat(200);
  const p = previewOf(long);
  assert.ok(p.length <= PREVIEW_MAX, `preview was ${p.length} chars`);
  assert.ok(p.endsWith('…'));
});

test('a short parent is shown whole, with no ellipsis', () => {
  assert.equal(previewOf('Short one'), 'Short one');
});

test('newlines in the parent collapse, so a quote never becomes a paragraph', () => {
  assert.equal(previewOf('one\n\ntwo   three'), 'one two three');
});

test('a parent with no text says so rather than showing an empty quote', () => {
  // Media-only or deleted. An empty quote reads as a rendering fault.
  assert.equal(previewOf(null), 'No text');
  assert.equal(previewOf('   '), 'No text');
});

test('a system parent is named, never left blank', () => {
  const c = replyContext(
    { replyToId: 'm2' },
    parents([{ id: 'm2', authorId: null, body: 'Topic closed' }]),
    name,
  );
  assert.equal((c as { author: string }).author, 'System');
});

test('indexing keeps the last message for a repeated id rather than throwing', () => {
  const m = indexParents([
    { id: 'a', authorId: 'u1', body: 'first' },
    { id: 'a', authorId: 'u1', body: 'second' },
  ]);
  assert.equal(m.size, 1);
  assert.equal(m.get('a')?.body, 'second');
});

test('a reply to a shared photo previews the photo, not "No text"', () => {
  // The body of an attachment is null, so the old preview said "No text" —
  // true of the column and useless to a rep reading the thread.
  const c = replyContext(
    { replyToId: 'm9' },
    parents([
      { id: 'm9', authorId: 'u1', body: null, kind: 'attachment', mediaUrl: 'f/1', mediaType: 'image/jpeg' },
    ]),
    name,
  );
  assert.equal((c as { preview: string }).preview, 'Photo');
});

test('a reply to a captioned attachment previews both', () => {
  const c = replyContext(
    { replyToId: 'm9' },
    parents([
      { id: 'm9', authorId: 'u1', body: 'The one from no. 14', kind: 'attachment', mediaUrl: 'f/1', mediaType: 'image/jpeg' },
    ]),
    name,
  );
  assert.equal((c as { preview: string }).preview, 'Photo: The one from no. 14');
});
