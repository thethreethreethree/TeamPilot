/**
 * Market (2026-11-23; ledger F14.6 "Market page", graded LACK: "Competitors and topics are extracted per call and stored
 * as events, but nothing adds them up into market or competitor trends or ties them to outcomes"). Adds up each call's
 * intel (coach.session_intel_generated: competitors named — grounded in the transcript — and topics discussed) across
 * the calls in view: how often each competitor comes up, week by week, and the win rate when it does against the win
 * rate overall; and the topics most discussed. Pure, so the arithmetic is tested.
 *
 * Win rate = sold ÷ (sold + no sale); other outcomes are not closed. It is null below MIN_CLOSED closed calls — a rate
 * from two calls would be a claim the data can't support (§3.4).
 */
export const MIN_CLOSED = 5;

export type MarketCall = { sessionId: string; startedAt: string; outcome: string | null };
export type Intel = { competitors: string[]; topics: string[] };

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Topic grouping (2026-11-23, docs/tbc/2026-11-23-market-topic-groups). The model words the same topic many ways —
 * production had 720 labels for 1,430 mentions: "internet and tv bundle" / "tv and internet bundle" / "bundled internet
 * and tv"; "pricing" / "price"; "internet speed" / "internet speeds". topicKey merges WORDING only: case, punctuation,
 * small words, word order, and word endings (-s, -ing, -ed, a trailing e). It never merges MEANING — "price increase"
 * stays apart from "pricing", "monthly bill" from "monthly price" — because a wrong merge would overstate how often a
 * topic comes up (§3.4). Tried on every production label before shipping: 41 merges, none wrong.
 */
const SMALL_WORDS = new Set(["a", "an", "and", "the", "of", "for", "with", "to", "in", "on", "from", "vs", "versus", "like", "or", "about", "their", "his", "her", "my", "our", "your"]);
function stem(w: string): string {
  let x = w;
  if (x.length > 5 && x.endsWith("ing")) x = x.slice(0, -3);
  else if (x.length > 5 && x.endsWith("ed") && !x.endsWith("eed")) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith("s") && !x.endsWith("ss")) x = x.slice(0, -1);
  if (x.length > 3 && x.endsWith("e")) x = x.slice(0, -1);
  return x;
}
export function topicKey(s: string): string {
  const words = s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter((w) => w && !SMALL_WORDS.has(w));
  return [...new Set(words.map(stem))].sort().join(" ");
}
const closed = (o: string | null) => o === "sold" || o === "no_sale";
const winRate = (calls: MarketCall[]) => {
  const c = calls.filter((x) => closed(x.outcome));
  return c.length >= MIN_CLOSED ? c.filter((x) => x.outcome === "sold").length / c.length : null;
};
function weekOf(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10);
}

function group(calls: MarketCall[], intel: Map<string, Intel>, pick: (i: Intel) => string[], key: (s: string) => string = norm) {
  const g = new Map<string, { names: Map<string, number>; calls: MarketCall[] }>();
  for (const c of calls) {
    const i = intel.get(c.sessionId);
    if (!i) continue;
    const seen = new Set<string>();
    for (const raw of pick(i)) {
      const k = key(raw);
      if (!k) continue;
      const e = g.get(k) ?? { names: new Map<string, number>(), calls: [] as MarketCall[] };
      e.names.set(raw.trim(), (e.names.get(raw.trim()) ?? 0) + 1); // every wording is kept…
      if (!seen.has(k)) e.calls.push(c); // …but a call counts once per group
      seen.add(k);
      g.set(k, e);
    }
  }
  return [...g.values()].map((e) => {
    // The wording used most names the group; the others are listed so the manager sees what was merged.
    const byUse = [...e.names.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([n]) => n);
    const name = byUse[0]!;
    const variants = [...new Set(byUse.slice(1).filter((n) => norm(n) !== norm(name)).map((n) => n.toLowerCase()))].sort((a, b) => a.localeCompare(b));
    return { name, calls: e.calls, variants };
  });
}

/** A manager-accepted topic group (0319): its name and the wordings it gathers. */
export type TopicGroup = { id: string; name: string; members: string[] };

/**
 * The one key that decides which topics are counted together (§2.2): a wording belongs to a manager's group when its
 * topicKey matches a member's; otherwise it keys on its own wording. A wording in two groups goes to the newer one
 * (groups arrive newest first).
 */
export function topicGrouper(groups: TopicGroup[]) {
  const byKey = new Map<string, TopicGroup>();
  for (const g of groups) for (const m of g.members) if (!byKey.has(topicKey(m))) byKey.set(topicKey(m), g);
  return {
    key: (raw: string) => {
      const k = topicKey(raw);
      const g = byKey.get(k);
      return g ? `group:${g.id}` : k;
    },
    groupOf: (raw: string) => byKey.get(topicKey(raw)) ?? null,
  };
}

export function computeMarket(calls: MarketCall[], intel: Map<string, Intel>, topN = 15, groups: TopicGroup[] = []) {
  const withIntel = calls.filter((c) => intel.has(c.sessionId));
  const competitors = group(withIntel, intel, (i) => i.competitors)
    .map((x) => {
      const weeks = new Map<string, number>();
      for (const c of x.calls) weeks.set(weekOf(c.startedAt), (weeks.get(weekOf(c.startedAt)) ?? 0) + 1);
      return {
        name: x.name,
        calls: x.calls.length,
        share: withIntel.length ? x.calls.length / withIntel.length : 0,
        closed: x.calls.filter((c) => closed(c.outcome)).length,
        winRate: winRate(x.calls),
        weeks: [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([weekStart, n]) => ({ weekStart, calls: n })),
      };
    })
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    .slice(0, topN);
  const grouper = topicGrouper(groups);
  const topics = group(withIntel, intel, (i) => i.topics, grouper.key)
    .map((x) => {
      const g = grouper.groupOf(x.name);
      if (!g) return { name: x.name, calls: x.calls.length, variants: x.variants };
      // A manager's group is named as they named it; every wording it gathered is listed.
      const all = [...new Set([x.name.toLowerCase(), ...x.variants])].filter((v) => v !== g.name.toLowerCase()).sort((a, b) => a.localeCompare(b));
      return { name: g.name, calls: x.calls.length, variants: all, groupId: g.id };
    })
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    .slice(0, topN);
  return {
    calls: calls.length,
    withIntel: withIntel.length,
    closed: withIntel.filter((c) => closed(c.outcome)).length,
    winRate: winRate(withIntel),
    competitors,
    topics,
  };
}
