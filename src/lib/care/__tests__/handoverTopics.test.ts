import { describe, expect, it } from "vitest";
import {
  handoverTopicsFor,
  findTopic,
  topicNeedsOrderNumber,
  topicIsOther,
  labelForAnyTopic,
  isBusinessType,
} from "../handoverTopics";

/**
 * Handover topic config (0188). The dropdown the customer picks from AND the server-side
 * validator of what they submit are the SAME source, so these pin the contract both sides
 * rely on: the two business-type sets, the "Other" free-text affordance, the order-number
 * trigger, and that a spoofed value is rejected.
 */
describe("handoverTopics", () => {
  it("gives distinct topic sets per business type, each ending in a free-text 'Other'", () => {
    const general = handoverTopicsFor("general");
    const ecommerce = handoverTopicsFor("ecommerce");
    expect(general.length).toBeGreaterThan(0);
    expect(ecommerce.length).toBeGreaterThan(0);
    // Both sets end with the free-text catch-all.
    expect(general.at(-1)?.isOther).toBe(true);
    expect(ecommerce.at(-1)?.isOther).toBe(true);
    // E-commerce carries order-centric topics the general set does not.
    expect(general.some((t) => t.value === "order_tracking")).toBe(false);
    expect(ecommerce.some((t) => t.value === "order_tracking")).toBe(true);
  });

  it("validates a submitted topic against the business type (rejects spoofed / cross-set values)", () => {
    // A general topic is not valid under e-commerce and vice-versa.
    expect(findTopic("general", "order_tracking")).toBeNull();
    expect(findTopic("ecommerce", "how_to")).toBeNull();
    // A real one resolves.
    expect(findTopic("general", "billing")?.value).toBe("billing");
    // Garbage / empty is null, never a throw.
    expect(findTopic("general", "'; drop table --")).toBeNull();
    expect(findTopic("general", null)).toBeNull();
  });

  it("only asks for an order number on e-commerce order-centric topics", () => {
    expect(topicNeedsOrderNumber("ecommerce", "order_tracking")).toBe(true);
    expect(topicNeedsOrderNumber("ecommerce", "product_question")).toBe(false);
    // General never needs an order number.
    expect(topicNeedsOrderNumber("general", "billing")).toBe(false);
  });

  it("flags the free-text 'Other' topic so the widget reveals the text box", () => {
    expect(topicIsOther("general", "other")).toBe(true);
    expect(topicIsOther("ecommerce", "other")).toBe(true);
    expect(topicIsOther("general", "billing")).toBe(false);
  });

  it("labels a stored value for the agent without needing the business type", () => {
    expect(labelForAnyTopic("order_tracking")).toBe("Order tracking");
    expect(labelForAnyTopic("how_to")).toBe("How-to / instructions");
    // Unknown/legacy values fall back to the raw value rather than vanishing.
    expect(labelForAnyTopic("legacy_value")).toBe("legacy_value");
    expect(labelForAnyTopic(null)).toBeNull();
  });

  it("guards the business-type union", () => {
    expect(isBusinessType("general")).toBe(true);
    expect(isBusinessType("ecommerce")).toBe(true);
    expect(isBusinessType("retail")).toBe(false);
    expect(isBusinessType(undefined)).toBe(false);
  });
});
