// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * The Door Log — the surface a rep touches most, between doors, on a phone, outdoors.
 *
 * Captured because it holds six `white/N` utilities and has never been seen on a light ground.
 * That combination is the one that has produced a defect on every screen rendered so far: a tone
 * that is a soft grey on matte black and nothing on cream.
 *
 * Outdoors matters here. This is the screen most likely to be used in daylight, which is exactly
 * when a rep would switch to light mode — and until a ThemeToggle reached the Sales Coach header
 * on 2026-09-24, they could not.
 */

/** Mutable so one file can capture more than one STATE of the same screen. */
const recorderState = { recording: false, captureInterrupted: false };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
// The Door Log builds a browser Supabase client on mount and the real one throws without env.
// A capture is about APPEARANCE — it must not need credentials to photograph a surface.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
  }),
}));
// The recorder hook probes real media APIs; stub the hook rather than the whole browser.
vi.mock("@/components/sales-coach/doorlog/useDoorRecorder", () => ({
  // The real hook's surface, read from useDoorRecorder.ts:403 rather than guessed — a mock built
  // from imagination fails on the first call the component actually makes.
  useDoorRecorder: () => ({
    armed: recorderState.recording,
    level: 0,
    elapsedMs: 0,
    // AWAITED at DoorLog.tsx:278 — `recorder.arm().then(...)`. A vi.fn() returning undefined
    // throws on `.then`, which is the mock lying about the contract rather than the code failing.
    arm: vi.fn(async () => true),
    /**
     * `start` RETURNS A BOOLEAN and the component honours it: `recordPitch` at DoorLog.tsx:371
     * refuses to enter the recording screen when it is falsy, so a mic-denied rep never sees a
     * fake capture. A bare `vi.fn()` returns undefined — the mock lying about the contract, which
     * is precisely what the note above `arm` warns about, two lines up, and I did it anyway.
     */
    start: vi.fn(async () => true),
    /** Shape read from useDoorRecorder.ts:318, not imagined. */
    stop: vi.fn(async () => ({
      blob: null,
      durationMs: 42_000,
      chunksUploaded: 3,
      seq0Uploaded: true,
      diag: {},
    })),
    recording: recorderState.recording,
    captureInterrupted: recorderState.captureInterrupted,
  }),
}));

import { DoorLog } from "@/components/sales-coach/doorlog/DoorLog";

describe("capture", () => {
  it("door log, idle", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("door-log"))
          return { ok: true, json: async () => ({ doorsKnocked: 37, presentations: 9, sold: 2 }) };
        return { ok: true, json: async () => ({}) };
      })
    );
    // jsdom has no MediaRecorder / getUserMedia; the Door Log probes them on mount.
    vi.stubGlobal("MediaRecorder", class {} as unknown as typeof MediaRecorder);
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });

    const { container } = render(<DoorLog />);
    await screen.findByText(/knock/i, undefined, { timeout: 5000 });

    capture("door-log", container.firstElementChild as HTMLElement, { width: 390, height: 844 });
  });

  /**
   * THE REST OF THE LOOP — recording and outcome.
   *
   * The idle capture above existed from this morning and I read it as a clean screen. A
   * render-tree sweep later found ELEVEN white-alpha sites in this component: four of them in the
   * idle state I had photographed (the three unaccented KPI tiles, the door glyph's ring and the
   * "No Answer" button) and the rest in the two states no capture had ever entered.
   *
   * Looking at one state of a state machine is not looking at the screen. The rep passes through
   * all of these on every door.
   */
  const setup = () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("door-log"))
          return { ok: true, json: async () => ({ doorsKnocked: 37, presentations: 9, sold: 2 }) };
        return { ok: true, json: async () => ({}) };
      })
    );
    vi.stubGlobal("MediaRecorder", class {} as unknown as typeof MediaRecorder);
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
  };

  it("door log, recording", async () => {
    setup();
    recorderState.recording = true;
    try {
      const { container } = render(<DoorLog />);
      // Enter the state through the component's own button, not by poking state — the capture
      // should photograph what a tap produces.
      fireEvent.click(await screen.findByText(/Record Pitch/i, undefined, { timeout: 5000 }));
      // The Stop control carries aria-label="Stop recording" (DoorLog.tsx:630). Waiting on its
      // LABEL rather than on loose text, which would also match the "Record Pitch" button behind it.
      await screen.findByLabelText(/Stop recording/i, undefined, { timeout: 5000 });
      capture("door-log-recording", container.firstElementChild as HTMLElement, {
        width: 390,
        height: 844,
      });
    } finally {
      recorderState.recording = false;
    }
  });
});
