/**
 * Shared capture diagnostics (founder 2026-08-23) — the ground-truth a recorder observed about WHY it produced
 * no/little audio. Every coach recorder (DoorLog pitch, live sales, meeting, C.A.R.E voice) used to swallow its
 * failure signal, so a zero-audio session was unexplainable and every fix was a guess. This is the ONE shape they
 * all report, so the cause is on the record instead of assumed. See docs/tbc/2026-08-23-*-capture-* .
 */
export type CaptureDiag = {
  sawData: boolean; // did ondataavailable ever fire with bytes?
  capturedBytes: number; // TOTAL bytes across all data events — sawData can be true for a 5-byte trailer, so this
  // is the real "was there audio" signal (2026-08-25: iOS produced 5-byte stubs that read as sawData=true)
  chunkCount: number; // local chunks captured
  chunksUploaded: number; // chunks that reached storage
  durationMs: number;
  mimeType: string; // what MediaRecorder actually chose
  recorderError: string | null; // MediaRecorder 'error' event, if any
  trackEnded: boolean; // the mic track fired 'ended' mid-recording (screen-lock / phone call / app took the mic)
  trackMuted: boolean; // the mic track went 'muted' mid-recording (suspended — the iOS pocket/lock case)
  trackReadyState: string; // the audio track's readyState at stop ('live' | 'ended')
  wakeLockGranted: boolean; // did the screen wake lock actually take (often false on iOS Safari)?
  hiddenDuringRecording: number; // times the tab went hidden while recording (backgrounded → iOS suspends audio)
  ua: string;
};

/**
 * A recording that captured ACTUAL audio is at least ~1KB even for a fraction of a second (container header +
 * a few opus frames). Below this, the capture produced only container overhead — a header/trailer with NO media,
 * e.g. the 5-byte webm *Cues* stub observed 2026-08-25 on iOS. This is NOT a duration/length floor (it respects
 * the founder's "NO minimum length" rule): a real ~1s pitch is several KB; this only catches captures that
 * recorded no audio at all — the ones that otherwise upload a truthy-but-empty blob and fail downstream as a
 * misleading "corrupted."
 */
export const MIN_VIABLE_AUDIO_BYTES = 1024;

/**
 * Did this recording actually capture audio? True if durable chunks reached storage (the real audio is already
 * safe there, independent of the final blob) OR the final blob is large enough to contain media. A truthy but
 * tiny blob (the stub) is NOT viable — closing the detection hole where blob-EXISTENCE was read as blob-HAS-AUDIO.
 */
export function isCaptureViable(args: { blobSize: number | null | undefined; chunksUploaded: number }): boolean {
  if (args.chunksUploaded > 0) return true;
  return (args.blobSize ?? 0) >= MIN_VIABLE_AUDIO_BYTES;
}

/** Which recorder produced the diagnostic — so `coach.capture_failed` events are filterable by surface. */
export type CaptureSurface = "doorlog" | "live" | "meeting" | "care";

/**
 * Report a capture failure, best-effort. keepalive so it lands even as the surface unmounts / the user moves on;
 * a throw or a network error is swallowed — diagnostics must NEVER affect the user's flow. `sessionId` scopes the
 * event to the session it belongs to (omitted for the pre-session DoorLog pitch flow).
 */
export function reportCaptureDiag(surface: CaptureSurface, diag: CaptureDiag, sessionId?: string): void {
  try {
    void fetch("/api/coach/capture-diag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface, sessionId, diag }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* best-effort — never let diagnostics touch the recording flow */
  }
}

/**
 * Build a CaptureDiag from a MediaRecorder-based recorder's observed refs. Pure so each recorder assembles the
 * same shape consistently (and it's unit-testable). Callers pass what they tracked; missing fields default safe.
 */
export function buildCaptureDiag(o: {
  sawData?: boolean;
  capturedBytes?: number;
  chunkCount?: number;
  chunksUploaded?: number;
  durationMs?: number;
  mimeType?: string;
  recorderError?: string | null;
  trackEnded?: boolean;
  trackMuted?: boolean;
  track?: MediaStreamTrack | null;
  wakeLockGranted?: boolean;
  hiddenDuringRecording?: number;
}): CaptureDiag {
  return {
    sawData: o.sawData ?? false,
    capturedBytes: o.capturedBytes ?? 0,
    chunkCount: o.chunkCount ?? 0,
    chunksUploaded: o.chunksUploaded ?? 0,
    durationMs: o.durationMs ?? 0,
    mimeType: o.mimeType ?? "",
    recorderError: o.recorderError ?? null,
    trackEnded: o.trackEnded ?? false,
    trackMuted: o.trackMuted ?? false,
    trackReadyState: o.track?.readyState ?? "unknown",
    wakeLockGranted: o.wakeLockGranted ?? false,
    hiddenDuringRecording: o.hiddenDuringRecording ?? 0,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}
