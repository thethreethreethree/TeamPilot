/**
 * Near-duplicate accounts (revenue plan 04-REVENUE-RULES "Account matching"). Accounts are matched and created on an
 * exact key (rss_account_key, 0370 — the SQL is the authority for that). Legal suffixes are deliberately NOT stripped
 * there, because "Acme" and "Acme Inc" can be two companies; instead such near matches are SHOWN to a person, who
 * decides (by moving deals to one account). Nothing here links or merges anything. Pure, so it is tested.
 */
const SUFFIX = /\s(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|pty|sa|bv)$/;

/** Lowercase, accents and punctuation dropped, then one trailing legal suffix removed. */
export function looseKey(name: string): string {
  const k = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return k.replace(SUFFIX, "").trim();
}

/** Groups of two or more accounts whose names differ only by case, punctuation, accents or a legal suffix. */
export function nearMatches<A extends { id: string; name: string }>(accounts: A[]): A[][] {
  const by = new Map<string, A[]>();
  for (const a of accounts) {
    const k = looseKey(a.name);
    if (!k) continue;
    by.set(k, [...(by.get(k) ?? []), a]);
  }
  return [...by.values()].filter((g) => g.length > 1);
}
