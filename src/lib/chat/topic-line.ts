/**
 * The one line of context under a topic's title.
 *
 * PURE, AND SEPARATE FROM BOTH THE SCREEN AND THE CLIENT, for the reason this
 * project now applies by rule: a screen imports React Native and the client
 * imports Supabase, and neither loads under the test runner. What is left here
 * is the part worth guarding.
 *
 * WHAT IT GUARDS. Three states that look similar and mean different things:
 *
 *   IN IT, WITH MESSAGES     → how many, and when it last moved.
 *   IN IT, NOTHING YET       → a real state. Somebody has to speak first.
 *   NOT IN IT                → the roster only. The messages policy hides that
 *                              topic's contents from this rep, so `messages` is
 *                              NULL, and any number printed here would be a
 *                              guess presented as a fact.
 *
 * THE FAILURE THIS EXISTS TO STOP is `messages ?? 0`. It is the obvious tidy-up,
 * it type-checks, and it silently reports every topic a rep cannot read as
 * having no messages in it — telling them a busy conversation is dead. It is the
 * same shape as the phantom skill grade and the zero-that-was-really-a-failure
 * on the home screen: a plausible number standing in for an absence.
 */

export type TopicLineInput = {
  participants: number;
  /** Null when the rep is not a participant — NOT zero. */
  messages: number | null;
  lastMessageAt: string | null;
  joined: boolean;
};

export function topicLine(
  t: TopicLineInput,
  fmt: { date: (iso: string) => string; time: (iso: string) => string },
): string {
  const who = `${t.participants} ${t.participants === 1 ? 'person' : 'people'}`;

  // Checked FIRST and on `joined`, never on the message count. A rep who is not
  // in a topic gets the roster and an honest statement, whatever the counts say.
  if (!t.joined) return `${who} · you are not in this one`;

  if (!t.messages || !t.lastMessageAt) return `${who} · nothing said yet`;

  return `${who} · ${t.messages} ${t.messages === 1 ? 'message' : 'messages'} · last ${fmt.date(
    t.lastMessageAt,
  )}, ${fmt.time(t.lastMessageAt)}`;
}
