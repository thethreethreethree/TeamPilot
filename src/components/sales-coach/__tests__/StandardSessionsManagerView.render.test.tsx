// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { StandardSessionsManagerView } from "../StandardSessionsManagerView";

/**
 * The manager USAGE roster (founder 2026-08-27 "monitor their usage"). §3.4 honesty seam: the team-activity route
 * computes how many of a rep's sessions actually captured audio (withAudio), but the roster USED to render only the
 * session count — so a rep who was "active" while every capture failed (the iOS webm-stub class) read as healthy
 * ("44 sessions") and the founder was blind to the failure in the exact surface built to catch it. This gates that
 * the annotation surfaces withAudio, and flags the all-failed case, so the computed signal can't be dropped again
 * (the "dead surface hides a silent gap" regression that had just occurred).
 */

const MEMBERS = [
  { id: "rep-a", fullName: "Knute Knudtson", companyRole: "staff", salesCoachRole: "staff" },
  { id: "rep-b", fullName: "Anthony Vega", companyRole: "staff", salesCoachRole: "staff" },
];
const ACTIVITY = {
  "rep-a": { count: 44, withAudio: 0, lastActiveAt: "2026-08-25T10:00:00.000Z" }, // active but EVERY capture failed
  "rep-b": { count: 10, withAudio: 8, lastActiveAt: "2026-08-26T10:00:00.000Z" }, // healthy: most captured audio
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("team-activity")) {
        return { ok: true, status: 200, json: async () => ({ byAgent: ACTIVITY, windowDays: 30 }) };
      }
      // /api/coach/sales-session/team
      return { ok: true, status: 200, json: async () => ({ members: MEMBERS, isManager: true }) };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StandardSessionsManagerView — usage roster surfaces audio-capture honesty (§3.4)", () => {
  it("shows N-with-audio per rep, and flags a rep who was active but captured NO audio", async () => {
    mockFetch();
    render(<StandardSessionsManagerView fallback={<div>rep self-view</div>} />);

    // A rep with sessions but zero audio must NOT read as healthy — the founder's exact monitoring failure.
    const failing = await waitFor(() => screen.getByText(/⚠ none with audio/i));
    expect(failing).toBeTruthy();
    // …and the count is still shown alongside it (not hidden), so "44 sessions · ⚠ none with audio" is the truth.
    expect(screen.getByText(/44 session/)).toBeTruthy();

    // A healthy rep shows the real with-audio count, not the warning.
    expect(screen.getByText(/8 with audio/)).toBeTruthy();
  });
});
