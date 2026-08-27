import { describe, it, expect } from "vitest";
import { extForMime } from "../route";

/**
 * A30 gate for the iOS capture fix (2026-08-27). The fallback upload names the stored file by this extension so
 * transcription parses the container. iOS now records mp4 — if this ever maps mp4 back to "webm", an iOS blob gets
 * mislabeled and STT can misparse it (the exact regression class just fixed). Lock the mapping.
 */
describe("extForMime — storage extension by recorder mime", () => {
  it("maps iOS mp4/aac/m4a to mp4 (NOT webm)", () => {
    expect(extForMime("audio/mp4")).toBe("mp4");
    expect(extForMime("audio/mp4;codecs=mp4a")).toBe("mp4");
    expect(extForMime("audio/aac")).toBe("mp4");
    expect(extForMime("audio/x-m4a")).toBe("mp4");
  });

  it("maps mpeg/mp3 to mp3 and ogg to ogg", () => {
    expect(extForMime("audio/mpeg")).toBe("mp3");
    expect(extForMime("audio/ogg")).toBe("ogg");
  });

  it("defaults to webm for webm and for missing/unknown types (the non-iOS pipeline format)", () => {
    expect(extForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extForMime("audio/webm")).toBe("webm");
    expect(extForMime(undefined)).toBe("webm");
    expect(extForMime("")).toBe("webm");
    expect(extForMime("application/octet-stream")).toBe("webm");
  });

  it("is case-insensitive", () => {
    expect(extForMime("AUDIO/MP4")).toBe("mp4");
  });
});
