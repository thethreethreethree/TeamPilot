/**
 * Finding one saved line, fast, standing at a door.
 *
 * This screen's whole purpose is fifteen seconds before a knock: "how did I
 * handle 'too expensive' last time?". With the server returning up to 200 lines,
 * a plain scroll answers that question badly — the rep is hunting when they
 * meant to be reading.
 *
 * WHAT A SEARCH LOOKS AT. Everything the rep can SEE on the row, and nothing
 * they cannot — the same rule the session list follows. The objection a rep
 * types is most often in `context` or in the line itself, but `whyItWorks` is on
 * screen too, and a search that ignores visible words makes a rep think their
 * own line is gone.
 *
 * EVERY WORD MUST MATCH, not any. Typing two words is how somebody narrows a
 * list; `some` would widen it instead, so the second word would make the results
 * worse and the rep would stop typing them. Order does not matter — "expensive
 * price" and "price expensive" are the same question.
 */

export type SearchableLine = {
  correctLine: string;
  whyItWorks: string | null;
  context: string | null;
  sessionLabel: string | null;
  outcome: string | null;
};

/** Below this many lines a search field is furniture, not help. Mirrors the session list. */
export const ONELINER_SEARCH_THRESHOLD = 8;

export function matchesLine(line: SearchableLine, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [line.correctLine, line.whyItWorks, line.context, line.sessionLabel, line.outcome]
    .map((f) => (f ?? '').toLowerCase())
    .join(' ');
  return words.every((w) => hay.includes(w));
}

/** The visible list for a query. Order is the server's — it ranks, this filters. */
export function filterLines<T extends SearchableLine>(lines: T[], query: string): T[] {
  const words = query.trim();
  if (!words) return lines;
  return lines.filter((l) => matchesLine(l, query));
}
