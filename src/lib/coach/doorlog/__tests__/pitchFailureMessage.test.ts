import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pitchFailureMessage,
  PITCH_FAILURE_AI_UNAVAILABLE,
  PITCH_FAILURE_GENERIC,
  PITCH_FAILURE_TIMEOUT,
} from "../pitchFailureMessage";
import { NO_SPEECH_ERROR } from "../speechPresence";

/**
 * 2026-09-30, from production: 9 September pitches store `Processing failed after 5 attempts: DeepSeek API
 * error 402: {"error":{...` in `pitches.error`, and the report card showed that text to the rep.
 */
const PRODUCTION_402 =
  'Processing failed after 5 attempts: DeepSeek API error 402: {"error":{"message":"Insufficient Balance","type":"unknown_error"}}';

describe("what a rep may read about a failed pitch", () => {
  it("never passes on the provider's name or raw JSON", () => {
    const out = pitchFailureMessage(PRODUCTION_402)!;
    expect(out).not.toMatch(/DeepSeek|402|\{|Insufficient/);
    expect(out).toBe(PITCH_FAILURE_AI_UNAVAILABLE);
  });

  it("turns any other exception text into our own sentence (fail closed)", () => {
    const out = pitchFailureMessage('Processing failed: relation "pitch_analyses" violates check constraint');
    expect(out).toBe(PITCH_FAILURE_GENERIC);
  });

  it("keeps the worker's own sentences, which were written for a rep", () => {
    expect(pitchFailureMessage("No audio was captured for this pitch.")).toBe("No audio was captured for this pitch.");
    expect(
      pitchFailureMessage("No audio was captured for this pitch (the recording was empty or unplayable).")
    ).toMatch(/^No audio was captured/);
    expect(pitchFailureMessage(NO_SPEECH_ERROR)).toBe(NO_SPEECH_ERROR);
  });

  it("rewords the worker's timeout line", () => {
    expect(
      pitchFailureMessage("Processing failed after 5 attempts (a timeout or crash prevented completion).")
    ).toBe(PITCH_FAILURE_TIMEOUT);
  });

  it("says nothing when nothing failed", () => {
    expect(pitchFailureMessage(null)).toBeNull();
    expect(pitchFailureMessage("  ")).toBeNull();
  });

  it("every sentence says whose fault it is", () => {
    for (const s of [PITCH_FAILURE_GENERIC, PITCH_FAILURE_AI_UNAVAILABLE, PITCH_FAILURE_TIMEOUT]) {
      expect(s).toMatch(/fault is on our side, not your pitch/);
    }
  });
});

describe("the report-card route sends the translation, never the column", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/api/coach/sales-session/report-card/[pitchId]/route.ts"),
    "utf8"
  );
  it("passes pitch.error through pitchFailureMessage", () => {
    expect(src).toMatch(/error:\s*pitchFailureMessage\(pitch\.error/);
  });
  it("has no other path that returns the raw column", () => {
    expect(src.match(/pitch\.error/g)).toHaveLength(1);
  });
});
