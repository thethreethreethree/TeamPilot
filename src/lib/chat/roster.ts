/**
 * Who is in a topic, as a line a rep can read at a glance.
 *
 * WHY IT IS WORTH A SCREEN AT ALL. Topics are visible company-wide, but the
 * people IN one are the people the conversation is addressed to. A rep about to
 * say something frank about a customer, a manager, or a deal is entitled to know
 * who is in the room before they say it. The list screen already says "3 people";
 * the thread itself said nothing at all.
 *
 * A NAME THAT WILL NOT RESOLVE IS NOT DROPPED. `namesFor` returns only profiles
 * with a usable `full_name`, so a teammate whose name is missing would silently
 * vanish from the roster — and a rep counting four heads in a five-person room
 * is worse off than one who was told plainly that somebody could not be named.
 * They are counted, and said, as "1 other person".
 */

export type Roster = {
  /** Named participants, you first, then alphabetical. */
  names: string[];
  /** In the topic but not nameable from `profiles`. Never silently dropped. */
  unnamed: number;
  /** True when the caller is one of them. */
  includesYou: boolean;
};

export function buildRoster(
  participantIds: string[],
  names: Map<string, string>,
  meId: string | null,
): Roster {
  const ids = [...new Set(participantIds.filter(Boolean))];
  const named: string[] = [];
  let unnamed = 0;
  let includesYou = false;

  for (const id of ids) {
    if (meId && id === meId) {
      includesYou = true;
      continue;
    }
    const n = names.get(id)?.trim();
    if (n) named.push(n);
    else unnamed += 1;
  }
  named.sort((a, b) => a.localeCompare(b));
  return { names: includesYou ? ['You', ...named] : named, unnamed, includesYou };
}

/** The sentence under the title. Never claims a number it did not count. */
export function rosterLine(roster: Roster): string {
  const parts: string[] = [];
  if (roster.names.length) parts.push(roster.names.join(', '));
  if (roster.unnamed > 0) {
    parts.push(`${roster.unnamed} other ${roster.unnamed === 1 ? 'person' : 'people'}`);
  }
  if (!parts.length) return 'Nobody is in this topic yet.';
  return `In this topic: ${parts.join(', ')}.`;
}
