/**
 * Rep needs (2026-11-23, migration 0326; ledger M36 "just-in-time training based on pipeline stage and rep needs").
 *
 * How often a rep has lately missed each rubric item — a miss counts 1, a partial ½ — over their recent scored phone &
 * video calls, and the stage's practice scenarios ordered by the weakest item each one is tagged to train. An item needs
 * at least MIN_GRADED grades before it counts as a need: two calls are not a pattern (§3.4). Untagged scenarios keep
 * their order after the tagged ones that match a need. Pure, so the arithmetic is tested.
 */
export const MIN_GRADED = 3;
export type Grade = { elementId: string; grade: "hit" | "partial" | "missed" | string };
export type Need = { elementId: string; rate: number; misses: number; graded: number };

export function missRates(grades: Grade[]): Map<string, Need> {
  const by = new Map<string, { miss: number; part: number; n: number }>();
  for (const g of grades) {
    if (g.grade !== "hit" && g.grade !== "partial" && g.grade !== "missed") continue;
    const e = by.get(g.elementId) ?? { miss: 0, part: 0, n: 0 };
    e.n++;
    if (g.grade === "missed") e.miss++;
    if (g.grade === "partial") e.part++;
    by.set(g.elementId, e);
  }
  const out = new Map<string, Need>();
  for (const [elementId, e] of by) {
    if (e.n < MIN_GRADED) continue;
    const rate = (e.miss + e.part / 2) / e.n;
    if (rate > 0) out.set(elementId, { elementId, rate, misses: e.miss, graded: e.n });
  }
  return out;
}

/** The scenarios, weakest-need first; each gets the need it was ranked by (or null). */
export function rankByNeeds<T extends { id: string }>(scenarios: T[], tags: Map<string, string[]>, needs: Map<string, Need>): Array<T & { need: Need | null }> {
  const scored = scenarios.map((s, i) => {
    const best = (tags.get(s.id) ?? []).map((el) => needs.get(el)).filter((n): n is Need => !!n).sort((a, b) => b.rate - a.rate)[0] ?? null;
    return { s: { ...s, need: best }, i };
  });
  return scored.sort((a, b) => (b.s.need?.rate ?? -1) - (a.s.need?.rate ?? -1) || a.i - b.i).map((x) => x.s);
}
