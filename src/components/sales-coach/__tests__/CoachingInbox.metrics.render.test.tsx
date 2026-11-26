// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * The coaching metrics under the inbox (D8 decided 2026-11-22). Before the decision the route answered 409 and the panel
 * only printed why; the decided shape had nowhere to render, so deciding D8 would have unlocked an empty space.
 */
vi.mock("@/lib/hooks/useCurrentUserId", () => ({ useCurrentUserId: () => "m1" }));
import { CoachingInbox } from "../CoachingInbox";

const fetchMock = vi.fn();
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
let metrics: unknown;
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/coach/remote/coaching-inbox") return json({ available: true, items: [] });
    if (url === "/api/team") return json({ members: [{ id: "m1", full_name: "Max Manager" }, { id: "m2", full_name: "Rae Lead" }] });
    if (url.startsWith("/api/coach/remote/coaching-metrics")) return json(typeof metrics === "function" ? (metrics as (u: string) => unknown)(url) : metrics);
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
    metrics = { decided: true, since: "2026-10-23T00:00:00Z", sessions: 12, feedbackGiven: { m2: 1, m1: 4 }, callsWithFeedback: { m1: 2, m2: 1 }, callsWithComments: { m1: 1 }, callsListened: { m1: 3, m2: 5 }, responseHours: { m1: { medianHours: 5.5, answered: 2 }, m2: { medianHours: 36, answered: 1 } } };
    render(<CoachingInbox />);
    expect(await screen.findByText("Coaching in the last 30 days")).toBeTruthy();
    const rows = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    // name · feedback · calls with feedback · calls with comments · calls listened
    expect(rows).toEqual(["Max Manager42135.5 h (2)", "Rae Lead11051.5 d (1)"]);
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
  it("a manager whose only coaching was answering a request still has a row (review 2026-11-25)", async () => {
    metrics = { decided: true, since: "x", sessions: 2, feedbackGiven: {}, callsListened: {}, responseHours: { m1: { medianHours: 3, answered: 1 } } };
    render(<CoachingInbox />);
    expect(await screen.findByText("3 h (1)")).toBeTruthy();
  });
});

describe("CoachingInbox — switching team (review 2026-11-26)", () => {
  it("a failed load for the new team shows the failure, not the previous team's rows", async () => {
    const { render, screen, waitFor } = await import("@testing-library/react");
    const { CoachingInbox } = await import("../CoachingInbox");
    let fail = false;
    vi.stubGlobal("fetch", vi.fn((u: string) => {
      if (u.includes("coaching-inbox")) return fail ? Promise.resolve({ ok: false, status: 404, json: async () => ({ error: "Team not found." }) }) : Promise.resolve({ ok: true, status: 200, json: async () => ({ available: true, items: [{ id: "a", sessionId: "s1", repId: "r1", repName: "Old Team Rep", callLabel: "Acme", context: "phone", callAt: "2026-11-20T10:00:00Z", message: null, createdAt: "2026-11-20T10:00:00Z", open: true, toYou: true, toNamedManager: false, youListenedSeconds: 0 }] }) });
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    }));
    const { rerender } = render(<CoachingInbox team="t1" />);
    expect(await screen.findByText(/Old Team Rep/)).toBeTruthy();
    fail = true;
    rerender(<CoachingInbox team="t2" />);
    await waitFor(() => expect(screen.queryByText(/Old Team Rep/)).toBeNull());
  });
});

describe("CoachingInbox — change against the 30 days before (F16.8)", () => {
  it("shows ▲/▼ with the earlier number, and keeps a manager who stopped coaching", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { CoachingInbox } = await import("../CoachingInbox");
    vi.stubGlobal("fetch", vi.fn((u: string) => {
      if (u.includes("coaching-inbox")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ available: true, items: [] }) });
      if (u.includes("/api/team")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ members: [{ id: "m1", full_name: "Mia" }, { id: "m2", full_name: "Zed" }] }) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({
        decided: true, since: "2026-10-27T00:00:00Z", sessions: 9,
        feedbackGiven: { m1: 5 }, callsWithFeedback: { m1: 4 }, callsWithComments: { m1: 2 }, callsListened: {},
        previous: { feedbackGiven: { m1: 2, m2: 3 }, callsWithFeedback: { m1: 4, m2: 2 }, callsWithComments: { m1: 1, m2: 1 } },
      }) });
    }));
    render(<CoachingInbox />);
    const mia = (await screen.findByText("Mia")).closest("tr")!;
    expect(mia.textContent).toContain("5▲3"); // feedback 5, was 2
    expect(mia.textContent).toContain("2▲1"); // comments 2, was 1; calls-with-feedback 4 = 4 shows no arrow
    const zed = screen.getByText("Zed").closest("tr")!; // coached before, not now — still a row
    expect(zed.textContent).toContain("0▼3");
  });

  it("a period (F16.8): 7 / 30 / 90 days refetch with ?days=, the heading follows the answer, and the CSV link carries the period", async () => {
    metrics = (u: string) => {
      const d = Number(new URL(u, "http://t").searchParams.get("days"));
      return { decided: true, days: d, since: "x", sessions: 3, feedbackGiven: { m1: d === 7 ? 1 : 4 }, callsListened: {} };
    };
    render(<CoachingInbox />);
    expect(await screen.findByText("Coaching in the last 30 days")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download CSV" }).getAttribute("href")).toBe("/api/coach/remote/coaching-metrics?format=csv&days=30");
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(await screen.findByText("Coaching in the last 7 days")).toBeTruthy();
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain("/api/coach/remote/coaching-metrics?days=7");
    expect(screen.getByRole("button", { name: "7 days" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: "Download CSV" }).getAttribute("href")).toBe("/api/coach/remote/coaching-metrics?format=csv&days=7");
  });

  it("the CSV link follows the team picker (it used to download the whole company)", async () => {
    metrics = { decided: true, days: 30, since: "x", sessions: 1, feedbackGiven: { m1: 1 }, callsListened: {} };
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/coach/remote/coaching-inbox")) return json({ available: true, items: [] });
      if (url === "/api/team") return json({ members: [{ id: "m1", full_name: "Max Manager" }] });
      if (url.startsWith("/api/coach/remote/coaching-metrics")) return json(metrics);
      return json({}, false);
    });
    render(<CoachingInbox team="m9" />);
    expect(await screen.findByText("Coaching in the last 30 days")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download CSV" }).getAttribute("href")).toBe("/api/coach/remote/coaching-metrics?format=csv&days=30&team=m9");
  });

  it("calls listened to and response time show their change too; no arrow when the period before had no answer", async () => {
    metrics = {
      decided: true, days: 30, since: "x", sessions: 9,
      feedbackGiven: { m1: 2, m2: 1 }, callsListened: { m1: 5, m2: 1 },
      responseHours: { m1: { medianHours: 4, answered: 3 }, m2: { medianHours: 10, answered: 1 } },
      previous: { feedbackGiven: { m1: 2, m2: 1 }, callsWithFeedback: {}, callsWithComments: {}, callsListened: { m1: 2, m2: 1 }, responseHours: { m1: { medianHours: 6.5, answered: 2 } } },
    };
    render(<CoachingInbox />);
    await screen.findByText("Coaching in the last 30 days");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]!.textContent).toContain("5▲3"); // listened 5, was 2
    expect(rows[0]!.textContent).toContain("4 h (3)▼2.5 h"); // median 4 h, was 6.5 h
    expect(rows[1]!.textContent).not.toMatch(/10 h \(1\)[▲▼]/); // m2 had no answer before: no arrow
    expect(screen.getByTitle("2 in the 30 days before")).toBeTruthy();
  });

  it("a period that fails to load keeps the period buttons and says so, instead of the panel vanishing", async () => {
    let fail = false;
    metrics = { decided: true, days: 30, since: "x", sessions: 1, feedbackGiven: { m1: 1 }, callsListened: {} };
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/coach/remote/coaching-inbox")) return json({ available: true, items: [] });
      if (url === "/api/team") return json({ members: [] });
      if (url.startsWith("/api/coach/remote/coaching-metrics")) return fail ? json({ error: "x" }, false) : json(metrics);
      return json({}, false);
    });
    render(<CoachingInbox />);
    await screen.findByText("Coaching in the last 30 days");
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Couldn't load coaching for the last 90 days/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "30 days" })).toBeTruthy(); // still there to try again
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(await screen.findByText("Coaching in the last 30 days")).toBeTruthy();
  });

  it("response time's change is in the unit shown beside it", async () => {
    metrics = {
      decided: true, days: 30, since: "x", sessions: 2, feedbackGiven: { m1: 1 }, callsListened: {},
      responseHours: { m1: { medianHours: 84, answered: 2 } },
      previous: { feedbackGiven: { m1: 1 }, callsWithFeedback: {}, callsWithComments: {}, callsListened: {}, responseHours: { m1: { medianHours: 48, answered: 1 } } },
    };
    render(<CoachingInbox />);
    await screen.findByText("Coaching in the last 30 days");
    expect(screen.getAllByRole("row")[1]!.textContent).toContain("3.5 d (2)▲1.5 d");
  });

  it("F16.6: on another manager's team, coaching can be shown by everyone, only theirs, or only yours", async () => {
    metrics = { decided: true, days: 30, since: "x", sessions: 4, feedbackGiven: { m1: 2, m2: 5, m3: 1 }, callsListened: {} };
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/coach/remote/coaching-inbox")) return json({ available: true, items: [] });
      if (url === "/api/team") return json({ members: [{ id: "m1", full_name: "Max Manager" }, { id: "m2", full_name: "Rae Lead" }, { id: "m3", full_name: "Sam" }] });
      if (url.startsWith("/api/coach/remote/coaching-metrics")) return json(metrics);
      return json({}, false);
    });
    render(<CoachingInbox team="m2" />);
    await screen.findByText("Coaching in the last 30 days");
    const rowNames = () => screen.getAllByRole("row").slice(1).map((r) => r.querySelector("td")?.textContent);
    expect(rowNames()).toEqual(["Rae Lead", "Max Manager", "Sam"]);
    fireEvent.click(await screen.findByRole("button", { name: "Rae Lead" }));
    expect(rowNames()).toEqual(["Rae Lead"]);
    fireEvent.click(screen.getByRole("button", { name: "You" }));
    expect(rowNames()).toEqual(["Max Manager"]);
  });

  it("the filter isn't offered on your own team or with no team picked", async () => {
    metrics = { decided: true, days: 30, since: "x", sessions: 1, feedbackGiven: { m1: 1 }, callsListened: {} };
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/coach/remote/coaching-inbox")) return json({ available: true, items: [] });
      if (url === "/api/team") return json({ members: [{ id: "m1", full_name: "Max Manager" }] });
      if (url.startsWith("/api/coach/remote/coaching-metrics")) return json(metrics);
      return json({}, false);
    });
    render(<CoachingInbox team="m1" />);
    await screen.findByText("Coaching in the last 30 days");
    expect(screen.queryByRole("group", { name: "Coaching by" })).toBeNull();
  });
  it("F16.6: interaction alerts on calls not yet coached — chips, an alerts-only filter, and too-few-calls / failed wording", async () => {
    const bo = { repId: "bo", name: "Bo", feedback30: 0, lastFeedbackAt: null, overdue: true, openRequests: 0, calls30: 2, callsWithoutFeedback30: 2, uncoached: [{ id: "c2", label: "Betty", startedAt: "2026-11-24T10:00:00Z" }, { id: "c1", label: "Acme", startedAt: "2026-11-20T10:00:00Z" }] };
    metrics = { decided: true, since: "x", sessions: 2, feedbackGiven: {}, callsListened: {}, byRep: [bo], alerts: { baselineCalls: 40, needed: 0, byCall: { c1: ["talked_most"] } } };
    render(<CoachingInbox />);
    await screen.findByLabelText("Coaching by rep");
    fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]!);
    const list = screen.getByLabelText("Bo's calls not yet coached");
    expect(list.textContent).toContain("Rep talked more than in 9 of 10 team calls");
    fireEvent.click(screen.getByLabelText(/Only calls with an interaction alert \(1\)/));
    expect([...list.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/dashboard/remote-sales/calls/c1"]);
    cleanup();
    metrics = { decided: true, since: "x", sessions: 2, feedbackGiven: {}, callsListened: {}, byRep: [bo], alerts: { baselineCalls: 5, needed: 15, byCall: {} } };
    render(<CoachingInbox />);
    await screen.findByLabelText("Coaching by rep");
    fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]!);
    expect(screen.getByText(/15 more analyzed calls/)).toBeTruthy();
    expect(screen.queryByLabelText(/Only calls with an interaction alert/)).toBeNull();
    cleanup();
    metrics = { decided: true, since: "x", sessions: 2, feedbackGiven: {}, callsListened: {}, byRep: [bo], alerts: null };
    render(<CoachingInbox />);
    await screen.findByLabelText("Coaching by rep");
    fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]!);
    expect(screen.getByText("Couldn't load interaction alerts.")).toBeTruthy();
  });
  it("F16.6: every rep's uncoached calls with an alert in one list, newest first; hidden when none", async () => {
    const rep = (id: string, name: string, calls: Array<{ id: string; label: string; startedAt: string }>) => ({ repId: id, name, feedback30: 0, lastFeedbackAt: null, overdue: false, openRequests: 0, calls30: calls.length, callsWithoutFeedback30: calls.length, uncoached: calls });
    metrics = {
      decided: true, since: "x", sessions: 3, feedbackGiven: {}, callsListened: {},
      byRep: [rep("bo", "Bo", [{ id: "c1", label: "Acme", startedAt: "2026-11-20T10:00:00Z" }, { id: "c2", label: "Calm", startedAt: "2026-11-21T10:00:00Z" }]), rep("ana", "Ana", [{ id: "c3", label: "Zed", startedAt: "2026-11-24T10:00:00Z" }])],
      alerts: { baselineCalls: 40, needed: 0, byCall: { c1: ["long_monologue"], c3: ["talked_most"] } },
    };
    render(<CoachingInbox />);
    fireEvent.click(await screen.findByRole("button", { name: "2 uncoached calls with an interaction alert" }));
    const list = screen.getByLabelText("Uncoached calls with an interaction alert");
    expect([...list.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/dashboard/remote-sales/calls/c3", "/dashboard/remote-sales/calls/c1"]);
    expect(list.textContent).toContain("Ana · Zed");
    cleanup();
    metrics = { ...(metrics as object), alerts: { baselineCalls: 40, needed: 0, byCall: {} } };
    render(<CoachingInbox />);
    await screen.findByLabelText("Coaching by rep");
    expect(screen.queryByRole("button", { name: /with an interaction alert/ })).toBeNull();
  });
});

