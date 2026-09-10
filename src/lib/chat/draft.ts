/**
 * What to do with a chat message that did not send.
 *
 * THE PROMISE THAT WAS NOT KEPT. The topic screen told a rep, on a failed send,
 * that their message "will send itself when you have one". It could not: the
 * message and the typed text both lived in component state, so backing out of
 * the thread — or the OS reclaiming the screen — threw both away silently.
 *
 * A rep types a reply at a door with no signal, reads that sentence, taps back
 * to the topic list, and their words are gone. Worse than losing them would have
 * been fine; the app had said they were safe.
 *
 * THE FIVE-MINUTE WINDOW IS KEPT, and it is not a timeout on the words — only on
 * sending them AUTOMATICALLY. A reply landing an hour late in a conversation
 * that has moved on reads as though the rep was not paying attention. After the
 * window the text is put back in the box, where they can see it and decide. The
 * distinction matters: the message is never discarded, only ever un-automated.
 */

export const RETRY_WINDOW_MS = 5 * 60 * 1000;

export type HeldDraft = {
  /** The words. Never dropped by anything in this module. */
  body: string;
  /** When the send was first attempted. */
  at: number;
  /**
   * The message this draft answers, if any.
   *
   * OPTIONAL ON PURPOSE: drafts held before replying existed have no such field,
   * and a rep's unsent words must survive the upgrade. Absent means top-level,
   * which is what those drafts always were.
   *
   * It has to persist WITH the words. A reply restored without its target would
   * post as a flat message — landing under a question as a verdict on the whole
   * topic, which is the exact confusion the reply marker exists to prevent.
   */
  replyToId?: string | null;
};

export type DraftAction =
  /** Online, inside the window: send it now, without the rep doing anything. */
  | { kind: 'send'; body: string; replyToId: string | null }
  /** The words go back in the box; the rep decides. Carries why, to say it. */
  | { kind: 'restore'; body: string; because: 'stale' | 'offline'; replyToId: string | null }
  /** Nothing held. */
  | { kind: 'none' };

export function draftAction(
  held: HeldDraft | null,
  opts: { online: boolean; now: number },
): DraftAction {
  if (!held || !held.body.trim()) return { kind: 'none' };
  if (opts.now - held.at > RETRY_WINDOW_MS) {
    // Stale beats offline: once the thread has moved on it does not matter
    // whether there is signal now, this is no longer something to send silently.
    return { kind: 'restore', body: held.body, because: 'stale', replyToId: held.replyToId ?? null };
  }
  if (!opts.online) {
    return { kind: 'restore', body: held.body, because: 'offline', replyToId: held.replyToId ?? null };
  }
  return { kind: 'send', body: held.body, replyToId: held.replyToId ?? null };
}

/** What the screen says about a restored message. Never blames the rep. */
export function restoreMessage(because: 'stale' | 'offline'): string {
  if (because === 'stale') {
    return 'This was waiting a while and the thread has probably moved on, so it was not sent on its own. It is still here — send it when you are ready.';
  }
  return 'No signal yet. Your message is still here and goes out as soon as you have one.';
}
