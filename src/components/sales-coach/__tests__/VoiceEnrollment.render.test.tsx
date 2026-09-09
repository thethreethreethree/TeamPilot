// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

/**
 * VoiceEnrollment — regression guards for the adversarial-review findings (2026-09-09). The mic-capture code
 * couldn't be tested with a real microphone, so these mock the Web Audio graph and pin the re-entrancy fixes:
 *   F1 (HIGH): a double-click on Start (while the mic-permission prompt is up) must build ONE audio graph, not
 *              two — else the first AudioContext + mic stream leak.
 *   Lifecycle: unmounting a live recording tears the mic stream down (no leaked track).
 */

let acCount = 0;
let gumCount = 0;
const stoppedTracks: number[] = [];

class MockAudioContext {
  sampleRate = 16000;
  destination = {};
  constructor() { acCount += 1; }
  createMediaStreamSource() { return { connect() {} }; }
  createScriptProcessor() { return { connect() {}, disconnect() {}, onaudioprocess: null as unknown }; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  close() { return Promise.resolve(); }
}

function installAudioMocks() {
  acCount = 0; gumCount = 0; stoppedTracks.length = 0;
  // A getUserMedia that resolves on the NEXT microtask, modeling the permission-prompt gap where a 2nd click lands.
  const getUserMedia = vi.fn(async () => {
    gumCount += 1;
    const id = gumCount;
    return { getTracks: () => [{ stop: () => stoppedTracks.push(id) }] } as unknown as MediaStream;
  });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("AudioContext", MockAudioContext as unknown);
}

function mockFetch(enrolled: boolean, posts: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? "GET";
    if (String(url).includes("/api/coach/voice-enrollment") && method === "POST") {
      posts.push(init?.body ? JSON.parse(init.body) : null);
      return { ok: true, json: async () => ({ enrolled: true, f0Hz: 120 }) } as Response;
    }
    return { ok: true, json: async () => ({ enrolled, f0Hz: enrolled ? 120 : null }) } as Response;
  }));
}

import { VoiceEnrollment } from "../VoiceEnrollment";

beforeEach(() => { installAudioMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("VoiceEnrollment — re-entrancy + lifecycle guards (review fixes)", () => {
  it("F1: a double-click on Start builds ONE audio graph, not two (no leaked mic/context)", async () => {
    mockFetch(false, []);
    render(<VoiceEnrollment />);
    const btn = await screen.findByText("Start voice check");
    // Two synchronous clicks before the getUserMedia microtask resolves — the startingRef latch must gate the 2nd.
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    await waitFor(() => expect(acCount).toBe(1));
    expect(gumCount).toBe(1); // the mic was acquired exactly once
  });

  it("frees the mic stream when unmounted mid-recording (no leaked track)", async () => {
    mockFetch(false, []);
    const { unmount } = render(<VoiceEnrollment />);
    const btn = await screen.findByText("Start voice check");
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => expect(gumCount).toBe(1));
    unmount();
    await waitFor(() => expect(stoppedTracks).toContain(1)); // the acquired track was stopped on teardown
  });
});
