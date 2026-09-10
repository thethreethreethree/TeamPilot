/**
 * A shared photo must not render as a blank gap in the conversation.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { attachmentNoun, bodyView, editedMark } from '@/lib/chat/message-body';

const msg = (over: Partial<Parameters<typeof bodyView>[0]> = {}) => ({
  kind: 'message',
  body: 'Hello',
  mediaUrl: null,
  mediaType: null,
  ...over,
});

test('an ordinary message shows its text', () => {
  const v = bodyView(msg());
  assert.equal(v.kind, 'text');
  assert.equal((v as { text: string }).text, 'Hello');
});

test('an attachment is described rather than rendered blank', () => {
  // THE bug: an attachment has kind 'attachment' and a NULL body, so drawing
  // the body alone drew nothing at all.
  const v = bodyView(msg({ kind: 'attachment', body: null, mediaUrl: 'f/1', mediaType: 'image/jpeg' }));
  assert.equal(v.kind, 'attachment');
  assert.match((v as { label: string }).label, /^Photo shared/);
});

test("an attachment's caption is kept — it is the human part of the message", () => {
  const v = bodyView(msg({ kind: 'attachment', body: 'The one from no. 14', mediaUrl: 'f/1', mediaType: 'image/jpeg' }));
  assert.equal((v as { caption: string | null }).caption, 'The one from no. 14');
});

test('a message with media but an unexpected kind is still treated as an attachment', () => {
  // Defensive: the kind string is the server's, and a row with a media_url is
  // an attachment whatever it calls itself. Rendering blank is the failure.
  const v = bodyView(msg({ kind: 'message', body: null, mediaUrl: 'f/2', mediaType: 'application/pdf' }));
  assert.equal(v.kind, 'attachment');
  assert.match((v as { label: string }).label, /^PDF shared/);
});

test('a genuinely empty message says so rather than leaving a gap', () => {
  const v = bodyView(msg({ body: null }));
  assert.equal(v.kind, 'empty');
  assert.equal(bodyView(msg({ body: '   ' })).kind, 'empty');
});

test('the attachment noun is the kind a rep cares about, not the MIME type', () => {
  assert.equal(attachmentNoun('image/png'), 'Photo');
  assert.equal(attachmentNoun('video/mp4'), 'Video');
  assert.equal(attachmentNoun('audio/m4a'), 'Audio');
  assert.equal(attachmentNoun('application/pdf'), 'PDF');
  assert.equal(attachmentNoun('application/octet-stream'), 'File');
  assert.equal(attachmentNoun(null), 'File');
});

test('an edited message is marked, an unedited one is not', () => {
  // Without this the text simply differs from what the rep remembers, and the
  // natural conclusion is that they misread it.
  assert.equal(editedMark('2026-09-03T10:00:00Z'), 'edited');
  assert.equal(editedMark(null), null);
});
