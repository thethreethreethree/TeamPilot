/**
 * What the team's calls cover (2026-11-25; Gong ledger F10.11 "Topic and tracker share per team"): over a period's
 * phone/video calls, the share of calls where each keyword/smart tracker fired, and the share whose AI read named each
 * topic. Counted the way Remote Sales Search counts them, so a share's link opens the calls it counted: a tracker
 * "fired" on a call when it has any hit row for it; a call's topics are its LATEST intel read's. Below MIN_CALLS calls
 * the shares are not given (a percentage of three calls says nothing — Gong's own floor is four). Pure.
 */
import { trackerAppliesTo } from "./trackers";

export const MIN_CALLS = 4;
const TOP_TOPICS = 10;

export type CoverageInput = {
  callIds: string[];
  /** Each call's start and channel (review 2026-11-26), so a tracker's share is over the calls it listens to. */
  callInfo?: Map<string, { startedAt: string | null; channel: string | null }>;
  trackers: Array<{ id: string; name: string; active: boolean; starts_on?: string | null; ends_on?: string | null; channels?: string[] | null }>;
  hits: Array<{ trackerId: string; sessionId: string }>;
  /** coach.session_intel_generated events, NEWEST FIRST (the first per call is its latest read). */
  intel: Array<{ subject: string | null; payload: unknown }>;
};
export type Share = { calls: number; share: number };
export type Coverage = {
  calls: number;
  enough: boolean;
  /** `of` = the calls this tracker listens to (its dates and call types); the share is over those. */
  /** enough: this tracker listens to at least MIN_CALLS of the period's calls (review 2026-11-26) — else no share is given. */
  trackers: Array<{ id: string; name: string; active: boolean; of: number; enough: boolean } & Share>;
  topics: Array<{ topic: string } & Share>;
};

export function coverageShare(input: CoverageInput): Coverage {
  const calls = new Set(input.callIds);
  const n = calls.size;
  const enough = n >= MIN_CALLS;
  const share = (k: number) => (n ? k / n : 0);

  const firedOn = new Map<string, Set<string>>();
  for (const h of input.hits) {
    if (!calls.has(h.sessionId)) continue;
    const s = firedOn.get(h.trackerId) ?? new Set<string>();
    s.add(h.sessionId);
    firedOn.set(h.trackerId, s);
  }
  // Every active tracker is listed (0% is an answer); a retired one only if it fired in the period.
  const trackers = input.trackers
    .filter((t) => t.active || (firedOn.get(t.id)?.size ?? 0) > 0)
    .map((t) => {
      // A tracker's share is over the calls it listens to (review 2026-11-26): a video-only or dated tracker could never
      // fire on the others, so counting them understated it — the same rule adoption uses (trackerAppliesTo, §2.2).
      const scoped = !!(t.starts_on || t.ends_on || t.channels?.length) && input.callInfo;
      const of = scoped ? [...calls].filter((id) => { const c = input.callInfo!.get(id); return trackerAppliesTo(t, c?.startedAt ?? null, c?.channel ?? null); }).length : n;
      const k = scoped ? [...(firedOn.get(t.id) ?? [])].filter((id) => { const c = input.callInfo!.get(id); return trackerAppliesTo(t, c?.startedAt ?? null, c?.channel ?? null); }).length : firedOn.get(t.id)?.size ?? 0;
      return { id: t.id, name: t.name, active: t.active, calls: k, of, enough: of >= MIN_CALLS, share: of ? k / of : 0 };
    })
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));

  const seen = new Set<string>();
  const topicCalls = new Map<string, { label: string; ids: Set<string> }>();
  for (const e of input.intel) {
    const id = typeof e.subject === "string" && e.subject.startsWith("sales_session:") ? e.subject.slice("sales_session:".length) : null;
    if (!id || !calls.has(id) || seen.has(id)) continue;
    seen.add(id);
    const topics = (e.payload as { intel?: { topics?: unknown } } | null)?.intel?.topics;
    if (!Array.isArray(topics)) continue;
    for (const t of topics) {
      if (typeof t !== "string" || !t.trim()) continue;
      const key = t.trim().toLowerCase();
      const entry = topicCalls.get(key) ?? { label: t.trim(), ids: new Set<string>() };
      entry.ids.add(id);
      topicCalls.set(key, entry);
    }
  }
  const topics = [...topicCalls.values()]
    .map((e) => ({ topic: e.label, calls: e.ids.size, share: share(e.ids.size) }))
    .sort((a, b) => b.calls - a.calls || a.topic.localeCompare(b.topic))
    .slice(0, TOP_TOPICS);

  return { calls: n, enough, trackers, topics };
}
