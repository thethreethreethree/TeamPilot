// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

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

  it("by rep (F16.5): overdue first, last feedback, open requests, calls not yet coached", async () => {
    metrics = {
      decided: true, since: "x", sessions: 3, feedbackGiven: {}, callsListened: {},
      byRep: [
        { repId: "bo", name: "Bo", feedback30: 0, lastFeedbackAt: null, overdue: true, openRequests: 1, calls30: 2, callsWithoutFeedback30: 2, uncoached: [{ id: "c2", label: "Betty", startedAt: "2026-11-24T10:00:00Z" }, { id: "c1", label: null, startedAt: "2026-11-20T10:00:00Z" }] },
        { repId: "ana", name: "Ana", feedback30: 3, lastFeedbackAt: new Date(Date.now() - 86_400_000).toISOString(), overdue: false, openRequests: 0, calls30: 4, callsWithoutFeedback30: 1, uncoached: [{ id: "c9", label: "Acme", startedAt: "2026-11-23T10:00:00Z" }] },
      ],
    };
    render(<CoachingInbox />);
    const table = await screen.findByLabelText("Coaching by rep");
    const rows = [...table.querySelectorAll("tbody tr")].map((r) => r.textContent);
    expect(rows).toEqual(["BoOverdue · never012 · 2", "Anayesterday304 · 1"]);
    // F16.6: a rep's uncoached count opens those calls, each a link to the call.
    fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]!);
    const list = screen.getByLabelText("Bo's calls not yet coached");
    expect([...list.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/dashboard/remote-sales/calls/c2", "/dashboard/remote-sales/calls/c1"]);
    expect(list.textContent).toContain("Untitled call");
  });
});
