import { describe, it, expect } from "vitest";
import { notRecordingBanner } from "../notRecordingBanner";

/**
 * Honesty guard for the live-coaching banner (audit 2026-08-16, finding #1).
 * The critical rule: on an STT-feed error WHILE audio is still capturing, the banner must NOT claim
 * the call is lost — a rep who reads "nothing is being captured" abandons a recoverable call.
 */
describe("notRecordingBanner", () => {
  it("STT error WITH audio still capturing → tells the rep the audio is safe, NOT that capture stopped", () => {
    const b = notRecordingBanner("error", true, "Realtime connection error.");
    expect(b.title).toMatch(/still recording/i);
    expect(b.title).not.toMatch(/nothing is being captured/i);
    expect(b.body).toMatch(/recover the transcript/i);
  });

  it("error with capture actually stopped (mic-denied/setup) → honestly says nothing is captured + surfaces the error", () => {
    const b = notRecordingBanner("error", false, "Permission denied");
    expect(b.title).toMatch(/nothing is being captured/i);
    expect(b.body).toBe("Permission denied");
  });

  it("idle (never started) → the original 'not recording yet' prompt", () => {
    const b = notRecordingBanner("idle", false, null);
    expect(b.title).toMatch(/not recording yet/i);
    expect(b.body).toMatch(/Tap Start/i);
  });

  it("never claims capture stopped while audioCapturing is true, for any status", () => {
    for (const status of ["idle", "connecting", "live", "error"] as const) {
      const b = notRecordingBanner(status, true, "x");
      expect(b.title).not.toMatch(/nothing is being captured/i);
    }
  });
});
