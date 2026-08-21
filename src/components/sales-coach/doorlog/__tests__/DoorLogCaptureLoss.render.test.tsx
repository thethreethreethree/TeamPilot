// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * The critical trust bug (founder 2026-08-22, "didn't save on our end" → "we look pathetic"): when audio
 * capture produced NO blob — the recorder seams from the capture crisis (mid-call recorder recreation,
 * mobile lock, zero chunks) — the client omitted `storagePath`, the server's PitchBody REQUIRED it, the POST
 * 400'd, and the ENTIRE pitch (the sale, the outcome, the door) was lost. The rep saw a red "didn't save on
 * our end" and the disposition was gone.
 *
 * The fix: a pitch IS its recording — with no usable audio, log the DISPOSITION as a KNOCK so the outcome +
 * KPI are never lost, and tell the rep honestly (amber heads-up, not a red failure). This gate proves the
 * component actually does that (the "test the consumer, not just the mapping" lesson), plus the paired
 * revision: a "Not Home / No Answer" tag from the OUTCOME screen so a stopped recording isn't forced into a
 * false Sold/Go-Back/Not-Interested.
 */

// Recorder that captures NOTHING — stop() resolves a null blob, exactly the capture-crisis seam output.
vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: true,
    recording: false,
    level: 0,
    elapsedMs: 0,
    arm: vi.fn(async () => true),
    start: vi.fn(async () => true),
    stop: vi.fn(async () => ({ blob: null, durationMs: 0 })), // capture produced no audio
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
type Post = { url: string; body: Record<string, unknown> };

// Capture every POST body so we can assert WHAT was written; GETs return the KPI strip.
function mockFetchCapturing(posts: Post[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push({ url, body: JSON.parse(init.body ?? "{}") });
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

describe("DoorLog — capture loss never drops the outcome (founder 2026-08-22)", () => {
  it("no audio captured → picking the outcome logs a KNOCK directly (skips naming), with an honest amber notice and NO red failure", async () => {
    const posts: Post[] = [];
    mockFetchCapturing(posts);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());

    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    fireEvent.click(screen.getByText("Sold"));

    // No naming step — capture produced no audio, so there is no pitch to name. The disposition is logged
    // directly as a knock carrying the picked outcome — never an audio-less pitch (which the server 400s),
    // and no sign step ran (no blob to upload).
    await waitFor(() => expect(posts.some((p) => p.body.kind === "knock")).toBe(true));
    const knock = posts.find((p) => p.body.kind === "knock");
    expect(knock!.body).toMatchObject({ kind: "knock", outcome: "sold" });
    expect(posts.some((p) => p.body.kind === "pitch")).toBe(false);
    expect(posts.some((p) => p.body.kind === "sign")).toBe(false);
    expect(screen.queryByText(/Name this pitch/i)).toBeNull(); // naming skipped

    // Honest, non-alarming: an amber heads-up that no audio was recorded — NOT a red "didn't save", and NOT
    // the misleading "recorded no audio" for what is really a no-capture (mic) case (audit M1 distinguishes them).
    expect(await screen.findByText(/no audio was recorded, so there's nothing to review/i)).toBeTruthy();
    expect(screen.queryByText(/didn't save/i)).toBeNull();
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy()); // flowed home to idle
  });

  it("'Not Home / No Answer' from the OUTCOME screen logs a no-answer knock and returns home (paired revision)", async () => {
    const posts: Post[] = [];
    mockFetchCapturing(posts);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());

    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(screen.getByText("Not Home / No Answer")).toBeTruthy());
    fireEvent.click(screen.getByText("Not Home / No Answer"));

    // Logged a No-Answer knock (not a forced Sold/Go-Back), discarded the recording, and flowed home to IDLE.
    await waitFor(() => expect(posts.some((p) => p.body.kind === "knock")).toBe(true));
    expect(posts.find((p) => p.body.kind === "knock")!.body).toMatchObject({
      kind: "knock",
      outcome: "no_answer",
    });
    expect(posts.some((p) => p.body.kind === "pitch")).toBe(false);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy()); // back on the idle screen
    expect(screen.queryByText("How did it go?")).toBeNull();
  });
});
