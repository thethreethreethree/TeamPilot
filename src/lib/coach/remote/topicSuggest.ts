/**
 * Topic-group suggestions for Market (2026-11-23, 0319; founder picker: "AI suggests, manager OKs").
 *
 * Which topics may be grouped: topics (already merged by wording, market.ts) raised on at least MIN_CALLS calls and not
 * already in a group — a label from one call can be one customer's specifics, not a topic (and must not be copied into
 * a company-wide table). The model sees only those labels and their counts and answers JSON. parseSuggestions keeps a
 * suggestion only when every member is one of the labels given, each label is used once, and it gathers at least two:
 * the model can propose, never invent a topic (§3.4). Nothing here stores anything; a manager accepts or skips.
 */
export const MIN_CALLS = 2;
export const MAX_CANDIDATES = 150;
export type Candidate = { name: string; calls: number };
export type Suggestion = { name: string; members: string[] };

export function candidates(topics: Array<{ name: string; calls: number; groupId?: string }>): Candidate[] {
  return topics
    .filter((t) => !t.groupId && t.calls >= MIN_CALLS)
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    .slice(0, MAX_CANDIDATES)
    .map((t) => ({ name: t.name, calls: t.calls }));
}

export const TOPIC_GROUP_SYSTEM = `You help a sales manager tidy a list of topics customers raised on sales calls. Several labels often name the same topic in different words (for example "pricing", "monthly price" and "monthly bill amount" are all about what the customer pays).

Propose groups of labels that a manager would agree are the SAME topic. Rules:
- Use only labels from the list, copied exactly. Never invent a label.
- A label may appear in at most one group. A group has at least 2 labels.
- Do not group labels that are related but different (for example "price increase" is not the same as "pricing"; "installation" is not the same as "installation deposit"). When unsure, leave it out.
- Name each group in 1 to 4 plain words.
- Propose at most 12 groups, the clearest first.

Answer only JSON: {"groups":[{"name":"...","members":["label","label"]}]}`;

export function suggestionPrompt(c: Candidate[]): string {
  return `Topics (label — number of calls):\n${c.map((x) => `- ${x.name} — ${x.calls}`).join("\n")}`;
}

export function parseSuggestions(raw: string, given: Candidate[]): Suggestion[] | null {
  let j: unknown;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  const list = j && typeof j === "object" && Array.isArray((j as { groups?: unknown }).groups) ? ((j as { groups: unknown[] }).groups) : null;
  if (!list) return null;
  const byLower = new Map(given.map((c) => [c.name.toLowerCase(), c.name]));
  const used = new Set<string>();
  const out: Suggestion[] = [];
  for (const g of list.slice(0, 12)) {
    if (!g || typeof g !== "object") continue;
    const name = typeof (g as { name?: unknown }).name === "string" ? (g as { name: string }).name.trim().slice(0, 80) : "";
    const raws = Array.isArray((g as { members?: unknown }).members) ? ((g as { members: unknown[] }).members) : [];
    const members = [...new Set(raws.filter((m): m is string => typeof m === "string").map((m) => byLower.get(m.trim().toLowerCase())).filter((m): m is string => !!m && !used.has(m)))];
    if (!name || members.length < 2) continue;
    members.forEach((m) => used.add(m));
    out.push({ name, members });
  }
  return out;
}
