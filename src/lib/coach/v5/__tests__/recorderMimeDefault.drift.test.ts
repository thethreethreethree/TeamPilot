import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * DRIFT GUARD (A30) — the iOS silent-audio-loss invariant across the browser-default recorders.
 *
 * iOS Safari's MediaRecorder falsely reports `isTypeSupported("audio/webm;codecs=opus") === true` but then writes a
 * sub-1KB STUB — so any recorder that FORCES a webm mimeType captures nothing on iPhone (the DoorLog regression of
 * 2026-08-23, fixed 2026-08-27). The three coaching recorders below stay safe for one reason only: they construct
 * `new MediaRecorder(stream)` with NO explicit mimeType, letting the browser choose — which on iOS is `audio/mp4`.
 *
 * If a future edit adds `{ mimeType: "audio/webm..." }` (or any hardcoded container) to these constructions, iOS
 * capture silently breaks again in the founder's acute pain domain. This guard fails the moment that happens.
 *
 * DoorLog is intentionally NOT in this list: it forces a mime ON PURPOSE via pickSupportedMimeType(), which is
 * iOS-aware (mp4 first on iOS) and locked separately by pickMime.ios.test.ts.
 */

const here = dirname(fileURLToPath(import.meta.url));
// here = <repo>/src/lib/coach/v5/__tests__ → four levels up is <repo>/src.
const SRC = resolve(here, "../../../..");

const BROWSER_DEFAULT_RECORDERS = [
  "lib/coach/v5/useMeetingCoaching.ts",
  "lib/coach/v5/useLiveCoaching.ts",
  "components/care/voice/useVoiceMode.ts",
];

const NO_MIME = /new MediaRecorder\(\s*[a-zA-Z_$][\w$]*\s*\)/;
const FORCED_MIME = /new MediaRecorder\([^)]*,\s*\{[^}]*mimeType/;

describe("browser-default recorders must not force a mimeType (iOS picks mp4; a forced webm = silent stub)", () => {
  for (const rel of BROWSER_DEFAULT_RECORDERS) {
    it(`${rel} constructs MediaRecorder with no explicit mimeType`, () => {
      const src = readFileSync(resolve(SRC, rel), "utf8");
      // There must be at least one bare `new MediaRecorder(<stream>)` construction (the browser-default form).
      expect(NO_MIME.test(src)).toBe(true);
      // And NO construction that passes a second argument (the options bag) carrying a mimeType — that is the
      // exact shape that reintroduces the iOS webm-stub class.
      expect(FORCED_MIME.test(src)).toBe(false);
    });
  }

  // Detection self-test: prove the guard would actually FAIL on a forced-webm regression (a guard that can't
  // detect its own defect class is theatre — feedback_convert_verification_to_structural_guard).
  it("FORCED_MIME detects a webm-forcing regression; NO_MIME still recognizes the safe form", () => {
    const regressed = `const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });`;
    const safe = `const rec = new MediaRecorder(stream);`;
    expect(FORCED_MIME.test(regressed)).toBe(true);   // the guard fires on the bad pattern
    expect(FORCED_MIME.test(safe)).toBe(false);       // and stays quiet on the good one
    expect(NO_MIME.test(safe)).toBe(true);
  });
});
