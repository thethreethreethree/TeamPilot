import { describe, it, expect } from "vitest";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_BASE64_CHARS, oversizeMessage } from "../uploadLimits";

/**
 * The schedule binary-upload limit (grid-pdf / VA). The fix (schedule audit 2026-08-27, deferred Finding): the old
 * 6 MB base64 cap was a LIE — a 6 MB base64 body exceeds Vercel's ~4.5 MB request-body limit, so a file near the
 * advertised size was rejected by the PLATFORM with an opaque 413 before the handler ran. These lock the honest limit.
 */
describe("schedule upload limits", () => {
  it("oversizeMessage: null at/under the limit, a clear MB message over it", () => {
    expect(oversizeMessage(0)).toBeNull();
    expect(oversizeMessage(MAX_UPLOAD_BYTES)).toBeNull(); // exactly at the limit is allowed
    const over = oversizeMessage(MAX_UPLOAD_BYTES + 1);
    expect(over).toBeTruthy();
    expect(over).toMatch(/limit is 3 MB/); // the manager sees the REAL limit, not a platform 413
    expect(oversizeMessage(5_000_000)).toContain("5.0 MB"); // and their file's actual size
  });

  it("the base64 cap is TRUTHFUL: it accepts a max-size file yet keeps the body under the ~4.5 MB request limit", () => {
    // base64 of N bytes is ceil(N/3)*4 chars. The cap must (a) admit a max-size file's base64 and (b) stay under
    // the platform request-body limit — otherwise the advertised MAX_UPLOAD_BYTES would still be opaquely rejected.
    const base64CharsForMaxFile = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4;
    expect(MAX_UPLOAD_BASE64_CHARS).toBeGreaterThanOrEqual(base64CharsForMaxFile);
    expect(MAX_UPLOAD_BASE64_CHARS).toBeLessThan(4_500_000);
  });
});
