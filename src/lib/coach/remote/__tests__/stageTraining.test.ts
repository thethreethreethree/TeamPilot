import { describe, it, expect } from "vitest";
import { cleanStageLabel, selfStartDue, stageKey, stagesInUse } from "../stageTraining";

describe("stageKey (mirrors public.rss_stage_key, 0310)", () => {
  it("trims, collapses inner spaces, lower-cases", () => {
    expect(stageKey("  Demo   Booked ")).toBe("demo booked"); // PGlite replay of rss_stage_key gave the same
    expect(stageKey("NEGOTIATION")).toBe("negotiation");
    expect(stageKey(null)).toBe("");
  });
});

describe("cleanStageLabel", () => {
  it("accepts 1-60 characters once trimmed", () => {
    expect(cleanStageLabel("  Demo  booked ")).toBe("Demo booked");
    expect(cleanStageLabel("   ")).toBeNull();
    expect(cleanStageLabel("x".repeat(61))).toBeNull();
    expect(cleanStageLabel(3)).toBeNull();
  });
});

describe("selfStartDue", () => {
  const now = new Date("2026-11-23T15:00:00Z");
  it("is the end of the next call day when that is today or later", () => {
    expect(selfStartDue("2026-11-25", now)).toBe("2026-11-25T23:59:00.000Z");
    expect(selfStartDue("2026-11-23", now)).toBe("2026-11-23T23:59:00.000Z");
  });
  it("falls back to three days when there is no next call or it has passed", () => {
    expect(selfStartDue(null, now)).toBe("2026-11-26T15:00:00.000Z");
    expect(selfStartDue("2026-11-01", now)).toBe("2026-11-26T15:00:00.000Z");
  });
});

describe("stagesInUse", () => {
  it("one name per key, the most used spelling, sorted", () => {
    expect(stagesInUse(["Demo", "demo", "Demo", null, "  ", "Negotiation"])).toEqual(["Demo", "Negotiation"]);
  });
});
