import { describe, it, expect } from "vitest";
import { pickResultText } from "../CareRadialHome";

const FALLBACK = "Done. Open this conversation on desktop for the full result.";

// pickResultText turns a tool route's JSON (which varies by tool) into one display string for the mobile
// result sheet. It must be robust to shape differences AND never return blank (the fallback). Locking the
// key precedence + the graceful fallback so a route response-shape change can't silently blank the result.
describe("pickResultText — mobile tool result → display string", () => {
  it("summarize: top-level {summary}", () => {
    expect(pickResultText({ summary: "The customer wants a refund." })).toBe("The customer wants a refund.");
  });

  it("co-pilot: top-level {draft}", () => {
    expect(pickResultText({ draft: "Happy to help with that." })).toBe("Happy to help with that.");
  });

  it("dissect/coach: digs into a nested object for the first human-readable field", () => {
    expect(pickResultText({ dissect: { suggestedRevision: "Try leading with the fix." } }))
      .toBe("Try leading with the fix.");
    expect(pickResultText({ response: { diagnosis: "Tone is defensive." } })).toBe("Tone is defensive.");
  });

  it("skips empty/whitespace string fields and falls through", () => {
    // summary is blank → should NOT return it; no other field → fallback.
    expect(pickResultText({ summary: "   " })).toBe(FALLBACK);
  });

  it("unrecognized shape / null / non-object → graceful fallback, never blank", () => {
    expect(pickResultText({ somethingElse: "x" })).toBe(FALLBACK);
    expect(pickResultText(null)).toBe(FALLBACK);
    expect(pickResultText("a bare string")).toBe(FALLBACK);
    expect(pickResultText(undefined)).toBe(FALLBACK);
  });

  it("prefers the first matching top-level key over a later one", () => {
    // "summary" precedes "text" in the key list.
    expect(pickResultText({ text: "second", summary: "first" })).toBe("first");
  });
});
