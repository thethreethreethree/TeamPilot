/**
 * Message adoption (2026-11-23; ledger F18.1/F18.2 "Initiative board / adoption calculation", graded LACK). A keyword
 * tracker names a message the team should be saying ("the new bundle", "ask about the decision date"). Adoption is the
 * share of calls that say it — overall, per rep and week by week. Pure, so the counting is tested.
 *
 * WHICH CALLS COUNT. A tracker listens to calls analysed after it was created; older calls can be scanned on request,
 * so counting them would mix heard and unheard calls. The denominator is therefore: calls that STARTED on or after the
 * tracker's creation and have been analysed (they have talk stats). A call counts as "said it" only if its CURRENT
 * transcript version (the newest stats version — re-analysed after a trim or correction) has a hit, so a mention a
 * correction removed no longer counts.
 */
export type AdoptionCall = { sessionId: string; repId: string; startedAt: string; version: number };
export type AdoptionHit = { sessionId: string; version: number };
export type RepAdoption = { repId: string; calls: number; said: number; rate: number | null };
export type WeekAdoption = { weekStart: string; calls: number; said: number; rate: number | null };

const rate = (said: number, calls: number) => (calls ? said / calls : null);

/** Monday (UTC) of the week an instant falls in, as YYYY-MM-DD. */
export function weekOf(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10);
}

export function computeAdoption(trackerCreatedAt: string, calls: AdoptionCall[], hits: AdoptionHit[]) {
  const since = Date.parse(trackerCreatedAt);
  const counted = calls.filter((c) => Date.parse(c.startedAt) >= since);
  const said = new Set(hits.map((h) => `${h.sessionId}|${h.version}`));
  const saidIt = (c: AdoptionCall) => said.has(`${c.sessionId}|${c.version}`);

  const byRep = new Map<string, { calls: number; said: number }>();
  const byWeek = new Map<string, { calls: number; said: number }>();
  for (const c of counted) {
    const r = byRep.get(c.repId) ?? { calls: 0, said: 0 };
    const w = byWeek.get(weekOf(c.startedAt)) ?? { calls: 0, said: 0 };
    r.calls += 1;
    w.calls += 1;
    if (saidIt(c)) {
      r.said += 1;
      w.said += 1;
    }
    byRep.set(c.repId, r);
    byWeek.set(weekOf(c.startedAt), w);
  }
  const total = counted.length;
  const totalSaid = counted.filter(saidIt).length;
  return {
    calls: total,
    said: totalSaid,
    rate: rate(totalSaid, total),
    reps: [...byRep.entries()].map(([repId, v]) => ({ repId, ...v, rate: rate(v.said, v.calls) })) as RepAdoption[],
    weeks: [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([weekStart, v]) => ({ weekStart, ...v, rate: rate(v.said, v.calls) })) as WeekAdoption[],
  };
}
