import { describe, expect, it } from "vitest";
import { parseIntel, groundCompetitors } from "../salesIntel";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

const seg = (text: string): TranscriptSegment =>
  ({ id: "s", sessionId: "x", speaker: "customer", text, seq: 0, spokenAt: null }) as TranscriptSegment;

/**
 * parseIntel pins the conversation-intelligence extraction (§3.4 honesty, §A11
 * facts-not-verdict): strings only, trimmed, de-duped case-insensitively,
 * bounded, and malformed model output degrades to empty rather than fabricating.
 */
describe("parseIntel", () => {
  it("extracts competitors + topics", () => {
    const r = parseIntel(
      JSON.stringify({
        competitors: ["Verizon", "AT&T"],
        topics: ["pricing", "internet speed", "outages"],
      })
    );
    expect(r?.competitors).toEqual(["Verizon", "AT&T"]);
    expect(r?.topics).toEqual(["pricing", "internet speed", "outages"]);
  });

  it("returns empty lists (not null) when none were mentioned — honest empty", () => {
    const r = parseIntel(JSON.stringify({ competitors: [], topics: [] }));
    expect(r).toEqual({ competitors: [], topics: [] });
  });

  it("de-dupes case-insensitively and trims", () => {
    const r = parseIntel(
      JSON.stringify({ competitors: ["Verizon", " verizon ", "VERIZON"], topics: [] })
    );
    expect(r?.competitors).toEqual(["Verizon"]);
  });

  it("drops non-string / empty entries", () => {
    const r = parseIntel(
      JSON.stringify({ competitors: ["AT&T", 42, "", null], topics: ["  "] })
    );
    expect(r?.competitors).toEqual(["AT&T"]);
    expect(r?.topics).toEqual([]);
  });

  it("bounds pathological output to 8 items", () => {
    const many = Array.from({ length: 30 }, (_, i) => `topic${i}`);
    const r = parseIntel(JSON.stringify({ competitors: [], topics: many }));
    expect(r?.topics.length).toBe(8);
  });

  it("returns null on malformed JSON (caller degrades to EMPTY)", () => {
    expect(parseIntel("not json")).toBeNull();
  });

  it("tolerates missing keys", () => {
    const r = parseIntel(JSON.stringify({ competitors: ["X"] }));
    expect(r?.competitors).toEqual(["X"]);
    expect(r?.topics).toEqual([]);
  });
});

describe("groundCompetitors — §3.4 anti-fabrication (audit 2026-07-07)", () => {
  const transcript = [
    seg("I already have internet with Verizon."),
    seg("It's fine but sometimes it drops."),
  ];

  it("keeps a competitor that was actually named (case-insensitive)", () => {
    const r = groundCompetitors({ competitors: ["verizon"], topics: [] }, transcript);
    expect(r.competitors).toEqual(["verizon"]);
  });

  it("DROPS a competitor the model invented that was never said", () => {
    const r = groundCompetitors(
      { competitors: ["Verizon", "AT&T", "Comcast"], topics: [] },
      transcript
    );
    expect(r.competitors).toEqual(["Verizon"]); // AT&T + Comcast never appear
  });

  it("leaves topics untouched (they are legitimately paraphrased)", () => {
    const r = groundCompetitors(
      { competitors: [], topics: ["reliability", "pricing"] },
      transcript
    );
    expect(r.topics).toEqual(["reliability", "pricing"]);
  });
});
