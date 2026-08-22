import { describe, it, expect } from "vitest";
import { buildCaptureDiag } from "../captureDiag";

/**
 * buildCaptureDiag (capture-blindness sweep, founder 2026-08-23) — the ONE shape every coach recorder reports, so
 * a zero-audio session's cause is on the record. Pure, so it's gate-testable: safe defaults + the track readyState.
 */
describe("buildCaptureDiag", () => {
  it("fills safe defaults for everything omitted", () => {
    const d = buildCaptureDiag({});
    expect(d.sawData).toBe(false);
    expect(d.chunkCount).toBe(0);
    expect(d.chunksUploaded).toBe(0);
    expect(d.durationMs).toBe(0);
    expect(d.recorderError).toBeNull();
    expect(d.trackEnded).toBe(false);
    expect(d.trackMuted).toBe(false);
    expect(d.trackReadyState).toBe("unknown"); // no track passed
    expect(d.wakeLockGranted).toBe(false);
    expect(typeof d.ua).toBe("string");
  });

  it("carries the observed cause + the track readyState", () => {
    const d = buildCaptureDiag({
      sawData: false,
      durationMs: 42000,
      recorderError: "NotReadableError",
      trackEnded: true,
      track: { readyState: "ended" } as MediaStreamTrack,
    });
    expect(d.trackEnded).toBe(true);
    expect(d.trackReadyState).toBe("ended");
    expect(d.recorderError).toBe("NotReadableError");
    expect(d.durationMs).toBe(42000);
  });
});
