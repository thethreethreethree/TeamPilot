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
  const closed = topics.filter((t) => t.status === "closed").length;
  const held = topics.filter((t) => t.close_durability === "held").length;
  const reopened = topics.filter((t) => t.close_durability === "reopened").length;
  const partial = topics.filter((t) => t.close_durability === "partial").length;
  // unknown = explicitly "unknown" OR closed without a durability mark
  // (we want to know how many closed topics never got reviewed at all)
  const unknown = topics.filter(
    (t) =>
      t.close_durability === "unknown" ||
      (t.status === "closed" && !t.close_durability)
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
