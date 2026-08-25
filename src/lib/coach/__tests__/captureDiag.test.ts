import { describe, it, expect } from "vitest";
import { buildCaptureDiag, isCaptureViable, MIN_VIABLE_AUDIO_BYTES } from "../captureDiag";

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

  it("carries capturedBytes (the real 'was there audio' signal, defaults 0)", () => {
    expect(buildCaptureDiag({}).capturedBytes).toBe(0);
    expect(buildCaptureDiag({ sawData: true, capturedBytes: 5 }).capturedBytes).toBe(5); // the iOS stub: sawData true, ~no audio
  });
});

// Closes the 2026-08-25 detection hole: blob EXISTENCE was read as blob HAS-AUDIO, so a 5-byte iOS stub became a
// pitch that died at STT as a misleading "corrupted." isCaptureViable gates the save on real audio, not presence.
describe("isCaptureViable — durable chunks OR a blob large enough to hold media", () => {
  it("is viable when durable chunks reached storage, regardless of the final blob", () => {
    expect(isCaptureViable({ blobSize: null, chunksUploaded: 3 })).toBe(true);
    expect(isCaptureViable({ blobSize: 5, chunksUploaded: 1 })).toBe(true); // chunks safe → blob size irrelevant
  });
  it("is NOT viable for a truthy-but-tiny stub with no chunks (the 5-byte iOS Cues stub)", () => {
    expect(isCaptureViable({ blobSize: 5, chunksUploaded: 0 })).toBe(false);
    expect(isCaptureViable({ blobSize: MIN_VIABLE_AUDIO_BYTES - 1, chunksUploaded: 0 })).toBe(false);
    expect(isCaptureViable({ blobSize: null, chunksUploaded: 0 })).toBe(false);
  });
  it("is viable for a real recording's blob (≥ the media threshold), even a short one", () => {
    expect(isCaptureViable({ blobSize: MIN_VIABLE_AUDIO_BYTES, chunksUploaded: 0 })).toBe(true);
    expect(isCaptureViable({ blobSize: 4000, chunksUploaded: 0 })).toBe(true); // ~1s of opus — NOT a length gate
  });
});
