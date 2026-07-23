/**
 * Pure aggregator for the "What we've noticed" customer-patterns panel (the §A11 mirror).
 *
 * Framework constraints this ENCODES (not decorates):
 *  - A11 — the System COUNTS facts; it never renders a verdict. Output is counts + topic
 *    frequencies only. No "this customer is difficult/loyal/etc."
 *  - §3.2 Understanding Gate — patterns are withheld until enough signals exist. Below
 *    CUSTOMER_PATTERN_MIN_CONVERSATIONS the panel keeps the honest "need more data" state
 *    (enoughData=false), so the System never asserts about someone it hasn't observed enough.
 *  - §3.5 — "resolved" counts the DURABLE resolved_at timestamp, never a mutable status
 *    (a re-opened/archived conversation must not distort the count).
 *
 * Pure so the threshold + top-N + resolved-counting branches are unit-tested (A14).
 */
export interface CustomerPatternRow {
  /** Durable resolution timestamp; null = never resolved. Counts resolved, NOT mutable status. */
  resolvedAt: string | null;
  /** Handover concern topic (machine value), if captured. */
  handoffTopic: string | null;
}

export interface CustomerConcern {
  topic: string;
  count: number;
}

export interface CustomerPatterns {
  totalConversations: number;
  resolvedConversations: number;
  topConcerns: CustomerConcern[];
  /** True once totalConversations ≥ threshold — the §3.2 gate on surfacing patterns. */
  enoughData: boolean;
}

/** Minimum conversations before the System will surface any pattern (§3.2). */
export const CUSTOMER_PATTERN_MIN_CONVERSATIONS = 3;
const MAX_TOP_CONCERNS = 3;

export function aggregateCustomerPatterns(
  rows: CustomerPatternRow[]
): CustomerPatterns {
  const totalConversations = rows.length;
  const resolvedConversations = rows.filter((r) => r.resolvedAt != null).length;

  const topicCounts = new Map<string, number>();
  for (const r of rows) {
    const t = r.handoffTopic?.trim();
    if (t) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }
  const topConcerns = [...topicCounts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    // Stable order: count desc, then topic asc so ties are deterministic.
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, MAX_TOP_CONCERNS);

  return {
    totalConversations,
    resolvedConversations,
    topConcerns,
    enoughData: totalConversations >= CUSTOMER_PATTERN_MIN_CONVERSATIONS,
  };
}
