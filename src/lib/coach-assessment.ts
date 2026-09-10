/**
 * The manager's team coaching read-out, for the phone.
 *
 * WHAT IT IS. Per rep: what they are doing well, and where they can grow — taken from the REAL text of
 * their own dissects and door pitches, not invented themes. It is the one web page with no counterpart in
 * this app, and it could not have had one: the route was browser-only until 2026-09-11, so a manager
 * holding a phone could not read their own team's coaching at all.
 *
 * A18 / A10 ARE LOAD-BEARING HERE, and they are the reason this file exists rather than a few conditions
 * inside a screen. The server's docblock states them and the app has to honour them:
 *
 *   - THIS IS NOT A SCOREBOARD. No ranking, no cross-rep comparison, no totals that invite one. Each
 *     rep's growth is relative to THEIR OWN conversations.
 *   - THE ORDER IS AN ORG-CHART ORDER, NOT A GRADE. The server sorts by org rank, name-tiebroken, so
 *     position implies nothing about performance. The app must render that order as given. Re-sorting
 *     here — by count, by "most to work on", by anything — would turn a coaching list into a league
 *     table, which is exactly what A18 forbids and exactly what a well-meaning `sort` does by accident.
 *
 * Encoded as a tested rule rather than a comment, because a comment does not fail when somebody sorts.
 */

export type TeamMember = {
  agentId: string;
  agentName: string;
  dissectCount: number;
  pitchCount: number;
  strengths: string[];
  growthAreas: string[];
  strategies: string[];
  lastAt: string | null;
};

export type Assessment = { team: TeamMember[]; degraded?: boolean };

/** How much coaching material a rep has behind their notes. Calls AND door pitches both count. */
export function signalCount(m: TeamMember): number {
  return m.dissectCount + m.pitchCount;
}

/**
 * Has this rep got anything to read yet?
 *
 * A rep with no material is listed, not hidden — a manager needs to see that somebody has nothing as much
 * as they need to see what somebody has, and dropping them from the list would quietly answer "how is my
 * team doing" with a smaller team.
 */
export function hasCoachingContent(m: TeamMember): boolean {
  return m.strengths.length > 0 || m.growthAreas.length > 0;
}

/**
 * What to say under a rep with nothing yet.
 *
 * Names the reason, never the rep. "No calls recorded yet" is a fact about the data; anything shaped like
 * "hasn't been working" is a judgement this screen has no standing to make.
 */
export function emptyNote(m: TeamMember): string {
  return signalCount(m) === 0
    ? 'No recorded calls or door pitches yet, so there is nothing to read.'
    : 'Recorded work is here, but the coach has not produced notes from it yet.';
}

/**
 * The order to render in: EXACTLY the order the server gave.
 *
 * This function returns its input unchanged, and that is the point. It exists so the screen calls
 * something named for the rule instead of reaching for `.sort()`, and so a future edit that adds a sort
 * has to delete a documented function and fail a test rather than quietly add a line.
 */
export function inServerOrder(team: TeamMember[]): TeamMember[] {
  return team;
}

/**
 * The one-line summary a manager reads first.
 *
 * Deliberately counts MATERIAL, not performance: "3 calls and 12 door pitches" is a fact about how much
 * there is to coach from. A number that could be read as a score — a rate, an average, a total ranked
 * against another rep — does not belong on this screen.
 */
export function materialLine(m: TeamMember): string {
  const parts: string[] = [];
  if (m.dissectCount > 0) parts.push(`${m.dissectCount} ${m.dissectCount === 1 ? 'call' : 'calls'}`);
  if (m.pitchCount > 0) {
    parts.push(`${m.pitchCount} door ${m.pitchCount === 1 ? 'pitch' : 'pitches'}`);
  }
  return parts.length === 0 ? 'Nothing recorded yet' : `From ${parts.join(' and ')}`;
}
