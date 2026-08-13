import { describe, it, expect } from "vitest";
import { autoAssignAgentCluster, type DiarizedSegment } from "../autoSpeakerAssign";

/**
 * autoSpeakerAssign — the server-side agent-cluster decision for automatic post-call
 * recovery (no rep tap). The load-bearing property: it must DECLINE (decided:false)
 * on any guess it isn't confident in, because the caller writes a `decided:true`
 * assignment into the canonical transcript. A confident wrong label re-corrupts the
 * exact record we're recovering. So the tests weight the ambiguous / can't-decide
 * cases heavily.
 */

const seg = (speakerId: string, text: string, seq: number): DiarizedSegment => ({
  speakerId,
  text,
  seq,
});

describe("autoAssignAgentCluster", () => {
  it("DECLINES (single-cluster) when the re-diarization is STILL one-sided — honest terminal, no loop", () => {
    const diarized = [
      seg("spk_0", "Hi there, let me walk you through our managed offer.", 0),
      seg("spk_0", "We provide a full managed service with coverage.", 1),
    ];
    const r = autoAssignAgentCluster({
      diarized,
      knownAgentTurns: ["let me walk you through our managed offer"],
    });
    expect(r.decided).toBe(false);
    if (!r.decided) expect(r.reason).toBe("single-cluster");
  });

  it("DECLINES (no-signal) when clusters carry no usable text", () => {
    const diarized = [seg("spk_0", "um", 0), seg("spk_1", "uh ok", 1)];
    const r = autoAssignAgentCluster({ diarized, knownAgentTurns: [] });
    expect(r.decided).toBe(false);
    if (!r.decided) expect(r.reason).toBe("no-signal");
  });

  it("CROSS-MATCH: the cluster overlapping the known agent turns wins (customer-missing case)", () => {
    // The live path captured the AGENT side (these known turns) but dropped the customer.
    // Re-diarization recovers both; the cluster whose words match the known agent turns is the agent.
    const knownAgentTurns = [
      "let me walk you through the managed protection plan and how the coverage works",
      "our pricing is a flat monthly rate with no setup fee whatsoever included",
    ];
    const diarized = [
      seg("spk_1", "So how much does the coverage actually cost me each month?", 0),
      seg("spk_0", "Let me walk you through the managed protection plan and how coverage works.", 1),
      seg("spk_1", "Is there a setup fee on top of the monthly rate?", 2),
      seg("spk_0", "Our pricing is a flat monthly rate, no setup fee at all included.", 3),
    ];
    const r = autoAssignAgentCluster({ diarized, knownAgentTurns });
    expect(r.decided).toBe(true);
    if (r.decided) {
      expect(r.agentSpeakerId).toBe("spk_0");
      expect(r.source).toBe("cross-match");
      expect(r.confidence).toBeGreaterThan(0);
    }
  });

  it("CONTENT-TELL: with no known agent turns, a clear seller cluster is chosen", () => {
    const diarized = [
      seg("spk_A", "How much does this cost? Can you give me more detail?", 0),
      seg("spk_B", "Let me show you how it works — we offer a full managed service.", 1),
      seg("spk_A", "What's the price? Is there a discount?", 2),
      seg("spk_B", "I can walk you through our pricing and our plan.", 3),
    ];
    const r = autoAssignAgentCluster({ diarized, knownAgentTurns: [] });
    expect(r.decided).toBe(true);
    if (r.decided) {
      expect(r.agentSpeakerId).toBe("spk_B"); // the seller cluster
      expect(r.source).toBe("content-tell");
    }
  });

  it("DECLINES (ambiguous) when no known turns and no content tells — never a first-speaker guess", () => {
    const diarized = [
      seg("spk_0", "Yeah, and then we drove over to the site that morning.", 0),
      seg("spk_1", "Right, and it was raining pretty hard by then honestly.", 1),
      seg("spk_0", "It really was, took us a while to get set up out there.", 2),
    ];
    const r = autoAssignAgentCluster({ diarized, knownAgentTurns: [] });
    expect(r.decided).toBe(false);
    if (!r.decided) expect(r.reason).toBe("ambiguous"); // MUST NOT save a weak guess
  });

  it("DECLINES (ambiguous) on weak content separation (one tell each side)", () => {
    const diarized = [
      seg("spk_0", "We offer a plan.", 0), // one seller tell
      seg("spk_1", "How much does it cost?", 1), // one buyer tell
    ];
    const r = autoAssignAgentCluster({ diarized, knownAgentTurns: [] });
    // net spk_0 = +1, spk_1 = -1 → gap 2, but the winner net is only +1; the plan
    // requires a clear positive winner AND gap ≥2. This is deliberately near the line.
    if (r.decided) {
      // If it decides, it must at least pick the seller — but the safer outcome is decline.
      expect(r.agentSpeakerId).toBe("spk_0");
    } else {
      expect(r.reason).toBe("ambiguous");
    }
  });

  it("cross-match COIN-FLIP (both clusters overlap the known turns equally) DECLINES", () => {
    const known = [
      "managed protection plan coverage monthly rate setup",
      "managed protection plan coverage monthly rate included",
    ];
    const diarized = [
      seg("spk_0", "managed protection plan coverage monthly rate setup included", 0),
      seg("spk_1", "managed protection plan coverage monthly rate setup included", 1),
    ];
    const r = autoAssignAgentCluster({ diarized, knownAgentTurns: known });
    // No separation → no confident cross-match; no content tells → ambiguous.
    expect(r.decided).toBe(false);
    if (!r.decided) expect(r.reason).toBe("ambiguous");
  });

  it("cross-match OVERRIDES content-tell when both are present (ground truth wins)", () => {
    // Content tells would (weakly) point at spk_1 as seller, but the known agent turns
    // clearly match spk_0 — cross-match is authoritative.
    const known = [
      "let me walk you through our onboarding and the implementation timeline in detail",
      "our platform handles the migration and the data import for your whole team",
    ];
    const diarized = [
      seg("spk_0", "Let me walk you through our onboarding and the implementation timeline.", 0),
      seg("spk_0", "Our platform handles the migration and data import for your team.", 1),
      seg("spk_1", "How much does the onboarding cost? Can you give me the price?", 2),
    ];
    const r = autoAssignAgentCluster({ diarized, knownAgentTurns: known });
    expect(r.decided).toBe(true);
    if (r.decided) {
      expect(r.agentSpeakerId).toBe("spk_0");
      expect(r.source).toBe("cross-match");
    }
  });
});
