/**
 * Who may see that a message was written with the coach's help.
 *
 * THIS IS A PRIVACY RULE, NOT A BADGE. The website records the reasoning behind
 * it verbatim, from a rep's own annotation: peers must not see the marker
 * because a rep is "afraid that others might see them incapable of responding
 * without AI guidance". The data has always been recorded; what changed was
 * deciding who it is shown to.
 *
 * The asymmetry, exactly as the web implements it:
 *   - the AUTHOR sees it on their own message — transparency about what the
 *     system records on them, with no shame attached;
 *   - a LEADER sees it — they need to understand how the team communicates;
 *   - a PEER never sees it. This is the whole point. Getting it wrong does not
 *     produce a cosmetic bug, it produces the exact harm the rule exists to
 *     prevent, silently, to the person least able to complain about it.
 *
 * FAILING CLOSED IS DELIBERATE. When the viewer's role could not be read, the
 * marker is hidden. An unknown viewer is treated as a peer, because showing it
 * to someone who should not see it cannot be undone, and hiding it from a
 * leader costs nothing they cannot get on the website.
 */

/** The company roles the website treats as leadership. Mirrors its ADMIN_ROLES. */
export const LEADER_COMPANY_ROLES = ['CEO', 'CFO', 'COO', 'admin'] as const;

export function isLeader(who: {
  /** Role in THIS topic, or null when they are not in it. */
  topicRole: string | null;
  /** `profiles.role`, or null when it could not be read. */
  companyRole: string | null;
}): boolean {
  if (who.topicRole === 'admin') return true;
  return (
    who.companyRole !== null &&
    (LEADER_COMPANY_ROLES as readonly string[]).includes(who.companyRole)
  );
}

export function canSeeAiAssisted(
  message: { authorId: string | null; aiAssisted: boolean },
  viewer: { userId: string | null; topicRole: string | null; companyRole: string | null },
): boolean {
  if (!message.aiAssisted) return false;
  // Their own message. Compared explicitly against null so that two unknown
  // identities are never treated as the same person.
  if (viewer.userId !== null && message.authorId === viewer.userId) return true;
  return isLeader(viewer);
}
