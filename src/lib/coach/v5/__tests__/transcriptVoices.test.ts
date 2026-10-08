import { describe, it, expect } from "vitest";
import { transcriptVoices, voiceLineFromRow } from "../transcriptVoices";

/**
 * The per-voice question (2026-10-08). An all-'unknown' transcript that knows two voices must be answered per
 * voice; answering it as one voice made the customer's words the rep's.
 */
const line = (cluster: string | null, text: string, extra: Record<string, unknown> = {}) => ({
  speaker: "unknown",
  text,
  source: null,
  speakerCluster: cluster,
  ...extra,
});

describe("transcriptVoices", () => {
  it("returns each voice with a sample line and its line count, in order of first appearance", () => {
    const v = transcriptVoices([
      line("speaker_1", "[clicking]"),
      line("speaker_0", "Hi, I'm with Elostate."),
      line("speaker_1", "What does it cost?"),
      line("speaker_0", "Fifty a month."),
    ]);
    expect(v).toEqual([
      { cluster: "speaker_1", sample: "What does it cost?", lines: 2 }, // the annotation is never the sample
      { cluster: "speaker_0", sample: "Hi, I'm with Elostate.", lines: 2 },
    ]);
  });

  it("one voice is not this question (the single-voice question still applies)", () => {
    expect(transcriptVoices([line("speaker_0", "hello"), line("speaker_0", "there")])).toBeNull();
  });

  it("a line without a voice id (live capture, or saved before 0270) means the voices are not known", () => {
    expect(transcriptVoices([line("speaker_0", "hello"), line(null, "there"), line("speaker_1", "hi")])).toBeNull();
  });

  it("any attributed line, or any person's answer, closes the question", () => {
    expect(transcriptVoices([line("speaker_0", "a"), line("speaker_1", "b", { speaker: "agent" })])).toBeNull();
    expect(transcriptVoices([line("speaker_0", "a"), line("speaker_1", "b", { source: "manual" })])).toBeNull();
  });

  it("an empty transcript has nothing to ask", () => {
    expect(transcriptVoices([])).toBeNull();
  });

  it("reads /segments rows (snake_case)", () => {
    expect(
      transcriptVoices(
        [
          { speaker: "unknown", text: "a", source: null, speaker_cluster: "s0" },
          { speaker: "unknown", text: "b", source: null, speaker_cluster: "s1" },
        ].map(voiceLineFromRow)
      )?.map((v) => v.cluster)
    ).toEqual(["s0", "s1"]);
  });
});
