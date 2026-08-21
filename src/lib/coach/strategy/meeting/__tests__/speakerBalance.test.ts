import { describe, it, expect } from "vitest";
import { computeSpeakerBalance, DOMINANCE_PCT } from "../speakerBalance";

/**
 * Balance = the plan's §3.1 "imbalance" monitor, realized in the Dissect (the live coach can't ground it — A39 —
 * but the batch-diarized transcript can). Measured by WORD share; null below 2 speaking participants (§3.4 —
 * can't assess balance from one voice, so say nothing rather than fabricate).
 */
const seg = (speaker: string, text: string) => ({ speaker, text });

describe("computeSpeakerBalance", () => {
  it("returns null with fewer than 2 speaking participants (can't assess)", () => {
    expect(computeSpeakerBalance([seg("Alex", "hello there friend")])).toBeNull();
    expect(computeSpeakerBalance([])).toBeNull();
    // a second speaker who says nothing (no words) doesn't count
    expect(computeSpeakerBalance([seg("Alex", "hello"), seg("Dana", "   ")])).toBeNull();
  });

  it("reports balanced when no one voice exceeds the dominance threshold", () => {
    const b = computeSpeakerBalance([seg("Alex", "one two three four five"), seg("Dana", "six seven eight nine ten")]);
    expect(b).not.toBeNull();
    expect(b!.speakers).toBe(2);
    expect(b!.dominantSharePct).toBe(50);
    expect(b!.balanced).toBe(true);
  });

  it("flags a dominating voice (word share above the threshold), naming the dominant speaker", () => {
    // Alex: 8 words, Dana: 2 → Alex 80%
    const b = computeSpeakerBalance([
      seg("Alex", "a a a a a a a a"),
      seg("Dana", "b b"),
    ]);
    expect(b!.dominantSharePct).toBeGreaterThan(DOMINANCE_PCT);
    expect(b!.balanced).toBe(false);
    expect(b!.dominantSpeaker).toBe("Alex");
    expect(b!.note).toMatch(/dominated/i);
  });

  it("measures WORDS not turns — many short interjections don't read as domination", () => {
    // Bo has 5 tiny turns (5 words) but Al has one long turn (10 words) → Al dominant by words, not turn count
    const segs = [
      seg("Al", "one two three four five six seven eight nine ten"),
      seg("Bo", "ok"), seg("Bo", "sure"), seg("Bo", "yes"), seg("Bo", "right"), seg("Bo", "mhm"),
    ];
    const b = computeSpeakerBalance(segs)!;
    expect(b.dominantSpeaker).toBe("Al");
    expect(b.dominantSharePct).toBe(67); // 10 / 15
  });
});
