// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Comments on a Remote Sales call (2026-11-22 Gong re-grade, F9.8). Before this, a manager could not comment on a
 * phone/video call at all: the only comment box lived on a list that shows in-person calls, and the by-id read was
 * filtered to in-person too — so even an existing comment on a remote call could not be read back by anyone.
 */

let manager = true;
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({
  useIsSalesCoachManager: () => manager,
  useCurrentUserRole: () => (manager ? "Member" : "Member"),
  isCompanyAdminRole: () => false,
}));

import { RemoteCallComments, parseClock } from "../RemoteCallComments";

const fetchMock = vi.fn();
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });

function route(pitch: unknown, moments: unknown[] = []) {
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/coach/sales-session/pitch-score?")) return json({ pitch });
    if (url.startsWith("/api/coach/sales-session/pitch-recordings?")) return json({ moments, viewerId: "mgr" });
    if (url === "/api/team") return json({ members: [{ id: "rep1", full_name: "Rae" }, { id: "mgr", full_name: "Max" }] });
    return json({}, false);
  });
}

beforeEach(() => {
  manager = true;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("parseClock", () => {
  it("reads m:ss and plain seconds, refuses anything else", () => {
    expect(parseClock("1:05")).toBe(65);
    expect(parseClock("90")).toBe(90);
    expect(parseClock("")).toBe(0);
    expect(parseClock("1:75")).toBeNull();
    expect(parseClock("soon")).toBeNull();
  });
});

describe("RemoteCallComments", () => {
  it("a manager on an unscored call is told comments open once it is scored — not shown a box that would fail", async () => {
    route(null);
    render(<RemoteCallComments sessionId="s1" />);
    expect(await screen.findByText("Comments open once this call is scored.")).toBeTruthy();
    expect(screen.queryByPlaceholderText("What should the rep hear here?")).toBeNull();
  });

  it("a manager on a scored call sees the comments and a box to write one, with the rep marked among mentions", async () => {
    route({ id: "p1", repId: "rep1" }, [
      { id: "c1", kind: "comment", atSeconds: 65, label: "Max", detail: "Slow down here", points: null },
      { id: "e1", kind: "missed", atSeconds: 10, label: "Intro", detail: null, points: -2 },
    ]);
    render(<RemoteCallComments sessionId="s1" />);
    expect(await screen.findByText("Slow down here")).toBeTruthy();
    expect(screen.queryByText("Intro")).toBeNull(); // only comments, not rubric moments
    expect(screen.getByPlaceholderText("What should the rep hear here?")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("@Rae (rep)")).toBeTruthy());
    expect(screen.queryByText("@Max")).toBeNull(); // you don't mention yourself
  });

  it("a rep with nothing sent to them sees nothing at all", async () => {
    manager = false;
    route({ id: "p1", repId: "rep1" }, []);
    const { container } = render(<RemoteCallComments sessionId="s1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(container.innerHTML).toBe("");
  });

  it("a rep sees what was sent to them, with no box to write in", async () => {
    manager = false;
    route({ id: "p1", repId: "rep1" }, [{ id: "c1", kind: "comment", atSeconds: 5, label: "Max", detail: "Great opener", points: null }]);
    render(<RemoteCallComments sessionId="s1" />);
    expect(await screen.findByText("From your manager")).toBeTruthy();
    expect(screen.getByText("Great opener")).toBeTruthy();
    expect(screen.queryByPlaceholderText("What should the rep hear here?")).toBeNull();
  });
});

describe("the by-id recording read is not scoped to a channel", () => {
  it("readPitchRecordingDetail has no channel filter (the in-person scope is for the Sales Coach LIST only)", () => {
    const src = readFileSync(resolve(__dirname, "../../../lib/coach/recordings/readRecordings.ts"), "utf8");
    const detail = src.slice(src.indexOf("export async function readPitchRecordingDetail"));
    const firstQuery = detail.slice(0, detail.indexOf(".maybeSingle()"));
    expect(firstQuery).not.toMatch(/\.in\(\s*"channel"/);
    // …while the list keeps it, so Sales Coach still counts in-person calls only (0301).
    const list = src.slice(0, src.indexOf("export async function readPitchRecordingDetail"));
    expect(list).toMatch(/\.in\(\s*"channel",\s*\[\.\.\.contextsOf\("sales_coach"\)\]/);
  });
});
