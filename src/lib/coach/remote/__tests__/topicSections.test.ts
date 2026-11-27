import { describe, it, expect } from "vitest";
import { parseSections } from "../topicSections";

/** Topic sections (F11.11): only sections the transcript supports — real lines, in order, no gaps or overlaps. */
const lines = Array.from({ length: 10 }, (_, i) => ({ seq: i + 1, speaker: i % 2 ? "customer" : "rep", text: "x", atMs: i * 30_000 }));
const j = (sections: unknown) => JSON.stringify({ sections });

describe("parseSections", () => {
  it("consecutive sections become labelled ranges with times and shares", () => {
    const s = parseSections(j([{ label: "Introductions", from: 1, to: 3 }, { label: "Pricing", from: 4, to: 8 }, { label: "Next steps", from: 9, to: 10 }]), lines)!;
    expect(s.map((x) => x.label)).toEqual(["Introductions", "Pricing", "Next steps"]);
    expect(s[1]).toMatchObject({ fromSeq: 4, toSeq: 8, startMs: 90_000, share: 0.5 });
  });
  it("the first section that skips, overlaps or invents a line ends the read; fewer than two kept is nothing", () => {
    expect(parseSections(j([{ label: "A", from: 1, to: 3 }, { label: "B", from: 4, to: 6 }, { label: "C", from: 8, to: 10 }]), lines)!.map((x) => x.label)).toEqual(["A", "B"]);
    expect(parseSections(j([{ label: "A", from: 1, to: 5 }, { label: "B", from: 3, to: 10 }]), lines)).toBeNull();
    expect(parseSections(j([{ label: "A", from: 1, to: 99 }, { label: "B", from: 100, to: 101 }]), lines)).toBeNull();
  });
  it("a label that isn't a short plain phrase is refused; non-JSON is nothing", () => {
    expect(parseSections(j([{ label: "\"I'll take it\"", from: 1, to: 5 }, { label: "B", from: 6, to: 10 }]), lines)).toBeNull();
    expect(parseSections("not json", lines)).toBeNull();
  });
});
