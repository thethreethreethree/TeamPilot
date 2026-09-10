/**
 * What the team has marked as mattering, in one topic.
 *
 * A pin is the strongest signal a chat carries: somebody deliberately said "this
 * message is the one to come back to". It was invisible on the phone, which is
 * the device a rep actually has at a door.
 *
 * THE COUNT IS OF WHAT IS ON SCREEN, not of what exists. The app loads the
 * newest page of a topic, so a pin on an older message is real but not visible
 * here — and telling a rep "3 pinned" while showing one is a screen arguing with
 * itself. The summary says how many are in view and, separately, that there are
 * older ones, which is both true and useful.
 */

export type PinSummary = {
  /** Pinned messages among those currently loaded. */
  visible: number;
  /** Pins that exist but sit outside the loaded page. */
  older: number;
};

export function isPinned(messageId: string, pins: ReadonlySet<string>): boolean {
  return pins.has(messageId);
}

export function pinSummary(
  loaded: readonly { id: string }[],
  pins: ReadonlySet<string>,
): PinSummary {
  let visible = 0;
  for (const m of loaded) if (pins.has(m.id)) visible += 1;
  return { visible, older: Math.max(0, pins.size - visible) };
}

/**
 * The line above the thread, or null when there is nothing to say.
 *
 * Null rather than "0 pinned": a topic with no pins should carry no furniture at
 * all, and an empty count reads as a feature that is broken rather than unused.
 */
export function pinLine(summary: PinSummary): string | null {
  const { visible, older } = summary;
  if (visible === 0 && older === 0) return null;
  if (visible === 0) {
    return older === 1
      ? '1 pinned message, further back in this topic'
      : `${older} pinned messages, further back in this topic`;
  }
  const head = visible === 1 ? '1 pinned message below' : `${visible} pinned messages below`;
  if (older === 0) return head;
  return older === 1 ? `${head}, and 1 further back` : `${head}, and ${older} further back`;
}

/**
 * The pin set after a change the server has confirmed.
 *
 * APPLIED ONLY AFTER CONFIRMATION, never optimistically. A pin is a claim about
 * what the TEAM agreed matters; showing it as done before the server agreed
 * would let a rep walk away believing they had marked something for everyone
 * when they had not. The delay is a few hundred milliseconds; the wrong belief
 * lasts until someone notices it is missing.
 *
 * Returns the same Set when nothing changed, so a screen holding it in state
 * does not re-render for a no-op.
 */
export function withPin(
  pins: ReadonlySet<string>,
  messageId: string,
  pinned: boolean,
): ReadonlySet<string> {
  if (pins.has(messageId) === pinned) return pins;
  const next = new Set(pins);
  if (pinned) next.add(messageId);
  else next.delete(messageId);
  return next;
}

/** What the confirmation asks before removing a pin the whole team can see. */
export function unpinPrompt(): { title: string; body: string } {
  return {
    title: 'Remove this pin?',
    // Says who it affects, because that is the part a rep cannot see from here.
    body: 'Your whole team will stop seeing this message marked. You can pin it again afterwards.',
  };
}
