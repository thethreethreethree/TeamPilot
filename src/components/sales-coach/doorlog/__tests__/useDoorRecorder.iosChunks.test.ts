// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * iOS Safari IGNORES MediaRecorder.start(timeslice) — it never fires periodic ondataavailable, so the incremental
 * chunk upload never runs and a long recording that loses its mic track is TOTALLY lost (field data 2026-08-26:
 * 12/12 empty captures were iOS, all chunksUploaded=0). useDoorRecorder now forces a chunk via requestData() on an
 * interval whenever the timeslice hasn't delivered one. This gates that: with the timeslice SILENT (iOS), the force
 * fires; with data flowing (Chrome/Android), it stays a no-op. jsdom can't replicate iOS itself — the authoritative
 * proof is a live iOS device — but this locks the interval logic so it can't regress.
 */

const AUDIO_CHUNK_MS = 15_000;

// A MediaRecorder mock whose start(timeslice) does NOT auto-fire ondataavailable — the iOS behavior. requestData()
// is the thing under test; optionally it can emit a chunk (to simulate the fix actually producing data).
class FakeRecorder {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  requestData = vi.fn(() => {
    // The real iOS engine emits a continuation chunk here; emit a small blob so lastDataAt updates like reality.
    this.ondataavailable?.({ data: new Blob(["chunk"], { type: this.mimeType }) });
  });
  constructor(public stream: unknown, public opts?: { mimeType?: string }) {}
  start(_timeslice?: number) { this.state = "recording"; } // NB: no periodic ondataavailable — the iOS bug
  stop() { this.state = "inactive"; this.onstop?.(); }
  static isTypeSupported() { return true; }
}

function installBrowserMocks() {
  const track = { clone: () => track, stop: vi.fn(), readyState: "live", enabled: true, onended: null, onmute: null, onunmute: null };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  vi.stubGlobal("MediaRecorder", FakeRecorder as unknown as typeof MediaRecorder);
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn(async () => stream) }, configurable: true });
  vi.stubGlobal("AudioContext", class {
    state = "running";
    createMediaStreamSource() { return { connect: vi.fn() }; }
    createAnalyser() { return { fftSize: 0, frequencyBinCount: 8, getByteFrequencyData: vi.fn() }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  });
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

import { useDoorRecorder } from "../useDoorRecorder";

beforeEach(() => { vi.useFakeTimers(); installBrowserMocks(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("useDoorRecorder — iOS chunk-forcing (start(timeslice) is ignored on iOS)", () => {
  it("forces a chunk via requestData() when the timeslice delivers nothing (the iOS path)", async () => {
    const { result } = renderHook(() => useDoorRecorder());
    await act(async () => { await result.current.start("rid-1"); });
    // Advance an interval with NO ondataavailable (the iOS timeslice-ignored path): the force must fire requestData,
    // which emits a continuation chunk. Without the fix, chunkCount stays 0 (nothing until stop) and the pitch is lost.
    await act(async () => { await vi.advanceTimersByTimeAsync(AUDIO_CHUNK_MS + 100); });
    const out = await act(async () => result.current.stop());
    expect(out.diag.chunkCount).toBeGreaterThan(0); // a forced chunk was captured despite the silent timeslice
  });
});
