/**
 * Pipeline → win/loss by how deals ran (2026-11-26; Gong ledger F20.10). Win rate = won ÷ (won + lost), closed deals
 * only, for the pipeline in view — broken down by how many calls a deal had and by its size. Pure, so the arithmetic
 * is tested.
 *
 * HONESTY (§3.4): a rate is shown only from MIN_CLOSED closed deals in that row; below that the row shows its counts and
 * no rate, because 2 of 3 is not "67%". Deal-size bands are this pipeline's own thirds (by closed deals' amounts), not
 * fixed dollar lines that would mean different things to different companies; deals with no amount are their own row.
 */
export const MIN_CLOSED = 5;

import { toCsv } from "@/lib/export/toCsv";

type P = { id?: string; status: "open" | "won" | "lost"; amount: number | null; callCount: number };
/** One row of a breakdown; `ids` are its closed deals, so the row can open them (Gong F20.10: each bar opens its deals). */
export type Band = { label: string; won: number; lost: number; winRate: number | null; ids: string[] };

function band(label: string, rows: P[]): Band {
  const won = rows.filter((r) => r.status === "won").length;
  const lost = rows.filter((r) => r.status === "lost").length;
  return { label, won, lost, winRate: won + lost >= MIN_CLOSED ? won / (won + lost) : null, ids: rows.flatMap((r) => (r.id ? [r.id] : [])) };
}

/**
 * The math behind the breakdowns as CSV (F20.10): one line per row — breakdown, group, won, lost, closed, win rate. A row
 * below MIN_CLOSED has an empty rate, as on screen. Through the shared toCsv (formula-safe, CWE-1236). Pure.
 */
export function winLossCsv(sections: Array<{ breakdown: string; rows: Band[] }>): string {
  return toCsv(
    sections.flatMap((s) => s.rows.map((r) => ({ breakdown: s.breakdown, group: r.label, won: r.won, lost: r.lost, closed: r.won + r.lost, win_rate: r.winRate === null ? "" : (Math.round(r.winRate * 1000) / 10).toFixed(1) }))),
    ["breakdown", "group", "won", "lost", "closed", "win_rate"],
  );
}

const closedDeals = (ps: P[]) => ps.filter((p) => p.status === "won" || p.status === "lost");

/** Win rate on all closed deals in view (null below MIN_CLOSED). */
export function overallWinRate(ps: P[]): Band {
  return band("All closed deals", closedDeals(ps));
}

/** By how many calls the deal had: none, 1, 2–3, 4–6, 7 or more. Empty rows are left out. */
export function byCallCount(ps: P[]): Band[] {
  const c = closedDeals(ps);
  const groups: Array<[string, (n: number) => boolean]> = [
    ["No calls", (n) => n === 0],
    ["1 call", (n) => n === 1],
    ["2–3 calls", (n) => n >= 2 && n <= 3],
    ["4–6 calls", (n) => n >= 4 && n <= 6],
    ["7 or more calls", (n) => n >= 7],
  ];
  return groups.map(([label, test]) => band(label, c.filter((p) => test(p.callCount)))).filter((b) => b.won + b.lost > 0);
}

/**
 * By what was said on a deal's calls (2026-11-26, F20.10): for each tracker heard on closed deals, the win rate when it
 * was mentioned on any of the deal's calls against when it wasn't. `mentions` = prospect id → tracker names heard. The
 * TOP trackers by closed deals mentioned are shown (most first); each side gets a rate only from MIN_CLOSED deals.
 */
export type MentionRow = { tracker: string; mentioned: Band; notMentioned: Band };
export function byMention(ps: Array<P & { id: string }>, mentions: Record<string, string[]>, top = 5, comparable?: Set<string>): MentionRow[] {
  // Only deals that had a call this person can read are compared (review 2026-11-26): a deal with no such call could
  // never have a mention, so counting it as "not mentioned" would measure "had calls", not "this was said".
  const c = (closedDeals(ps) as Array<P & { id: string }>).filter((p) => !comparable || comparable.has(p.id));
  const count = new Map<string, number>();
  for (const p of c) for (const t of new Set(mentions[p.id] ?? [])) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([tracker]) => {
      const heard = c.filter((p) => (mentions[p.id] ?? []).includes(tracker));
      const not = c.filter((p) => !(mentions[p.id] ?? []).includes(tracker));
      return { tracker, mentioned: band("Mentioned", heard), notMentioned: band("Not mentioned", not) };
    });
}

/**
 * By deal size, in thirds of this pipeline's closed deals that have an amount: smaller, middle, larger — each label
 * carries its range. Needs at least 3 such deals to cut; deals with no amount are their own row.
 */
export function byDealSize(ps: P[], money: (n: number) => string): Band[] {
  const c = closedDeals(ps);
  const withAmount = c.filter((p) => typeof p.amount === "number" && p.amount > 0).sort((a, b) => a.amount! - b.amount!);
  const noAmount = c.filter((p) => !(typeof p.amount === "number" && p.amount > 0));
  const out: Band[] = [];
  if (withAmount.length >= 3) {
    // Cut points move past equal amounts (review 2026-11-26), so one amount never shows in two bands.
    const past = (i: number) => {
      let j = i;
      while (j > 0 && j < withAmount.length && withAmount[j]!.amount === withAmount[j - 1]!.amount) j += 1;
      return j;
    };
    const t1 = past(Math.ceil(withAmount.length / 3));
    const t2 = Math.max(t1, past(Math.ceil((2 * withAmount.length) / 3)));
    const parts = [withAmount.slice(0, t1), withAmount.slice(t1, t2), withAmount.slice(t2)];
    const names = ["Smaller", "Middle", "Larger"];
    parts.forEach((rows, i) => {
      if (rows.length === 0) return;
      const lo = rows[0]!.amount!;
      const hi = rows[rows.length - 1]!.amount!;
      out.push(band(`${names[i]} (${lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`})`, rows));
    });
  } else if (withAmount.length) {
    out.push(band("With an amount", withAmount));
  }
  if (noAmount.length) out.push(band("No amount set", noAmount));
  return out;
}

// ── Revenue Phase 4 (0370 contacts, 0375 closed_at; Gong F20.10): by contacts, by power in the deal, by time to close.
type Q = P & { contacts?: number; createdAt?: string; closedAt?: string | null; powerOnDeal?: boolean | null };

/** By how many contacts were on the deal: none, 1, 2–3, 4 or more. Empty rows are left out. */
export function byContactCount(ps: Q[]): Band[] {
  const c = closedDeals(ps) as Q[];
  const groups: Array<[string, (n: number) => boolean]> = [
    ["No contacts", (n) => n === 0],
    ["1 contact", (n) => n === 1],
    ["2–3 contacts", (n) => n >= 2 && n <= 3],
    ["4 or more contacts", (n) => n >= 4],
  ];
  return groups.map(([label, test]) => band(label, c.filter((p) => test(p.contacts ?? 0)))).filter((b) => b.won + b.lost > 0);
}

/**
 * Gong's "power in deal": a director, VP or C-level contact on the deal, against none. Deals whose contacts have no
 * known titles are their own row (powerOnDeal null), never counted as "no power".
 */
export function byPower(ps: Q[]): Band[] {
  const c = closedDeals(ps) as Q[];
  return [
    band("A director, VP or C-level on the deal", c.filter((p) => p.powerOnDeal === true)),
    band("No one that senior", c.filter((p) => p.powerOnDeal === false)),
    band("Titles not known", c.filter((p) => p.powerOnDeal === null || p.powerOnDeal === undefined)),
  ].filter((b) => b.won + b.lost > 0);
}

/** By days from opening to closing: under 30, 30–90, over 90; a deal with no closing date recorded is its own row. */
export function byDuration(ps: Q[]): Band[] {
  const c = closedDeals(ps) as Q[];
  const days = (p: Q) => (p.createdAt && p.closedAt ? (Date.parse(p.closedAt) - Date.parse(p.createdAt)) / 86_400_000 : null);
  return [
    band("Closed in under 30 days", c.filter((p) => { const d = days(p); return d !== null && d < 30; })),
    band("30–90 days", c.filter((p) => { const d = days(p); return d !== null && d >= 30 && d <= 90; })),
    band("Over 90 days", c.filter((p) => { const d = days(p); return d !== null && d > 90; })),
    band("Closing date not recorded", c.filter((p) => days(p) === null)),
  ].filter((b) => b.won + b.lost > 0);
}

/** Whether a deal had a director, VP or C-level contact; null when none of its contacts has a known title. */
export function powerOnDeal(contacts: Array<{ rank: string }> | undefined): boolean | null {
  const known = (contacts ?? []).filter((c) => c.rank !== "unknown");
  if (!known.length) return null;
  return known.some((c) => c.rank === "c_level" || c.rank === "vp" || c.rank === "director");
}
