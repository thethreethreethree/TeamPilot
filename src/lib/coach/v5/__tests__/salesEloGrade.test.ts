import { describe, it, expect } from "vitest";
import { eloToGrade } from "../salesEloGrade";

describe("eloToGrade", () => {
  it("anchors B at the 1500 competent-call standard", () => {
    expect(eloToGrade(1500).letter).toBe("B");
    expect(eloToGrade(1500).tier).toBe("solid");
  });

  it("maps well above the standard to the A range (strong)", () => {
    expect(eloToGrade(1900).letter).toBe("A+");
    expect(eloToGrade(1800).letter).toBe("A+");
    expect(eloToGrade(1750).letter).toBe("A");
    expect(eloToGrade(1680).letter).toBe("A-");
    expect(eloToGrade(1750).tier).toBe("strong");
  });

  it("maps around the standard to the B range (solid)", () => {
    expect(eloToGrade(1600).letter).toBe("B+");
    expect(eloToGrade(1520).letter).toBe("B");
    expect(eloToGrade(1460).letter).toBe("B-");
    expect(eloToGrade(1460).tier).toBe("solid");
  });

  it("maps below the standard to the C range (developing)", () => {
    expect(eloToGrade(1400).letter).toBe("C+");
    expect(eloToGrade(1330).letter).toBe("C");
    expect(eloToGrade(1250).letter).toBe("C-");
    expect(eloToGrade(1250).tier).toBe("developing");
  });

  it("has NO F — the floor is D / growth-area (§A18)", () => {
    expect(eloToGrade(1229).letter).toBe("D");
    expect(eloToGrade(1000).letter).toBe("D");
    expect(eloToGrade(100).letter).toBe("D");
    // The lowest possible letter is D — never F.
    for (const r of [100, 500, 900, 1100, 1229]) {
      expect(eloToGrade(r).letter).not.toBe("F");
      expect(eloToGrade(r).letter).toBe("D");
      expect(eloToGrade(r).tier).toBe("growth-area");
    }
  });

  it("is total across the full chess-scale bounds [100, 3000] and beyond", () => {
    for (let r = 100; r <= 3000; r += 50) {
      const g = eloToGrade(r);
      expect(g.letter).toBeTruthy();
      expect(["strong", "solid", "developing", "growth-area"]).toContain(g.tier);
    }
    // above the practical ceiling still resolves
    expect(eloToGrade(3000).letter).toBe("A+");
  });

  it("carries the rating it summarizes (rounded) as fromRating (§A11 basis)", () => {
    expect(eloToGrade(1496).fromRating).toBe(1496);
    expect(eloToGrade(1511.6).fromRating).toBe(1512);
  });

  it("band boundaries are inclusive lower bounds (highest match wins)", () => {
    expect(eloToGrade(1800).letter).toBe("A+"); // exactly on boundary
    expect(eloToGrade(1799).letter).toBe("A");
    expect(eloToGrade(1500).letter).toBe("B");
    expect(eloToGrade(1499).letter).toBe("B-");
  });
});
