// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Capture-loss visibility (founder 2026-08-23). Two guarantees, both aimed at ending the guess-cycle:
 *  1. When the mic track dies mid-pitch (recorder.captureInterrupted), the rep is WARNED live so they can recover
 *     the pitch — not left to discover "no audio" afterward.
 *  2. When a pitch ends with NO audio, the recorder's ground-truth diagnostics are POSTed to capture-diag so the
 *     real cause is on the record instead of assumed.
 */
const rec = vi.hoisted(() => ({
  captureInterrupted: false,
  stopResult: { blob: null as Blob | null, durationMs: 42000, chunksUploaded: 0, diag: {
    sawData: false, chunkCount: 0, chunksUploaded: 0, durationMs: 42000, mimeType: "audio/mp4",
    recorderError: null, trackEnded: true, trackMuted: false, trackReadyState: "ended",
    wakeLockGranted: false, hiddenDuringRecording: 1, ua: "iPhone",
  } },
}));

vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: true,
    recording: false,
    level: 0,
    elapsedMs: 0,
    captureInterrupted: rec.captureInterrupted,
    arm: vi.fn(async () => true),
    start: vi.fn(async () => true),
    stop: vi.fn(async () => rec.stopResult),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { refreshSession: vi.fn(async () => ({ data: { session: {} }, error: null })) } }),
}));

import { DoorLog } from "../DoorLog";

const KPI = { doorsKnocked: 0, sold: 0, goBacks: 0, notInterested: 0 };
type Post = { url: string; body: Record<string, unknown> };

function mockFetch(posts: Post[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") posts.push({ url, body: JSON.parse(init.body ?? "{}") });
      return { ok: true, status: 200, json: async () => (init?.method === "POST" ? { knockId: "k1" } : KPI) };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  rec.captureInterrupted = false;
});

describe("DoorLog — capture-loss visibility (founder 2026-08-23)", () => {
  it("warns the rep LIVE when the mic track dies mid-pitch (captureInterrupted)", async () => {
    rec.captureInterrupted = true;
    mockFetch([]);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());
    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    // The honest in-moment warning is shown so the rep can recover the pitch.
    expect(screen.getByText(/mic stopped/i)).toBeTruthy();
  });

  it("POSTs the ground-truth diagnostics to capture-diag when a pitch records NO audio", async () => {
    const posts: Post[] = [];
    mockFetch(posts);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());
    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    fireEvent.click(screen.getByText("Sold")); // no audio → no_capture path

    const diagPost = await waitFor(() => {
      const p = posts.find((p) => p.url.includes("/capture-diag"));
      expect(p).toBeTruthy();
      return p!;
    });
    // The recorder's ground-truth cause is on the record: the mic track ended, on iPhone, nothing captured.
    const diag = diagPost.body.diag as Record<string, unknown>;
    expect(diag.trackEnded).toBe(true);
    expect(diag.sawData).toBe(false);
    expect(diag.ua).toBe("iPhone");
  });
});
