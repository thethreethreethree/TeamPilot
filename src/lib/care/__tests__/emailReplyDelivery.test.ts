import { describe, it, expect } from "vitest";
import { resolveEmailReplyBody } from "../emailReplyDelivery";

const NOTICE = "You're being connected with a member of our support team.";

describe("resolveEmailReplyBody — a handoff never leaves the customer in silence (§3.3)", () => {
  it("sends a non-empty reply as-is", () => {
    expect(resolveEmailReplyBody("Your refund is approved.", false, NOTICE)).toBe(
      "Your refund is approved."
    );
  });

  it("does NOT append the notice to a non-empty handoff reply (no double-email)", () => {
    // The AI's own line already says it's handing off warmly; a second notice would double-email.
    expect(resolveEmailReplyBody("Let me bring in a specialist.", true, NOTICE)).toBe(
      "Let me bring in a specialist."
    );
  });

  it("falls back to the notice on an empty (sentinel-only) handoff — the silence bug", () => {
    expect(resolveEmailReplyBody("", true, NOTICE)).toBe(NOTICE);
  });

  it("sends nothing on an empty reply that is NOT a handoff", () => {
    expect(resolveEmailReplyBody("", false, NOTICE)).toBe("");
  });
});
