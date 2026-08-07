import { describe, it, expect } from "vitest";
import { assetUrlToStoragePath, ASSETS_BUCKET } from "@/lib/storage/assets";

/**
 * assetUrlToStoragePath centralizes the audio_asset_url parse that three writers
 * disagree on (see recording-purge-cron). The contract that MUST hold: only the
 * `${ASSETS_BUCKET}/<path>` shape resolves to a path; anything else returns null so
 * callers leave the object alone instead of using a raw string as a path (the false-ok
 * class the purge cron warns about). The re-transcribe recovery depends on this: a
 * wrong parse would download the wrong object or 422 a valid one.
 */
describe("assetUrlToStoragePath", () => {
  it("strips the bucket prefix from a bucket-relative pointer", () => {
    expect(assetUrlToStoragePath(`${ASSETS_BUCKET}/co1/rec.webm`)).toBe("co1/rec.webm");
  });

  it("handles nested paths", () => {
    expect(assetUrlToStoragePath(`${ASSETS_BUCKET}/a/b/c/file.mp4`)).toBe("a/b/c/file.mp4");
  });

  it("returns null for a full URL (the unrecognized shape — leave it alone)", () => {
    expect(assetUrlToStoragePath("https://example.com/leftover.webm")).toBeNull();
  });

  it("returns null for a path in a DIFFERENT bucket", () => {
    expect(assetUrlToStoragePath("other-bucket/co1/rec.webm")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(assetUrlToStoragePath(null)).toBeNull();
    expect(assetUrlToStoragePath(undefined)).toBeNull();
    expect(assetUrlToStoragePath("")).toBeNull();
  });

  it("does not treat the bucket name alone (no slash) as a path", () => {
    expect(assetUrlToStoragePath(ASSETS_BUCKET)).toBeNull();
  });
});
