import { describe, it, expect } from "vitest";
import { cleanSpeakerName, latestSpeakerNames } from "../speakerNames";

describe("speaker names (0343)", () => {
  it("the latest row per speaker wins; an empty latest name clears it; unknown speakers are ignored", () => {
    expect(
      latestSpeakerNames([
        { id: 1, speaker: "customer", name: "Dana" },
        { id: 3, speaker: "customer", name: "Dana Lee" },
        { id: 2, speaker: "rep", name: "Alex" },
        { id: 4, speaker: "rep", name: "" },
        { id: 5, speaker: "unknown", name: "x" },
      ]),
    ).toEqual({ customer: "Dana Lee" });
  });
  it("stored names are trimmed, single-spaced and at most 60 characters", () => {
    expect(cleanSpeakerName("  Dana   Lee \n")).toBe("Dana Lee");
    expect(cleanSpeakerName("x".repeat(80))).toHaveLength(60);
  });
});
