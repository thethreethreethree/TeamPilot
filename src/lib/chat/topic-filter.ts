/**
 * Filtering the topic list by state.
 *
 * Mirrors the web's All / Open / Closed control, including one behaviour that
 * looks like an oversight until you count: the web filters on
 * `status === filter`, and the column allows a THIRD value, 'archived'. So an
 * archived topic appears under All and under neither of the other two.
 *
 * That is kept, because a rep moving between the website and the phone must not
 * find different topics under the same word. What is NOT kept is leaving it
 * invisible: the counts are shown on the control, so Open 4 + Closed 2 against
 * All 7 makes the seventh topic's existence obvious rather than a thing a rep
 * discovers by noticing something they expected is missing.
 *
 * ALL IS THE DEFAULT, on both surfaces. A filter that hides things by default is
 * how somebody concludes a conversation was deleted.
 */
import type { ChatTopic } from './chat-api';

export const FILTERS = ['all', 'open', 'closed'] as const;
export type TopicFilter = (typeof FILTERS)[number];

export const DEFAULT_FILTER: TopicFilter = 'all';

export function filterTopics<T extends { status: ChatTopic['status'] }>(
  topics: T[],
  filter: TopicFilter,
): T[] {
  if (filter === 'all') return topics;
  return topics.filter((t) => t.status === filter);
}

export type TopicCounts = { all: number; open: number; closed: number };

export function topicCounts(topics: { status: ChatTopic['status'] }[]): TopicCounts {
  return {
    all: topics.length,
    open: topics.filter((t) => t.status === 'open').length,
    closed: topics.filter((t) => t.status === 'closed').length,
  };
}

/**
 * True when some topics sit outside both Open and Closed.
 *
 * The screen says so in one line rather than letting a rep work out that the
 * numbers do not add up.
 */
export function hasUncountedTopics(counts: TopicCounts): boolean {
  return counts.all > counts.open + counts.closed;
}

export function filterLabel(filter: TopicFilter): string {
  switch (filter) {
    case 'all':
      return 'All';
    case 'open':
      return 'Open';
    case 'closed':
      return 'Closed';
  }
}

/** What to say when a filter matches nothing — never a bare blank screen. */
export function emptyFilterMessage(filter: TopicFilter): string | null {
  if (filter === 'open') return 'No open topics. Everything has been closed off.';
  if (filter === 'closed') return 'Nothing has been closed yet.';
  return null;
}
