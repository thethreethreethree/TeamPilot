import { describe, it, expect } from "vitest";
import {
  buildDecisionSeed,
  type DecisionSeedConversation,
  type DecisionSeedMessage,
} from "../decisionSeed";

const conv = (over: Partial<DecisionSeedConversation> = {}): DecisionSeedConversation => ({
  subject: null,
  handoffTopic: null,
  handoffTopicDetail: null,
  orderNumber: null,
  ...over,
});

const msg = (
  authorType: DecisionSeedMessage["authorType"],
  body: string,
  isInternalNote = false
): DecisionSeedMessage => ({ authorType, body, isInternalNote });

describe("buildDecisionSeed", () => {
  it("uses handoffTopicDetail as the concern when present (strongest signal)", () => {
    const seed = buildDecisionSeed(
      conv({ handoffTopicDetail: "Refund past the 30-day window", subject: "Ticket", handoffTopic: "refund" }),
      []
    );
    expect(seed.situation).toContain("Concern: Refund past the 30-day window");
    expect(seed.sourceLabel).toBe("Refund past the 30-day window");
  });

  it("falls back subject → handoffTopic → placeholder", () => {
    expect(buildDecisionSeed(conv({ subject: "Damaged item" }), []).situation).toContain(
      "Concern: Damaged item"
    );
    expect(buildDecisionSeed(conv({ handoffTopic: "billing" }), []).situation).toContain(
      "Concern: billing"
    );
    expect(buildDecisionSeed(conv(), []).situation).toContain("Concern: (no concern captured)");
  });

  it("includes only customer messages, in their words, skipping internal notes and other roles", () => {
    const seed = buildDecisionSeed(conv({ subject: "X" }), [
      msg("customer", "I was double charged."),
      msg("agent", "Looking into it."),
      msg("ai", "Thanks for reaching out."),
      msg("customer", "It's been a week.", true), // internal note → excluded
    ]);
    expect(seed.situation).toContain('- "I was double charged."');
    expect(seed.situation).not.toContain("Looking into it.");
    expect(seed.situation).not.toContain("Thanks for reaching out.");
    expect(seed.situation).not.toContain("It's been a week.");
  });

  it("renders the no-customer-messages branch honestly", () => {
    const seed = buildDecisionSeed(conv({ subject: "X" }), [msg("agent", "hi")]);
    expect(seed.situation).toContain("(No customer messages captured yet.)");
  });

  it("keeps only the last 6 customer quotes", () => {
    const many = Array.from({ length: 9 }, (_, i) => msg("customer", `q${i}`));
    const seed = buildDecisionSeed(conv({ subject: "X" }), many);
    expect(seed.situation).not.toContain('"q0"');
    expect(seed.situation).not.toContain('"q2"');
    expect(seed.situation).toContain('"q3"');
    expect(seed.situation).toContain('"q8"');
  });

  it("truncates an overlong quote with an ellipsis", () => {
    const long = "x".repeat(600);
    const seed = buildDecisionSeed(conv({ subject: "X" }), [msg("customer", long)]);
    expect(seed.situation).toContain("…");
    expect(seed.situation).not.toContain("x".repeat(600));
  });

  it("includes the order reference only when present", () => {
    expect(
      buildDecisionSeed(conv({ subject: "X", orderNumber: "ORD-42" }), []).situation
    ).toContain("Order reference: ORD-42");
    expect(buildDecisionSeed(conv({ subject: "X" }), []).situation).not.toContain(
      "Order reference:"
    );
  });
});
