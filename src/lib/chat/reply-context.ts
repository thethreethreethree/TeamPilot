/**
 * What a reply is answering, shown above it.
 *
 * A THREAD READ AS A FLAT LIST MEANS SOMETHING DIFFERENT. "No, we shouldn't"
 * under a reply arrow answers one question; standing alone in the stream it is a
 * statement about the whole topic. The web renders the parent above the reply
 * for exactly this reason; the app was not selecting the column at all.
 *
 * THE PARENT IS OFTEN NOT LOADED, and that is the case worth getting right. The
 * app fetches the newest page of messages, so a reply to something said last
 * week has no parent in memory. The web handles this too. Rendering nothing
 * would silently turn that reply back into a flat statement — so it still shows
 * a reply marker and says the message is further back, which is true and is
 * enough for a rep to read the sentence correctly.
 */

import { attachmentNoun, bodyView } from './message-body';

export type ReplyParent = {
  id: string;
  authorId: string | null;
  body: string | null;
  /** Optional so existing callers and older cached rows still type-check. */
  kind?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
};

export type ReplyContext =
  | { kind: 'none' }
  /** The parent is loaded: show who wrote it and a one-line preview. */
  | { kind: 'parent'; id: string; author: string; preview: string }
  /** It IS a reply, but the parent is outside the loaded window. */
  | { kind: 'unloaded' };

/** A preview is one line. A wrapped quote competes with the message itself. */
export const PREVIEW_MAX = 80;

export function previewOf(body: string | null): string {
  const flat = (body ?? '').replace(/\s+/g, ' ').trim();
  // A message can be media-only or deleted — say so rather than showing an
  // empty quote, which reads as a rendering fault.
  if (!flat) return 'No text';
  return flat.length <= PREVIEW_MAX ? flat : `${flat.slice(0, PREVIEW_MAX - 1).trimEnd()}…`;
}

/** The one-line quote for a parent, describing an attachment rather than its
 *  empty body. */
export function parentPreview(parent: ReplyParent): string {
  const view = bodyView({
    kind: parent.kind ?? 'message',
    body: parent.body,
    mediaUrl: parent.mediaUrl ?? null,
    mediaType: parent.mediaType ?? null,
  });
  if (view.kind === 'attachment') {
    return view.caption ? `${attachmentNoun(parent.mediaType ?? null)}: ${previewOf(view.caption)}` : attachmentNoun(parent.mediaType ?? null);
  }
  if (view.kind === 'empty') return 'No text';
  return previewOf(view.text);
}

export function replyContext(
  message: { replyToId: string | null },
  loaded: ReadonlyMap<string, ReplyParent>,
  nameFor: (authorId: string | null) => string,
): ReplyContext {
  if (!message.replyToId) return { kind: 'none' };
  const parent = loaded.get(message.replyToId);
  if (!parent) return { kind: 'unloaded' };
  return {
    kind: 'parent',
    id: parent.id,
    author: nameFor(parent.authorId),
    // Attachment-aware: a reply to a shared photo previewed as "No text",
    // which is true of the body and useless to the rep reading the thread.
    preview: parentPreview(parent),
  };
}

/** Index the loaded page once per render rather than scanning per message. */
export function indexParents(messages: readonly ReplyParent[]): Map<string, ReplyParent> {
  const m = new Map<string, ReplyParent>();
  for (const msg of messages) m.set(msg.id, msg);
  return m;
}
