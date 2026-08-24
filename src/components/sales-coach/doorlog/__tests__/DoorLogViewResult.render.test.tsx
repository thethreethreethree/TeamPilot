// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * "View last pitch result" button (founder 2026-08-24). After a rep ENDS a session (saves a recorded pitch),
 * the Door Log returns to IDLE and this optional affordance appears, jumping to that pitch's after-pitch result.
 * These pin the two behaviours a render regression would silently break:
 *   1. it APPEARS in IDLE after a real recorded pitch is saved (the feature), and is ABSENT before any pitch; and
 *   2. it does NOT appear when the save dropped to a knock (no audio) — there is no result to view, so offering
 *      one would be dishonest (§3.4). The discrimination is `justSavedPitch` set only on r.ok && !r.audioDropped.
 */

// Mutable stop-result so each test can choose the durability path: chunksUploaded>0 → the primary path saves a
// real pitch; chunksUploaded===0 with a blob → the fallback path (whose sign returns no storagePath under the
// generic fetch mock) drops to an audio-less knock.
const h = vi.hoisted(() => ({
  stopResult: { blob: new Blob(["x"]) as Blob | null, durationMs: 5000, chunksUploaded: 0 },
}));

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
    start: vi.fn(async () => true),
    stop: vi.fn(async () => h.stopResult),
  }),
}));

import { DoorLog } from "../DoorLog";

const BTN = /View last pitch result/i;

async function saveAPitch() {
  fireEvent.click(screen.getByText("Record Pitch"));
  await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
  fireEvent.click(screen.getByText("Stop"));
  await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
  fireEvent.click(screen.getByText("Sold"));
  await waitFor(() => expect(screen.getByText(/Name this pitch/i)).toBeTruthy());
  fireEvent.click(screen.getByText(/Save & Next Door/i));
  await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy()); // back to IDLE
}

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

describe("DoorLog — View last pitch result button", () => {
  it("appears in IDLE after a real recorded pitch is saved (and not before)", async () => {
    h.stopResult = { blob: new Blob(["x"]), durationMs: 5000, chunksUploaded: 2 }; // primary path → real pitch
    render(<DoorLog />);
    // Absent before any pitch this session.
    expect(screen.queryByText(BTN)).toBeNull();
    await saveAPitch();
    // Present once a real pitch has been saved — a link straight to the latest-pitch redirect.
    await waitFor(() => expect(screen.queryByText(BTN)).toBeTruthy());
    expect(screen.getByRole("link", { name: BTN }).getAttribute("href")).toBe(
      "/dashboard/sales-coach/doors/report-card/latest",
    );
  });

  it("does NOT appear when the save dropped to a knock (no audio to review — §3.4 honesty)", async () => {
    // Blob present (so the flow reaches naming/save), but no chunks → the fallback sign returns no storagePath
    // under the generic fetch mock → an audio-less knock (audioDropped) → no result exists → no button.
    h.stopResult = { blob: new Blob(["x"]), durationMs: 5000, chunksUploaded: 0 };
    render(<DoorLog />);
    await saveAPitch();
    // Give the fire-and-forget save's .then a tick to resolve, then assert the button stayed absent.
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());
    expect(screen.queryByText(BTN)).toBeNull();
  });
});
