import { describe, it, expect } from "vitest";
import { transcriptHasSpeech, NO_SPEECH_ERROR } from "../speechPresence";

/**
 * The H1 guard asked "is the transcript empty". STT never returns empty for a silent recording — it returns
 * the sound it heard, annotated. Every string below marked "measured" is a VERBATIM stored transcript from
 * pitch_transcripts on 2026-09-10, not an invented example: 28 of 73 rows look like this, all 28 were
 * analyzed, and one of them ("[typing]") was graded tone 85 / close 80 / objection 75.
 */
describe("transcriptHasSpeech — a sound event is not speech", () => {
  const MEASURED_NON_SPEECH = [
    "[clicking]", // measured — 8 rows
    "[pause]", // measured — 6 rows
    "[outro jingle]", // measured — 5 rows
    "[background noise]", // measured — 2 rows
    "[typing]", // measured — the one scored 85 for tone
    "[silence]",
    "[phone ringing]",
    "[wind blowing]",
    "[singing]",
    "[zipper closing]",
    "[click]",
  ];

  for (const t of MEASURED_NON_SPEECH) {
    it(`${t} carries no speech`, () => {
      expect(transcriptHasSpeech(t)).toBe(false);
    });
  }

  it("treats an empty string, whitespace, null and undefined as no speech (the original H1 cases still hold)", () => {
    expect(transcriptHasSpeech("")).toBe(false);
    expect(transcriptHasSpeech("   ")).toBe(false);
    expect(transcriptHasSpeech(null)).toBe(false);
    expect(transcriptHasSpeech(undefined)).toBe(false);
  });

  it("treats punctuation-only output as no speech", () => {
    expect(transcriptHasSpeech("... -- ?!")).toBe(false);
  });

  it("handles the other annotation forms STT uses", () => {
    expect(transcriptHasSpeech("(laughs)")).toBe(false);
    expect(transcriptHasSpeech("*sighs*")).toBe(false);
    expect(transcriptHasSpeech("[clicking] [pause] [clicking]")).toBe(false);
  });
});

describe("transcriptHasSpeech — a real pitch is never withheld", () => {
  it("passes a transcript that MIXES an annotation with speech (this is a real pitch, not silence)", () => {
    expect(
      transcriptHasSpeech("[background noise] Hi, I'm John from Elostate."),
    ).toBe(true);
  });

  it("passes the shortest measured real transcripts", () => {
    // Measured 2026-09-10 — the two shortest stored transcripts that contain actual words.
    expect(transcriptHasSpeech("He's not getting carried")).toBe(true);
    expect(
      transcriptHasSpeech("He gave it like Samuel L. Jackson attitude"),
    ).toBe(true);
  });

  it("passes a single spoken word, and a number", () => {
    expect(transcriptHasSpeech("Hello")).toBe(true);
    expect(transcriptHasSpeech("2000")).toBe(true);
  });

  it("passes non-Latin script (the check is 'any letter', not 'any ASCII letter')", () => {
    expect(transcriptHasSpeech("hola, ¿cómo está?")).toBe(true);
    expect(transcriptHasSpeech("你好")).toBe(true);
  });
});

describe("NO_SPEECH_ERROR", () => {
  it("is one shared string, so both worker guards tell the rep the same thing", () => {
    expect(NO_SPEECH_ERROR).toBe("No speech was detected in this recording.");
  });
});
