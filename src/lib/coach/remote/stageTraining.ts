/**
 * Training by deal stage (2026-11-23; migration 0310). A manager tags a scenario with a pipeline stage name; a rep
 * whose open prospect is at that stage can start it as their own practice, due on the prospect's next call.
 */

/** The match key for a free-text stage name. Mirrors public.rss_stage_key (0310) term-for-term (§2.2): trim, collapse
 *  inner whitespace to one space, lower case. */
export const stageKey = (label: string | null | undefined): string => (label ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** A stage name a manager may tag with: 1-60 characters once trimmed, or null. */
export function cleanStageLabel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length >= 1 && t.length <= 60 ? t : null;
}

/** When a self-started practice is due: the end of the prospect's next call day if it is today or later, else in
 *  three days. `now` is injectable for tests. */
export function selfStartDue(nextCallDate: string | null, now: Date = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  if (nextCallDate && /^\d{4}-\d{2}-\d{2}$/.test(nextCallDate) && nextCallDate >= today) return `${nextCallDate}T23:59:00.000Z`;
  return new Date(now.getTime() + 3 * 86_400_000).toISOString();
}

/** Distinct stage names in use, by key, keeping the most common spelling; sorted by name. */
export function stagesInUse(labels: Array<string | null>): string[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const l of labels) {
    const clean = cleanStageLabel(l);
    if (!clean) continue;
    const k = stageKey(clean);
    const m = byKey.get(k) ?? new Map<string, number>();
    m.set(clean, (m.get(clean) ?? 0) + 1);
    byKey.set(k, m);
  }
  return [...byKey.values()].map((m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0]).sort((a, b) => a.localeCompare(b));
}
