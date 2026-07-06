import { describe, expect, it } from "vitest";
import { hasNewCustomerMessage, inboxHasNewCustomerMessage } from "../chime";

const m = (id: string, authorType: string) => ({ id, authorType });

/**
 * The chime must fire ONLY on a genuinely new customer message — never on the
 * agent's own sends, non-customer messages, or list churn.
 */
describe("hasNewCustomerMessage", () => {
  it("fires when a new customer message appears", () => {
    const prev = [m("1", "customer"), m("2", "agent")];
    const next = [...prev, m("3", "customer")];
    expect(hasNewCustomerMessage(prev, next)).toBe(true);
  });

  it("does NOT fire for the agent's own new message", () => {
    const prev = [m("1", "customer")];
    const next = [...prev, m("2", "agent")];
    expect(hasNewCustomerMessage(prev, next)).toBe(false);
  });

  it("does NOT fire for a new ai or system message", () => {
    const prev = [m("1", "customer")];
    expect(hasNewCustomerMessage(prev, [...prev, m("2", "ai")])).toBe(false);
    expect(hasNewCustomerMessage(prev, [...prev, m("3", "system")])).toBe(false);
  });

  it("does NOT fire when nothing new arrived (same ids)", () => {
    const same = [m("1", "customer"), m("2", "agent")];
    expect(hasNewCustomerMessage(same, [...same])).toBe(false);
  });

  it("does NOT fire on re-order/churn of already-seen messages", () => {
    const prev = [m("1", "customer"), m("2", "agent")];
    const reordered = [m("2", "agent"), m("1", "customer")];
    expect(hasNewCustomerMessage(prev, reordered)).toBe(false);
  });

  it("fires when the first customer message arrives into an empty thread", () => {
    expect(hasNewCustomerMessage([], [m("1", "customer")])).toBe(true);
  });

  it("fires only for the NEW customer message when several arrive at once", () => {
    const prev = [m("1", "agent")];
    const next = [m("1", "agent"), m("2", "customer"), m("3", "agent")];
    expect(hasNewCustomerMessage(prev, next)).toBe(true);
  });
});

const conv = (id: string, at: string | null, author: string | null) => ({
  id,
  lastMessageAt: at,
  lastMessageAuthorType: author,
});

describe("inboxHasNewCustomerMessage — inbox-wide chime (0087)", () => {
  it("fires when a conversation advances to a new customer message", () => {
    const seen = new Map([["a", "2026-07-06T10:00:00Z"]]);
    const now = [conv("a", "2026-07-06T10:05:00Z", "customer")];
    expect(inboxHasNewCustomerMessage(seen, now)).toBe(true);
  });

  it("does NOT fire when the advance was an AI/agent message", () => {
    const seen = new Map([["a", "2026-07-06T10:00:00Z"]]);
    expect(inboxHasNewCustomerMessage(seen, [conv("a", "2026-07-06T10:05:00Z", "ai")])).toBe(false);
    expect(inboxHasNewCustomerMessage(seen, [conv("a", "2026-07-06T10:06:00Z", "agent")])).toBe(false);
  });

  it("does NOT fire when nothing advanced (same timestamp)", () => {
    const seen = new Map([["a", "2026-07-06T10:00:00Z"]]);
    expect(inboxHasNewCustomerMessage(seen, [conv("a", "2026-07-06T10:00:00Z", "customer")])).toBe(false);
  });

  it("EXCLUDES the open conversation (handled by the per-message path — no double chime)", () => {
    const seen = new Map([["a", "2026-07-06T10:00:00Z"]]);
    const now = [conv("a", "2026-07-06T10:05:00Z", "customer")];
    expect(inboxHasNewCustomerMessage(seen, now, "a")).toBe(false);
  });

  it("fires for a brand-new conversation with a customer message (already primed)", () => {
    const seen = new Map<string, string | null>([["a", "2026-07-06T10:00:00Z"]]);
    const now = [conv("a", "2026-07-06T10:00:00Z", "customer"), conv("b", "2026-07-06T10:03:00Z", "customer")];
    expect(inboxHasNewCustomerMessage(seen, now)).toBe(true); // "b" is new
  });

  it("does NOT fire on a new conversation started by AI/agent", () => {
    const seen = new Map<string, string | null>([["a", "2026-07-06T10:00:00Z"]]);
    const now = [conv("a", "2026-07-06T10:00:00Z", "customer"), conv("b", "2026-07-06T10:03:00Z", "agent")];
    expect(inboxHasNewCustomerMessage(seen, now)).toBe(false);
  });
});
