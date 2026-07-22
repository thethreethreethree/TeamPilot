import { describe, it, expect } from "vitest";
import { sessionContextLines, DEFAULT_METHODOLOGY } from "../prepShared";
import type { SalesSession } from "@/lib/data/salesCoach";

/**
 * sessionContextLines is the ONE shared source (audit F3 / §A21) that both the pre-knock briefing and Prep-Time
 * Q&A use to turn a captured call into prompt lines — so a regression here silently degrades both engines. Pins
 * the field filtering (empty optionals dropped) and the in-person vs online phrasing.
 */

const session = (over: Partial<SalesSession> = {}): SalesSession =>
  ({ context: "video", ...over }) as SalesSession;

describe("sessionContextLines", () => {
  it("always includes the Context line and renders online vs in-person distinctly", () => {
    expect(sessionContextLines(session({ context: "video" })).join("\n")).toContain("online video call");
    expect(sessionContextLines(session({ context: "in_person" })).join("\n")).toContain("in-person, door-to-door");
  });

  it("includes each optional field only when present", () => {
    const lines = sessionContextLines(
      session({
        context: "in_person",
        clientLabel: "Acme spring campaign",
        territory: "North side",
        approach: "referral intro",
        offer: "annual plan",
      })
    );
    expect(lines).toEqual([
      "Client / campaign: Acme spring campaign",
      "Context: in-person, door-to-door",
      "Where: North side",
      "How approaching: referral intro",
      "Offer: annual plan",
    ]);
  });

  it("drops empty/missing optionals, leaving only the Context line", () => {
    expect(sessionContextLines(session({ context: "video", clientLabel: "", territory: undefined }))).toEqual([
      "Context: online video call",
    ]);
  });

  it("ships a non-empty default methodology for engines to reason from", () => {
    expect(DEFAULT_METHODOLOGY).toContain("DISCOVERY before pitch");
    expect(DEFAULT_METHODOLOGY.length).toBeGreaterThan(50);
  });
});
