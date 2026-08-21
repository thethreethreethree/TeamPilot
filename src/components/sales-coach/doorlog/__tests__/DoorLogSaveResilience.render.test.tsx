// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Consumer gate for the resilient save (founder 2026-08-21). The retry POLICY is unit-tested in
 * saveRetry.test.ts; this proves DoorLog actually WIRES it — a policy can be correct while the component
 * forgets to call refreshSession or shows the wrong copy (this repo's "test the consumer, not just the
 * mapping" lesson). Two fast paths: a 401 recovers via a session refresh with NO error banner, and a
 * server error shows the honest "on our end" copy — never blaming the rep's connection.
 */

const { refreshSpy } = vi.hoisted(() => ({
  refreshSpy: vi.fn(async () => ({ data: { session: {} }, error: null })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { refreshSession: refreshSpy },
    storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) },
  }),
}));
vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: true,
    recording: false,
    level: 0,
    elapsedMs: 0,
    arm: vi.fn(async () => true),
    start: vi.fn(async () => true),
    stop: vi.fn(async () => ({ blob: new Blob(["x"]), durationMs: 5000 })), // a real recording → exercises the sign path
  }),
}));

import { DoorLog } from "../DoorLog";

const KPI = { doorsKnocked: 0, sold: 0, goBacks: 0, notInterested: 0 };
// A GET (no method) is the KPI strip — always succeeds; only POSTs (the writes) run the scripted sequence.
function mockFetch(postSequence: Array<{ ok: boolean; status: number }>) {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "POST") {
        const step = postSequence[Math.min(i, postSequence.length - 1)] ?? { ok: false, status: 500 };
        i += 1;
        return { ok: step.ok, status: step.status, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => KPI };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refreshSpy.mockClear();
});

describe("DoorLog — resilient save wires the retry policy", () => {
  it("a 401 refreshes the session, retries, and shows NO error banner", async () => {
    mockFetch([
      { ok: false, status: 401 }, // expired token
      { ok: true, status: 200 }, // retry after refresh succeeds
    ]);
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("No Answer")).toBeTruthy());
    fireEvent.click(screen.getByText("No Answer"));

    // The expired-token path refreshed the session and recovered silently.
    await waitFor(() => expect(refreshSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/didn't save/i)).toBeNull();
  });

  it("a server error shows the honest 'on our end' copy — never the rep's connection", async () => {
    mockFetch([{ ok: false, status: 403 }]); // deterministic server refusal (no company) — not retryable
    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("No Answer")).toBeTruthy());
    fireEvent.click(screen.getByText("No Answer"));

    const banner = await screen.findByText(/didn't save/i);
    expect(banner.textContent).toMatch(/on our end/i);
    expect(banner.textContent).not.toMatch(/connection|signal/i);
  });

  it("a 401 on the audio-sign step refreshes + retries so the RECORDING lands too (long-field-session case)", async () => {
    // The sign step is where an expired token would silently drop a recorded pitch's audio. It must refresh
    // and retry the sign — not just the final pitch POST — so the recording (and its coaching) survives.
    let signCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
        if (init?.method === "POST") {
          const body = JSON.parse(init.body ?? "{}");
          if (body.kind === "sign") {
            signCalls += 1;
            return signCalls === 1
              ? { ok: false, status: 401, json: async () => ({}) } // expired token on first sign
              : { ok: true, status: 200, json: async () => ({ storagePath: "co/pitch.webm", token: "t" }) };
          }
          return { ok: true, status: 200, json: async () => ({}) }; // the pitch POST
        }
        return { ok: true, status: 200, json: async () => KPI };
      }),
    );

    render(<DoorLog />);
    await waitFor(() => expect(screen.getByText("Record Pitch")).toBeTruthy());
    fireEvent.click(screen.getByText("Record Pitch"));
    await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(screen.getByText("How did it go?")).toBeTruthy());
    fireEvent.click(screen.getByText("Sold"));
    await waitFor(() => expect(screen.getByText(/Save & Next Door/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Save & Next Door/i));

    // The sign step refreshed the session and was retried (2 sign calls), and the pitch saved with no banner.
    await waitFor(() => expect(refreshSpy).toHaveBeenCalled());
    expect(signCalls).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/didn't save/i)).toBeNull();
  });
});
