import { describe, expect, it } from "vitest";
import { hasNewCustomerMessage } from "../chime";

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
