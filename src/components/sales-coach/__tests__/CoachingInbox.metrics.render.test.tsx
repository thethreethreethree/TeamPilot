// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * The coaching metrics under the inbox (D8 decided 2026-11-22). Before the decision the route answered 409 and the panel
 * only printed why; the decided shape had nowhere to render, so deciding D8 would have unlocked an empty space.
 */
import { CoachingInbox } from "../CoachingInbox";

const fetchMock = vi.fn();
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
let metrics: unknown;
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/coach/remote/coaching-inbox") return json({ available: true, items: [] });
    if (url === "/api/team") return json({ members: [{ id: "m1", full_name: "Max Manager" }, { id: "m2", full_name: "Rae Lead" }] });
    if (url === "/api/coach/remote/coaching-metrics") return json(metrics);
    return json({}, false);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("coaching metrics", () => {
  it("shows feedback given and calls listened per manager, by name, most feedback first", async () => {
    metrics = { decided: true, since: "2026-10-23T00:00:00Z", sessions: 12, feedbackGiven: { m2: 1, m1: 4 }, callsListened: { m1: 3, m2: 5 } };
    render(<CoachingInbox />);
    expect(await screen.findByText("Coaching in the last 30 days")).toBeTruthy();
    const rows = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows).toEqual(["Max Manager43", "Rae Lead15"]);
  });

  it("says plainly when nothing has happened yet", async () => {
    metrics = { decided: true, since: "x", sessions: 7, feedbackGiven: {}, callsListened: {} };
    render(<CoachingInbox />);
    expect(await screen.findByText(/No feedback given or calls listened to yet across 7 phone and video calls/)).toBeTruthy();
  });
});
