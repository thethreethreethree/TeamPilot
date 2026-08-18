// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Full-flow render gate for the Door Log state machine (audit 2026-08-18). The logic (stateMachine.ts) is unit
 * tested, but the founder's surfaced bugs were RENDER failures — the right control not appearing on screen — which
 * node-only logic tests can't see. This walks the happy path idle → recording → outcome → naming with the REAL
 * component and asserts the expected controls render at each step, so a render regression in ANY state fails CI.
 */

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) } }),
}));
vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: true,
    recording: false,
    level: 0,
    elapsedMs: 0,
    arm: vi.fn(async () => true),
    start: vi.fn(async () => true), // mic OK — the flow proceeds
    stop: vi.fn(async () => ({ blob: new Blob(["x"]), durationMs: 5000 })),
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

describe("DoorLog — full-flow render gate (each state shows the right controls)", () => {
  it("idle → recording → outcome → naming renders the expected control at every step", async () => {
    render(<DoorLog />);

    // IDLE: both field actions present.
    expect(screen.getByText("No Answer")).toBeTruthy();
    expect(screen.getByText("Record Pitch")).toBeTruthy();

    // → RECORDING: the discreet Stop appears; Record Pitch is gone.
    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    expect(screen.queryByText("Record Pitch")).toBeNull();

    // → OUTCOME: the four outcome choices.
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    for (const label of ["Sold", "Go Back", "Non-Decision Maker", "Not Interested"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    // → NAMING: the name field + the Save action (reachable, top-aligned above the keyboard).
    fireEvent.click(screen.getByText("Sold"));
    await waitFor(() => expect(screen.getByText(/Name this pitch/i)).toBeTruthy());
    expect(screen.getByText(/Save & Next Door/i)).toBeTruthy();
  });
});
