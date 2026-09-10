/**
 * Whose dropped call gets recovered first, when the budget is smaller than the backlog.
 *
 * THE STARVATION THIS PREVENTS. The recovery sweep orders candidates OLDEST FIRST and stops
 * at a per-run cap. Oldest-first is right and load-bearing: `recording-purge-cron` keeps only
 * each rep's 20 most recent recordings, so a dropped call is on a clock and the oldest are
 * closest to losing their audio permanently.
 *
 * But applied across ALL companies at once it has a failure mode that never announces itself.
 * One tenant sitting on a large backlog of old dropped calls fills every run, forever, and a
 * second company's dropped calls are never reached — while their audio ages toward the same
 * purge. Nothing errors. The sweep reports a healthy `recovered` count every hour. The starved
 * tenant simply never appears in it.
 *
 * It is not a distant scenario for this system: on 10 September 2026 the dropped sessions
 * spanned THREE account prefixes and the permanently-failed pitches spanned TWO companies.
 *
 * SO THE ORDER IS ROUND-ROBIN BETWEEN COMPANIES, OLDEST-FIRST WITHIN ONE. Each company's
 * turn takes its most endangered call. Every tenant is reached on every run the budget allows,
 * and no tenant can hold the queue.
 *
 * Deliberately NOT a fairness score, a weighting, or a per-company quota. Those need tuning,
 * and a tuned number is a number somebody has to maintain. Taking turns needs none.
 */

/** The only thing the ordering needs to know about a candidate. */
export type SweepCandidate = { companyId: string | null };

/**
 * Reorder oldest-first candidates so companies take turns.
 *
 * Input order is preserved WITHIN each company, so whatever the caller sorted by — here,
 * oldest first — still decides which of that company's calls goes next.
 *
 * A candidate with no company keeps its place in the sequence rather than being dropped: the
 * caller skips it for its own reasons, and silently removing rows here would make the two
 * disagree about how many candidates existed.
 */
export function interleaveByCompany<T extends SweepCandidate>(rows: T[]): T[] {
  const queues = new Map<string, T[]>();
  const order: string[] = [];

  for (const row of rows) {
    // Null companies share one queue keyed by a value no uuid can equal, so they are still
    // served in turn instead of clustering at one end.
    const key = row.companyId ?? "__no-company__";
    let q = queues.get(key);
    if (!q) {
      q = [];
      queues.set(key, q);
      order.push(key); // first appearance decides a company's place in the rotation
    }
    q.push(row);
  }

  const out: T[] = [];
  let drained = false;
  while (!drained) {
    drained = true;
    for (const key of order) {
      const q = queues.get(key);
      if (q && q.length > 0) {
        out.push(q.shift() as T);
        drained = false;
      }
    }
  }
  return out;
}
