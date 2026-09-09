import { describe, it, expect } from "vitest";
import {
  deriveEnrollmentF0,
  isValidEnrollmentF0,
  isVoiceEnrolled,
  MIN_VOICED_FRAMES,
} from "../voiceEnrollment";

const frames = (f0: number, n: number) => Array.from({ length: n }, () => f0);

describe("deriveEnrollmentF0", () => {
  it("returns the median F0 and the voiced-frame count from a clean voiced series", () => {
    const r = deriveEnrollmentF0([...frames(120, MIN_VOICED_FRAMES), 130, 110]);
    expect(r).not.toBeNull();
    expect(r!.f0Hz).toBe(120); // median of a 120-dominated series
    expect(r!.voicedFrames).toBe(MIN_VOICED_FRAMES + 2);
  });

  it("drops nulls (unvoiced) and out-of-range frames before the count + median", () => {
    // 45 real voiced frames at 150 Hz, padded with nulls and impossible values that must NOT count.
    const samples = [...frames(150, 45), null, null, 20, 5000, -3, NaN];
    const r = deriveEnrollmentF0(samples);
    expect(r).not.toBeNull();
    expect(r!.voicedFrames).toBe(45); // only the in-range voiced frames counted
    expect(r!.f0Hz).toBe(150);
  });

  it("returns null when there is too little voiced signal (ask for another take, never store noise)", () => {
    expect(deriveEnrollmentF0(frames(120, MIN_VOICED_FRAMES - 1))).toBeNull();
    expect(deriveEnrollmentF0([null, null, null])).toBeNull();
    expect(deriveEnrollmentF0([])).toBeNull();
  });

  it("rounds the stored F0 to one decimal", () => {
    const r = deriveEnrollmentF0(frames(123.456, MIN_VOICED_FRAMES));
    expect(r!.f0Hz).toBe(123.5);
  });
});

describe("isValidEnrollmentF0 — server-side re-validation", () => {
  it("accepts an in-range human F0", () => {
    expect(isValidEnrollmentF0(120)).toBe(true);
    expect(isValidEnrollmentF0(70)).toBe(true);
    expect(isValidEnrollmentF0(400)).toBe(true);
  });
  it("rejects out-of-range, non-finite, or non-numeric values", () => {
    expect(isValidEnrollmentF0(69)).toBe(false);
    expect(isValidEnrollmentF0(401)).toBe(false);
    expect(isValidEnrollmentF0(NaN)).toBe(false);
    expect(isValidEnrollmentF0("120" as unknown)).toBe(false);
    expect(isValidEnrollmentF0(null as unknown)).toBe(false);
  });
});

describe("isVoiceEnrolled — the gate predicate", () => {
  it("true only when voiceEnrolledAt is set", () => {
    expect(isVoiceEnrolled({ voiceEnrolledAt: "2026-09-09T00:00:00Z" })).toBe(true);
    expect(isVoiceEnrolled({ voiceEnrolledAt: null })).toBe(false);
    expect(isVoiceEnrolled({})).toBe(false);
    expect(isVoiceEnrolled(null)).toBe(false);
    expect(isVoiceEnrolled(undefined)).toBe(false);
  });
});
