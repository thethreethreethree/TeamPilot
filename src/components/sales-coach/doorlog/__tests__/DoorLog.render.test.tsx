// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Render gate for the mic-denied path (audit 2026-08-18 → founder 2026-08-21). ORIGINALLY: a mic-denied rep
 * must never enter a fake RECORDING screen (which would save a silent no-audio pitch — error dressed as
 * success). NOW ALSO: a mic-denied rep must still be able to LOG a pitch outcome (Sold/Go-Back/etc), not be
 * stuck logging only No-Answer — the whole point of the "Log Pitch" no-record path. This asserts both: mic
 * denied surfaces "Log Pitch" (never "Record Pitch"), and logging an outcome goes outcome→idle as a knock
 * WITHOUT ever showing the recording Stop control. Component-render class of bug is invisible to node-only tests.
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

describe("DoorLog — mic-denied still lets the rep log a pitch (no fake recording)", () => {
  it("mic denied → offers Log Pitch (not Record), logs an outcome as a knock, never enters a recording screen", async () => {
    render(<DoorLog />);

    // Mic is denied on mount → the primary action is Log Pitch, not Record Pitch (founder 2026-08-21: a
    // mic-less rep must still be able to log Sold/Go-Back — previously they could log ONLY No Answer).
    await waitFor(() => expect(screen.getByText("Log Pitch")).toBeTruthy());
    expect(screen.queryByText("Record Pitch")).toBeNull();
    // Honest hint: they can still log every outcome (no false "you're locked out").
    expect(screen.getByText(/you can still log every outcome/i)).toBeTruthy();

    // Log Pitch → straight to the outcome screen. The fake RECORDING screen (its Stop control) is NEVER shown.
    fireEvent.click(screen.getByText("Log Pitch"));
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    expect(screen.queryByText("Stop")).toBeNull();

    // Pick an outcome → logged as a knock, back to IDLE. No naming step (nothing was recorded to name).
    fireEvent.click(screen.getByText("Sold"));
    await waitFor(() => expect(screen.getByText("Log Pitch")).toBeTruthy());
    expect(screen.queryByText(/Name this pitch/i)).toBeNull();
    expect(screen.queryByText("Stop")).toBeNull();
  });
});
