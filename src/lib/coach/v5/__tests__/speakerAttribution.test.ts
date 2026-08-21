import { describe, expect, it } from "vitest";
import {
  guessSpeakerFromContent,
  composeProvisional,
  shouldReleaseLock,
} from "../speakerAttribution";

/**
 * Speaker attribution — the instant content tell + the signal composition.
 * Pins the EXACT turns from the 2026-07-06 live test that loudness mislabeled,
 * the offer-vs-ask asymmetry, the false-positive guards, and the compose
 * priority (manual > content > pitch > loudness).
 */
describe("guessSpeakerFromContent — the live-test turns", () => {
  it("'How about I show you the pricing?' → salesperson (offering)", () => {
    expect(
      guessSpeakerFromContent(
        "You know what? How about I show you exactly what pricing you get? Does that interest you?"
      )
    ).toBe("agent");
  });
  it("'I wanna see the pricing... can you give me more detail?' → prospect (asking)", () => {
    expect(
      guessSpeakerFromContent(
        "Mm, actually, yes. Uh, I wanna see the pricing, yeah. And can you give me more detail about the product?"
      )
    ).toBe("customer");
  });
  it("'I can give you more detail about the product' → salesperson (offering)", () => {
    expect(
      guessSpeakerFromContent("Yes, of course, I can give you more detail about the product.")
    ).toBe("agent");
  });
});

describe("guessSpeakerFromContent — asymmetry + guards", () => {
  it("distinguishes offering from asking for the same thing", () => {
    expect(guessSpeakerFromContent("let me show you how it works")).toBe("agent");
    expect(guessSpeakerFromContent("can you show me how it works")).toBe("customer");
    expect(guessSpeakerFromContent("how much does it cost")).toBe("customer");
  });
  it("returns null on no clear tell OR a lookalike (voice decides)", () => {
    expect(guessSpeakerFromContent("mhm, right, okay")).toBeNull();
    expect(guessSpeakerFromContent("how much detail do you want on pricing?")).toBeNull();
    expect(guessSpeakerFromContent("do you have any questions so far?")).toBeNull();
    expect(guessSpeakerFromContent("we have about 50 people on the team")).toBeNull();
  });

  it("covers the seller-pitch category (describing the offering)", () => {
    expect(guessSpeakerFromContent("we offer a full onboarding package")).toBe("agent");
    expect(guessSpeakerFromContent("our product handles that automatically")).toBe("agent");
    expect(guessSpeakerFromContent("the way it works is you set it once")).toBe("agent");
  });

  it("covers the buyer-need category (stating own situation/doubt)", () => {
    expect(guessSpeakerFromContent("honestly I'm not sure this is for us")).toBe("customer");
    expect(guessSpeakerFromContent("we're looking for something simpler")).toBe("customer");
    expect(guessSpeakerFromContent("my concern is the setup time")).toBe("customer");
    expect(guessSpeakerFromContent("is there a discount for annual")).toBe("customer");
  });
});

describe("composeProvisional — signal priority (A16)", () => {
  const base = {
    locked: false,
    content: null as "agent" | "customer" | null,
    pitch: null as "agent" | "customer" | null,
    pitchTrusted: false,
    loudness: "agent" as "agent" | "customer",
  };

  it("manual toggle wins over everything", () => {
    expect(
      composeProvisional({ ...base, locked: true, content: "customer", pitch: "customer", pitchTrusted: true, loudness: "customer" })
    ).toEqual({ speaker: "agent", source: "manual" });
  });
  it("content beats pitch and loudness", () => {
    expect(
      composeProvisional({ ...base, content: "customer", pitch: "agent", pitchTrusted: true, loudness: "agent" })
    ).toEqual({ speaker: "customer", source: "content" });
  });
  it("trusted pitch beats loudness when there's no content tell", () => {
    expect(
      composeProvisional({ ...base, content: null, pitch: "customer", pitchTrusted: true, loudness: "agent" })
    ).toEqual({ speaker: "customer", source: "pitch" });
  });
  it("falls back to loudness when pitch is untrusted and no content", () => {
    expect(
      composeProvisional({ ...base, content: null, pitch: "customer", pitchTrusted: false, loudness: "agent" })
    ).toEqual({ speaker: "agent", source: "loudness" });
  });

  it("video mic-only OVERRIDES every signal → rep (mic is agent-only)", () => {
    // The mic physically holds only the rep on a video call; the prospect is on
    // the far end. So even a strong customer content tell + trusted customer
    // pitch + customer loudness must resolve to the rep — never a phantom
    // prospect turn (§3.4; the 2026-07-06 mic-only-video fix).
    expect(
      composeProvisional({
        locked: false,
        content: "customer",
        pitch: "customer",
        pitchTrusted: true,
        loudness: "customer",
        isVideo: true,
      })
    ).toEqual({ speaker: "agent", source: "video-mic" });
  });

  it("isVideo:false leaves in-person composition unchanged (default path)", () => {
    expect(
      composeProvisional({ ...base, content: "customer", isVideo: false })
    ).toEqual({ speaker: "customer", source: "content" });
  });
});

describe("shouldReleaseLock — smart auto-release of a stuck 'I'm speaking' lock (founder 2026-08-21)", () => {
  it("releases ONLY when the lock is held AND the content is an unambiguous customer tell", () => {
    // The stuck-lock collapse: the rep held the lock, but the customer plainly spoke → release so the
    // customer's turn (and the ones after) attribute normally instead of inheriting "agent".
    expect(shouldReleaseLock(true, "customer")).toBe(true);
  });

  it("does NOT release when the lock isn't held (nothing to release)", () => {
    expect(shouldReleaseLock(false, "customer")).toBe(false);
  });

  it("does NOT release on an agent tell or an ambiguous turn (only a customer tell overturns the rep's toggle)", () => {
    // A held lock + agent content AGREES with the lock → stay locked. A held lock + no tell (null) is the
    // normal multi-sentence pitch → stay locked so pitch/loudness can't wrongly overturn ground truth.
    expect(shouldReleaseLock(true, "agent")).toBe(false);
    expect(shouldReleaseLock(true, null)).toBe(false);
  });
});
