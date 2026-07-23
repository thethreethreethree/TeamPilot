import { describe, it, expect } from "vitest";
import { handoffCaptureNeeded } from "@/app/api/care/conversations/[id]/messages/route";

/**
 * Locks WHEN the widget shows the HandoffCard (capture the customer's name/email/concern). GET and POST
 * both gate on this one function, so its truth table is a contract: capture ONLY when the AI has handed
 * the thread to a human (aiResponding=false) AND we haven't already captured them (no handoffTopic and no
 * customerId). A regression that dropped either the aiResponding check or the already-captured check would
 * either nag a known customer on every message or miss the capture entirely — both silent UX failures.
 */
describe("handoffCaptureNeeded — when to show the capture card", () => {
  it("NO while the AI is still responding (regardless of capture state)", () => {
    expect(handoffCaptureNeeded({ aiResponding: true, handoffTopic: null, customerId: null })).toBe(false);
    expect(handoffCaptureNeeded({ aiResponding: true, handoffTopic: "billing", customerId: "c1" })).toBe(false);
  });

  it("YES once handed to a human AND nothing captured yet", () => {
    expect(handoffCaptureNeeded({ aiResponding: false, handoffTopic: null, customerId: null })).toBe(true);
  });

  it("NO once handed off but the concern (handoffTopic) is already captured", () => {
    expect(handoffCaptureNeeded({ aiResponding: false, handoffTopic: "refund", customerId: null })).toBe(false);
  });

  it("NO once handed off but the customer is already known (customerId)", () => {
    expect(handoffCaptureNeeded({ aiResponding: false, handoffTopic: null, customerId: "cust-9" })).toBe(false);
  });

  it("NO when both signals are present", () => {
    expect(handoffCaptureNeeded({ aiResponding: false, handoffTopic: "refund", customerId: "cust-9" })).toBe(false);
  });

  it("treats an empty-string handoffTopic as 'not captured' (falsy) — capture still needed", () => {
    // The gate uses truthiness; an empty string is falsy, so a blank topic must NOT count as captured.
    expect(handoffCaptureNeeded({ aiResponding: false, handoffTopic: "", customerId: null })).toBe(true);
  });
});
