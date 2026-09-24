// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
    start: vi.fn(),
    stop: vi.fn(),
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
});
