import { describe, it, expect } from "vitest";
import {
  pitchChunkPrefix,
  pitchChunkObjectPath,
  pitchRecordingPath,
  isValidRecordingId,
  recordingIdFromAudioPath,
} from "../pitchAudioChunks";

/**
 * The pitch incremental-audio storage layout + the audio_path parser (founder 2026-08-22). These are the
 * SINGLE SOURCE the chunk-upload route (writes), the worker stitch (reads), and the worker's
 * chunked-vs-single-blob branch (recordingIdFromAudioPath) all depend on — a drift here silently loses the
 * recording (written one path, stitched/parsed from another). Locked so it can't drift.
 */
describe("pitch chunk storage layout", () => {
  const co = "co-123";
  const rid = "abcd1234-5678-90ab-cdef-1234567890ab";

  it("chunk + recording paths are consistent and rooted at the company", () => {
    expect(pitchChunkPrefix(co, rid)).toBe(`${co}/doorlog/${rid}/chunks`);
    expect(pitchChunkObjectPath(co, rid, 0)).toBe(`${co}/doorlog/${rid}/chunks/0.webm`);
    expect(pitchChunkObjectPath(co, rid, 7)).toBe(`${co}/doorlog/${rid}/chunks/7.webm`);
    expect(pitchRecordingPath(co, rid)).toBe(`${co}/doorlog/${rid}/recording.webm`);
  });
});

describe("isValidRecordingId — rejects anything that could smuggle a path segment", () => {
  it("accepts a uuid-shaped id", () => {
    expect(isValidRecordingId("abcd1234-5678-90ab-cdef-1234567890ab")).toBe(true);
    expect(isValidRecordingId("1755800000000-42")).toBe(true); // the non-crypto fallback id shape
  });
  it("rejects path-traversal, slashes, spaces, empties, over-long", () => {
    expect(isValidRecordingId("../secret")).toBe(false);
    expect(isValidRecordingId("a/b")).toBe(false);
    expect(isValidRecordingId("has space")).toBe(false);
    expect(isValidRecordingId("")).toBe(false);
    expect(isValidRecordingId("x".repeat(65))).toBe(false);
    expect(isValidRecordingId("short")).toBe(false); // < 8 chars
  });
});

describe("recordingIdFromAudioPath — drives the worker's stitch-first branch", () => {
  it("extracts the id from a stitched-recording pointer", () => {
    const co = "co-123";
    const rid = "abcd1234-5678-90ab-cdef-1234567890ab";
    expect(recordingIdFromAudioPath(pitchRecordingPath(co, rid))).toBe(rid);
  });
  it("returns null for a legacy single-blob path (the fallback upload) — worker transcribes it directly", () => {
    expect(recordingIdFromAudioPath("co-123/2026/08/some-file.webm")).toBeNull();
    expect(recordingIdFromAudioPath("co-123/doorlog/abcd1234/chunks/0.webm")).toBeNull(); // a chunk, not the recording
    expect(recordingIdFromAudioPath("")).toBeNull();
    expect(recordingIdFromAudioPath(null)).toBeNull();
    expect(recordingIdFromAudioPath(undefined)).toBeNull();
  });
});
