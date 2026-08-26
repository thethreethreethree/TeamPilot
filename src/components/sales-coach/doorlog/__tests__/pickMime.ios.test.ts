import { describe, it, expect, afterEach, vi } from "vitest";
import { pickSupportedMimeType, isIOS } from "../useDoorRecorder";

/**
 * A30 gate for the iOS capture regression (2026-08-27). Field telemetry: 100% of empty DoorLog captures were iOS
 * recording as "audio/webm;codecs=opus" — iOS Safari 18.x FALSELY reports webm support but produces a sub-1KB stub.
 * The picker MUST prefer mp4 on iOS (which iOS actually encodes) and keep webm-first elsewhere. If someone re-orders
 * it to prefer webm on iOS again, this fails.
 */

const origUA = Object.getOwnPropertyDescriptor(globalThis.navigator ?? {}, "userAgent");

function setUA(ua: string) {
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: ua }, configurable: true, writable: true });
}

function mockMediaRecorder(supported: string[]) {
  // isTypeSupported returns true for the listed types (iOS falsely lists webm — we include it to prove mp4 still wins).
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = {
    isTypeSupported: (t: string) => supported.includes(t),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
  if (origUA) Object.defineProperty(globalThis, "navigator", { value: { userAgent: origUA.value }, configurable: true });
});

describe("pickSupportedMimeType — iOS prefers mp4, never webm (A30)", () => {
  const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1";
  const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

  it("iOS picks mp4 EVEN WHEN webm is (falsely) reported supported", () => {
    setUA(IOS_UA);
    mockMediaRecorder(["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]);
    expect(isIOS()).toBe(true);
    expect(pickSupportedMimeType()).toBe("audio/mp4");
  });

  it("iOS falls through to aac if mp4 is unsupported, still never webm-first", () => {
    setUA(IOS_UA);
    mockMediaRecorder(["audio/webm;codecs=opus", "audio/aac"]);
    expect(pickSupportedMimeType()).toBe("audio/aac");
  });

  it("non-iOS (Chrome) keeps webm-first (the pipeline-native format)", () => {
    setUA(CHROME_UA);
    mockMediaRecorder(["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]);
    expect(isIOS()).toBe(false);
    expect(pickSupportedMimeType()).toBe("audio/webm;codecs=opus");
  });
});
