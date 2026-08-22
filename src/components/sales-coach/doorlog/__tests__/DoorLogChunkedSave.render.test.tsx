// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * The durable-upload consumer gate (founder 2026-08-22). The recorder now uploads ~15s chunks DURING recording;
 * when ≥1 chunk reached storage, the pitch must save by REFERENCE (recordingId → server stitches) and NOT run
 * the single-blob sign+upload (the large final upload that fails on long field recordings). This proves the
 * component actually routes that way (test-the-consumer, not just the mapping).
 */

// Recorder that reports chunks uploaded during recording (the durable path).
vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: true,
    recording: false,
    level: 0,
    elapsedMs: 0,
    arm: vi.fn(async () => true),
    start: vi.fn(async () => true),
    stop: vi.fn(async () => ({ blob: new Blob(["x"]), durationMs: 60_000, chunksUploaded: 4 })),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { refreshSession: vi.fn(async () => ({ data: { session: {} }, error: null })) },
    storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) },
  }),
}));

import { DoorLog } from "../DoorLog";

const KPI = { doorsKnocked: 0, sold: 0, goBacks: 0, notInterested: 0 };
type Post = { body: Record<string, unknown>; keepalive?: boolean };

function mockFetchCapturing(posts: Post[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { method?: string; body?: string; keepalive?: boolean }) => {
      if (init?.method === "POST") {
        posts.push({ body: JSON.parse(init.body ?? "{}"), keepalive: init.keepalive });
        return { ok: true, status: 200, json: async () => ({ knockId: "k1", pitchId: "p1" }) };
      }
      return { ok: true, status: 200, json: async () => KPI };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DoorLog — chunked recordings save by reference (no large final upload)", () => {
  it("a recording that streamed chunks saves the pitch with a recordingId and NEVER runs the sign/single-blob upload", async () => {
    const posts: Post[] = [];
    mockFetchCapturing(posts);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());

    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    fireEvent.click(screen.getByText("Sold"));
    // Chunks landed → the recording exists, so we DO name + save it (not a knock fallback).
    await waitFor(() => expect(screen.getByText(/Save & Next Door/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Save & Next Door/i));

    const pitch = await waitFor(() => {
      const p = posts.find((p) => p.body.kind === "pitch");
      expect(p).toBeTruthy();
      return p!;
    });
    // Saved by REFERENCE to the streamed chunks — carries a recordingId, no client storagePath.
    expect(typeof pitch.body.recordingId).toBe("string");
    expect((pitch.body.recordingId as string).length).toBeGreaterThanOrEqual(8);
    expect(pitch.body.storagePath).toBeUndefined();
    // The single-blob path never ran: no { kind: "sign" } request.
    expect(posts.some((p) => p.body.kind === "sign")).toBe(false);
    // No red failure banner.
    expect(screen.queryByText(/didn't save/i)).toBeNull();
    // audit M2: the pitch POST must use keepalive so it survives the rep walking to the next door mid-flight.
    expect(pitch.keepalive).toBe(true);
  });

  it("the door-log POST uses keepalive (audit M2 — survives the rep leaving before it completes)", async () => {
    const posts: Post[] = [];
    mockFetchCapturing(posts);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());

    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    fireEvent.click(screen.getByText("Sold"));
    await waitFor(() => expect(screen.getByText(/Save & Next Door/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Save & Next Door/i));

    // EVERY door-log POST (knock or pitch) is fire-and-forget from the rep's view, so all must be keepalive.
    await waitFor(() => expect(posts.some((p) => p.body.kind === "pitch")).toBe(true));
    expect(posts.every((p) => p.keepalive === true)).toBe(true);
  });
});
