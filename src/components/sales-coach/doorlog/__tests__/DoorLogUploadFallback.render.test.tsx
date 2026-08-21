// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * M1 (audit 2026-08-22): when the rep DID record (a blob exists) but the upload fails, the outcome is preserved
 * as a knock — but the honest heads-up must say the RECORDING couldn't be SAVED, NOT "recorded no audio" (which
 * reads as "the app didn't record" — a lie the founder caught in the field). This is the fallback path (no
 * chunks landed → single-blob upload → it fails).
 */

// Recorder: a real recording, but NO chunks reached storage (chunk endpoint unavailable) → the fallback path.
vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: true,
    recording: false,
    level: 0,
    elapsedMs: 0,
    arm: vi.fn(async () => true),
    start: vi.fn(async () => true),
    stop: vi.fn(async () => ({ blob: new Blob(["x"]), durationMs: 60_000, chunksUploaded: 0 })),
  }),
}));
// Storage upload FAILS (weak signal) → the single-blob fallback can't save the audio.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { refreshSession: vi.fn(async () => ({ data: { session: {} }, error: null })) },
    storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: { message: "network" } }) }) },
  }),
}));

import { DoorLog } from "../DoorLog";

const KPI = { doorsKnocked: 0, sold: 0, goBacks: 0, notInterested: 0 };
type Post = { body: Record<string, unknown> };
function mockFetch(posts: Post[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        const body = JSON.parse(init.body ?? "{}");
        posts.push({ body });
        if (body.kind === "sign") return { ok: true, status: 200, json: async () => ({ storagePath: "co/2026/08/p.webm", token: "t" }) };
        return { ok: true, status: 200, json: async () => ({ knockId: "k1" }) };
      }
      return { ok: true, status: 200, json: async () => KPI };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DoorLog — an upload failure is honest ('couldn't save the recording', not 'no audio')", () => {
  it("blob recorded but upload fails → outcome saved as a knock, and the note says the recording couldn't be saved", async () => {
    const posts: Post[] = [];
    mockFetch(posts);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());

    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    fireEvent.click(screen.getByText("Stop"));
    // A blob exists → we DO name it (not a skip), then Save; the upload then fails and falls back to a knock.
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    fireEvent.click(screen.getByText("Sold"));
    await waitFor(() => expect(screen.getByText(/Save & Next Door/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Save & Next Door/i));

    // The disposition is preserved as a knock (never lost) …
    await waitFor(() => expect(posts.some((p) => p.body.kind === "knock")).toBe(true));
    expect(posts.find((p) => p.body.kind === "knock")!.body).toMatchObject({ kind: "knock", outcome: "sold" });
    // … and the heads-up is HONEST about the cause: the recording couldn't be saved (NOT "no audio").
    expect(await screen.findByText(/recording couldn't be saved/i)).toBeTruthy();
    expect(screen.queryByText(/no audio was recorded/i)).toBeNull();
    expect(screen.queryByText(/didn't save/i)).toBeNull(); // red failure banner never shown (the outcome saved)
  });
});
