/**
 * Build the role-labeled recent-turns context for a customer-facing C.A.R.E AI reply
 * (buildCareUserMessage's `recentTurns`).
 *
 * Extracted so the widget messages route AND the inbound-email route share ONE implementation
 * (A13 vocabulary-once): they had copy-pasted this logic, and the copies DRIFTED — the email route
 * silently shipped with `recentTurns: []`, so the email AI replied context-blind (re-introducing
 * itself every turn). One shared, tested function makes that divergence impossible (A14).
 *
 * Pure + structurally typed (no server import) so the role-mapping / slice / exclusion branches are
 * unit-tested directly.
 */
export interface RecentTurnSource {
  id: string;
  authorType: "customer" | "ai" | "agent" | "system";
  body: string;
}

export interface RecentTurn {
  role: "customer" | "agent" | "ai";
  body: string;
}

/** Turns of prior thread the customer-facing AI sees as context. */
export const VISIBLE_TURNS_IN_CONTEXT = 12;

/**
 * @param messages         full thread, oldest-first (as listCareMessagesForCustomer returns)
 * @param excludeMessageId the just-inserted customer message — it goes in as `newMessage` separately,
 *                         so it must NOT also appear in the history
 * @param cap              how many most-recent turns to keep (default VISIBLE_TURNS_IN_CONTEXT)
 */
export function buildRecentTurns(
  messages: RecentTurnSource[],
  excludeMessageId: string,
  cap: number = VISIBLE_TURNS_IN_CONTEXT
): RecentTurn[] {
  return messages
    .slice(-cap)
    .filter((m) => m.id !== excludeMessageId)
    .map((m) => ({
      role:
        m.authorType === "customer"
          ? ("customer" as const)
          : m.authorType === "agent"
            ? ("agent" as const)
            : ("ai" as const),
      body: m.body,
    }));
}
