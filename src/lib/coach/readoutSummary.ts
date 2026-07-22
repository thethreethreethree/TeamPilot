/**
 * §3.5 coach-readout durability summary — the CONSEQUENCE measure.
 *
 * Extracted from api/admin/coach-readout/route.ts so the moat metric's computation is
 * unit-testable in CI (the route needs auth + a DB; this pure function does not). The
 * coach-readout compares COACHED vs UNCOACHED topics on close_durability (held/reopened/
 * partial) — that comparison IS the §3.5 "does the Coach change downstream consequence?"
 * measure. A regression here silently corrupts the moat metric, so the counting lives in
 * one tested place. Behaviour is identical to the former route-local function.
 */

export type TopicStats = {
  total: number;
  closed: number;
  held: number;
  reopened: number;
  partial: number;
  unknown: number;
  avgCloseHours: number | null;
  avgMessages: number;
};

export function summarizeTopicDurability(
  topics: Array<{
    id: string;
    status: string;
    close_durability: string | null;
    created_at: string;
    closed_at: string | null;
  }>,
  msgCountByTopic: Map<string, number>
): TopicStats {
  const total = topics.length;
  // "ever closed" via the durable closed_at, not the mutable status (same
  // §3.4/§3.5 durable-timestamp basis as `unknown` and closeTimesMs below).
  const closed = topics.filter((t) => t.closed_at != null).length;
  const held = topics.filter((t) => t.close_durability === "held").length;
  const reopened = topics.filter((t) => t.close_durability === "reopened").length;
  const partial = topics.filter((t) => t.close_durability === "partial").length;
  // unknown = explicitly "unknown" OR closed-without-a-durability-mark
  // (we want to know how many closed topics never got reviewed at all).
  // Key the "closed" test on the durable `closed_at` timestamp, NOT the mutable
  // `status` field. This is the lesson the CARE analytics already learned
  // (src/app/api/care/agent/analytics/route.ts: counting a mutable status
  // undercounts resolutions when work is later archived — resolved_at/closed_at
  // is the honest measure, §3.4/§3.5). Behavior-identical today (closeTopic sets
  // status='closed' and closed_at together; there is no reopen-to-open flow and
  // 'archived' is unreachable for topics), but forward-correct if a topic can
  // ever be archived after closing — and consistent with closeTimesMs below,
  // which already keys on closed_at.
  const unknown = topics.filter(
    (t) =>
      t.close_durability === "unknown" ||
      (t.closed_at != null && !t.close_durability)
  ).length;
  const closeTimesMs = topics
    .filter((t) => t.closed_at)
    .map(
      (t) =>
        new Date(t.closed_at as string).getTime() -
        new Date(t.created_at).getTime()
    )
    .filter((d) => d > 0);
  const avgCloseHours =
    closeTimesMs.length > 0
      ? closeTimesMs.reduce((a, b) => a + b, 0) / closeTimesMs.length / 3_600_000
      : null;
  const messageCounts = topics.map((t) => msgCountByTopic.get(t.id) ?? 0);
  const avgMessages =
    messageCounts.length > 0
      ? messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length
      : 0;
  return {
    total,
    closed,
    held,
    reopened,
    partial,
    unknown,
    avgCloseHours,
    avgMessages,
  };
}
