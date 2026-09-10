/**
 * What a message actually shows.
 *
 * A MESSAGE IS NOT ALWAYS TEXT, and the app was assuming it was. An attachment
 * arrives with `kind: 'attachment'` and a null `body`, so rendering the body
 * alone drew NOTHING — a teammate sharing a photo of a door, or the price sheet,
 * appeared on the phone as a blank gap in the conversation. A rep would read
 * that as a bug in the app, or worse, not notice the message at all.
 *
 * THE APP DOES NOT PRETEND IT CAN OPEN THE FILE. The website resolves a signed
 * URL from a files table on demand; this app has no such path, and a control
 * that cannot work is worse than an honest sentence. So an attachment says what
 * it is and where to open it — which is true, and lets the rep act.
 */

export type BodyView =
  | { kind: 'text'; text: string }
  /** An attachment, described. `label` already reads as a sentence. */
  | { kind: 'attachment'; label: string; caption: string | null }
  /** Genuinely nothing — a deleted or malformed row. Said, never left blank. */
  | { kind: 'empty' };

/** "image/jpeg" → "Photo". Coarse on purpose: a rep wants the kind, not the MIME. */
export function attachmentNoun(mediaType: string | null): string {
  const t = (mediaType ?? '').toLowerCase();
  if (t.startsWith('image/')) return 'Photo';
  if (t.startsWith('video/')) return 'Video';
  if (t.startsWith('audio/')) return 'Audio';
  if (t.includes('pdf')) return 'PDF';
  if (!t) return 'File';
  return 'File';
}

export function bodyView(message: {
  kind: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
}): BodyView {
  const text = (message.body ?? '').trim();
  const isAttachment = message.kind === 'attachment' || !!message.mediaUrl;
  if (isAttachment) {
    return {
      kind: 'attachment',
      label: `${attachmentNoun(message.mediaType)} shared — open it on the website`,
      // An attachment can carry a caption in `body`. It is the human part of
      // the message and must not be dropped in favour of the file's noun.
      caption: text || null,
    };
  }
  if (!text) return { kind: 'empty' };
  return { kind: 'text', text };
}

/** Shown beside the time. Null when it was never edited. */
export function editedMark(editedAt: string | null): string | null {
  return editedAt ? 'edited' : null;
}
