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
    stop: vi.fn(async () => ({ blob: null, durationMs: 0 })),
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
});
