/**
 * Who may close a chat topic, and what a close summary has to contain.
 *
 * THIS DELIBERATELY DOES NOT MATCH THE WEBSITE, and the difference is a bug on
 * the website rather than a divergence in this app.
 *
 * The web decides whether to show its Close button with `isCompanyAdminRole`,
 * whose list is ["CEO", "CFO", "COO", "admin"]. The `close_topic` function that
 * actually performs the close accepts only a per-topic admin or
 * `role in ('CEO', 'COO')`. So a CFO and a company 'admin' are both shown a
 * button the database then refuses.
 *
 * The phone follows the FUNCTION, because the function is the authority on what
 * will happen. A control that is always going to fail is worse than no control:
 * it teaches somebody the app is broken, and it does it at the moment they are
 * trying to record what their team decided.
 *
 * THE 20-CHARACTER MINIMUM is carried over exactly, and it is not padding for
 * its own sake — the web's own note says the summary is "the load-bearing claim
 * the team measures the outcome against", and a topic closed with "done" leaves
 * a hole where the reason should be.
 */

/** The values `chat_participants.role` allows. */
export type TopicRole = 'admin' | 'member' | 'observer';

/** Exactly what the close_topic function accepts at company level. */
const COMPANY_ROLES_THAT_MAY_CLOSE = ['CEO', 'COO'] as const;

export const MIN_SUMMARY = 20;

export function canCloseTopic(who: {
  /** This person's role IN this topic, or null when they are not in it. */
  topicRole: TopicRole | null;
  /** `profiles.role`, or null when it could not be read. */
  companyRole: string | null;
}): boolean {
  if (who.topicRole === 'admin') return true;
  return (
    who.companyRole !== null &&
    (COMPANY_ROLES_THAT_MAY_CLOSE as readonly string[]).includes(who.companyRole)
  );
}

/**
 * Why this summary cannot be submitted yet, or null when it can.
 *
 * Returns the REASON rather than a boolean so the screen can say it. A disabled
 * button with no explanation is the same dead end as a failing one.
 */
export function closeSummaryProblem(summary: string): string | null {
  const n = summary.trim().length;
  if (n === 0) return 'Write what was decided before closing this topic.';
  if (n < MIN_SUMMARY) {
    const left = MIN_SUMMARY - n;
    return `A few more words — ${left} more character${left === 1 ? '' : 's'}. This is what your team reads later to remember why.`;
  }
  return null;
}

/** Live counter under the field, matching the web's "n / 20+ chars". */
export function summaryCount(summary: string): { count: number; enough: boolean } {
  const count = summary.trim().length;
  return { count, enough: count >= MIN_SUMMARY };
}
