// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Render gate for the mic-denied fix (audit 2026-08-18). useDoorRecorder.start() returns false when the mic is
 * denied; recordPitch MUST honor that and NOT enter a fake RECORDING screen (which would let the rep save a
 * silent no-audio pitch — error dressed as success). This is the first COMPONENT-render test in the repo: the
 * class of bug it guards (a control that renders/behaves wrong) is invisible to the node-only unit suite, which
 * is exactly how the clipped button, the keyboard overlay, and this fake-capture all slipped past CI.
 */

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) } }),
}));
vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: false,
    recording: false,
    level: 0,
    elapsedMs: 0,
    arm: vi.fn(async () => false),
    start: vi.fn(async () => false), // mic denied / unavailable
    stop: vi.fn(async () => ({ blob: null, durationMs: 0 })),
  }),
}));

import { DoorLog } from "../DoorLog";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ doorsKnocked: 0, sold: 0, goBacks: 0, notInterested: 0 }),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DoorLog — mic-denied never fakes a recording (render gate)", () => {
  it("tapping Record Pitch with the mic denied stays on idle + surfaces the mic banner, never the Stop screen", async () => {
    render(<DoorLog />);
    fireEvent.click(screen.getByText("Record Pitch"));
    // The failure is surfaced...
    await waitFor(() => expect(screen.getByText(/turn on mic access/i)).toBeTruthy());
    // ...and the fake RECORDING screen (its Stop control) was NEVER entered.
    expect(screen.queryByText("Stop")).toBeNull();
    // Still on the idle screen (Record Pitch is still the offered action).
    expect(screen.getByText("Record Pitch")).toBeTruthy();
  });
});
