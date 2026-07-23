/**
 * Pure builder for the Decision Dialogue "situation" seed, from a C.A.R.E support
 * conversation. Used by GET /api/care/conversations/[id]/decision-seed to pre-load the
 * decisions page when an agent clicks "Open as Decision Dialogue" on a conversation.
 *
 * Why pure + decoupled: the seed shape carries the customer's ACTUAL words into the
 * decision (§3.1 the record is the asset; §3.3 the decision stays grounded in what was
 * asked, not a paraphrase). Kept free of any server import so it's unit-testable (A14 —
 * verify the branch that has no customer messages, the truncation branch, the
 * concern-fallback chain).
 *
 * Structural input types (compatible with data/care.ts SupportConversation / SupportMessage
 * without importing the server module).
 */
export interface DecisionSeedConversation {
  subject: string | null;
  handoffTopic: string | null;
  handoffTopicDetail: string | null;
  orderNumber: string | null;
}

export interface DecisionSeedMessage {
  authorType: "customer" | "ai" | "agent" | "system";
  body: string;
  isInternalNote: boolean;
}

export interface DecisionSeed {
  /** The pre-filled situation text for the Decision Dialogue's first phase. */
  situation: string;
  /** A short label for the "seeded from…" banner. */
  sourceLabel: string;
}

const MAX_CUSTOMER_QUOTES = 6;
const MAX_QUOTE_LEN = 500;

/** Resolve the customer's concern from the strongest available signal. */
function resolveConcern(c: DecisionSeedConversation): string {
  return (
    c.handoffTopicDetail?.trim() ||
    c.subject?.trim() ||
    c.handoffTopic?.trim() ||
    "(no concern captured)"
  );
}

export function buildDecisionSeed(
  conversation: DecisionSeedConversation,
  messages: DecisionSeedMessage[]
): DecisionSeed {
  const concern = resolveConcern(conversation);

  const customerQuotes = messages
    .filter((m) => m.authorType === "customer" && !m.isInternalNote && m.body.trim())
    .slice(-MAX_CUSTOMER_QUOTES)
    .map((m) => {
      const t = m.body.trim();
      return t.length > MAX_QUOTE_LEN ? `${t.slice(0, MAX_QUOTE_LEN)}…` : t;
    });

  const lines: string[] = [
    "A C.A.R.E support conversation needs a decision — the right next move isn't a simple reply.",
    "",
    `Concern: ${concern}`,
  ];

  const order = conversation.orderNumber?.trim();
  if (order) lines.push(`Order reference: ${order}`);

  lines.push("");
  if (customerQuotes.length > 0) {
    lines.push("What the customer said, in their words:");
    for (const q of customerQuotes) lines.push(`- "${q}"`);
  } else {
    lines.push("(No customer messages captured yet.)");
  }

  return { situation: lines.join("\n"), sourceLabel: concern };
}
