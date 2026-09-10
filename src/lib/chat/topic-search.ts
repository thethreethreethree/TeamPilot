/**
 * Finding a conversation in a list of up to 200.
 *
 * The web's chat list searches title, description and tags; this list had no
 * search at all, and `TOPIC_LIMIT` is 200 — so a rep looking for the thread
 * about a particular estate was scrolling, on a phone, one topic at a time.
 *
 * TAGS ARE SEARCHED because that is what they are FOR. The web's own
 * create-topic help tells the person writing it to "pick tags so the topic is
 * findable" — a tag nobody can search is a promise the product does not keep.
 *
 * EVERY WORD MUST MATCH, as everywhere else in this app that searches: typing a
 * second word has to narrow the list, or a rep learns that typing more makes
 * things worse and stops.
 */

export type SearchableTopic = {
  title: string;
  description: string | null;
  tags?: string[];
};

/** Below this many topics a search field is furniture. Matches the other lists. */
export const TOPIC_SEARCH_THRESHOLD = 8;

export function matchesTopic(topic: SearchableTopic, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [topic.title, topic.description ?? '', ...(topic.tags ?? [])]
    .join(' ')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function searchTopics<T extends SearchableTopic>(topics: T[], query: string): T[] {
  if (!query.trim()) return topics;
  return topics.filter((t) => matchesTopic(t, query));
}
