import { describe, expect, it } from "vitest";
import { parseIntel } from "../salesIntel";

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
