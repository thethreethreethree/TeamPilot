import { describe, it, expect } from "vitest";
import { shouldOfferBlankReadRecovery } from "../blankReadRecovery";

/**
 * blankReadRecovery — the manual one-tap recovery card is the FALLBACK to the automatic
 * server re-transcribe. The honesty invariant (§3.4): never offer re-transcribe on a
 * two-sided call (null gap), and never show the "tap to recover" card while auto-recover
 * is still handling the customer-missing case.
 */

describe("shouldOfferBlankReadRecovery", () => {
  it("hides on a healthy/starved two-sided read (null gap) — no false 'wasn't captured' diagnosis", () => {
    expect(
      shouldOfferBlankReadRecovery({ gap: null, hasSavedRecording: true, autoRecoverResolved: true })
    ).toBe(false);
  });

  it("hides when there is no saved audio (nothing to re-transcribe)", () => {
    expect(
      shouldOfferBlankReadRecovery({
        gap: "customer-missing",
        hasSavedRecording: false,
        autoRecoverResolved: true,
      })
    ).toBe(false);
  });

  it("customer-missing: HIDDEN while auto-recover is still in flight (not yet resolved)", () => {
    expect(
      shouldOfferBlankReadRecovery({
        gap: "customer-missing",
        hasSavedRecording: true,
        autoRecoverResolved: false,
      })
    ).toBe(false);
  });

  it("customer-missing: SHOWS once auto-recover resolved without recovering (manual fallback)", () => {
    expect(
      shouldOfferBlankReadRecovery({
        gap: "customer-missing",
        hasSavedRecording: true,
        autoRecoverResolved: true,
      })
    ).toBe(true);
  });

  it("agent-missing: SHOWS immediately (auto-recover doesn't own this direction)", () => {
    expect(
      shouldOfferBlankReadRecovery({
        gap: "agent-missing",
        hasSavedRecording: true,
        autoRecoverResolved: false,
      })
    ).toBe(true);
  });
});
