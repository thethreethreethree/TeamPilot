// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * VoiceEnrollment — the one-time voice check in Sales Coach → Settings.
 *
 * 5 white-alpha sites on a THEME-FOLLOWING ground (border-default, text-primary), unlike the shell's.
 * Two are progress TRACKS (:214 mic level, :218 capture progress) — an element that exists only as
 * colour, which does not fade when its colour fails but vanishes. They render ONLY while recording,
 * so the capture drives the recording state for real:
 *
 *   · the audio mocks mirror the calls VoiceEnrollment.tsx:113-141 actually makes — getUserMedia,
 *     `new AudioContext({ sampleRate })`, createMediaStreamSource, createScriptProcessor (whose
 *     `onaudioprocess` the component assigns), createGain — not an imagined shape;
 *   · `onaudioprocess` is fed a real 150 Hz sine, ten buffers, so both fills stop PART-WAY. A full
 *     or empty fill would hide a missing track: only a partial fill shows a bar with nothing around it.
 *
 * Ten voiced frames is below ENOUGH_VOICED (MIN_VOICED_FRAMES 25 + 20), so the auto-stop at :154
 * cannot fire and move the component past the state being photographed.
 */

let proc: { onaudioprocess: ((e: unknown) => void) | null } | null = null;

class FakeAudioContext {
  sampleRate: number;
  destination = {};
  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 16000;
  }
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} };
  }
  createScriptProcessor() {
    proc = { onaudioprocess: null, connect() {}, disconnect() {} } as never;
    return proc;
  }
  createGain() {
    return { gain: { value: 1 }, connect() {}, disconnect() {} };
  }
  close() {
    return Promise.resolve();
  }
}

const sine = (hz: number, amp: number, rate = 16000, n = 2048) =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));

import { VoiceEnrollment } from "@/components/sales-coach/VoiceEnrollment";

describe("capture", () => {
  it("voice enrollment, mid-recording", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enrolled: false, f0Hz: null }) })));
    vi.stubGlobal("AudioContext", FakeAudioContext);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });

    const { container } = render(<VoiceEnrollment />);
    fireEvent.click(await screen.findByRole("button", { name: /Start voice check/i }));
    // Exists only in the recording phase (:206).
    await screen.findByText(/Listening…/i, undefined, { timeout: 8000 });

    const buf = sine(150, 0.05);
    await act(async () => {
      for (let i = 0; i < 10; i++) proc?.onaudioprocess?.({ inputBuffer: { getChannelData: () => buf } });
    });
    // The voiced counter moved — proves the frames were processed rather than the fills sitting at 0.
    await screen.findByText(/^[1-9]\d*\/45 voiced$/, undefined, { timeout: 4000 });

    capture("voice-enrollment", container, { width: 640, height: 520 });
  });
});
