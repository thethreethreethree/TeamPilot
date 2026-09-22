// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, configure } from "@testing-library/react";

import RecordingsTab from "../RecordingsTab";
import { ManagerComments } from "../ManagerComments";

/**
 * Testing Library waits 1000ms by default. THIS FILE NEEDS MORE, and the reason is a measurement
 * rather than a guess.
 *
 * Every assertion here waits on TWO sequential fetches — the recordings list, then the detail for
 * the row the component auto-selects. Standalone the whole file runs in 1.97s. Inside the full
 * gate (706 files, a saturated worker pool) the "offers to ASK" case took **1061ms** to reach its
 * button and failed on the 1000ms budget: `Unable to find role="button" and name /Save as team
 * example/i`, with the DOM showing the list rendered and the detail pane still empty.
 *
 * A wait budget that only holds when the suite is quiet is not a budget. Raised to 4s, which
 * still sits under vitest's own 5s per-test timeout, so a genuinely hung render fails as a test
 * timeout rather than silently taking four seconds longer.
 */
configure({ asyncUtilTimeout: 4000 });

/**
 * The Recordings tab, guarded at the places where it could be quietly wrong.
 *
 * Rendering a list and a player is not what these pin. What they pin is the handful of states
 * this screen can get into that all LOOK fine:
 *
 *   · a failed read rendered as "no recordings", which tells a manager a rep has no history
 *   · a pitch excluded from the leaderboard shown with a score and no "Not counted"
 *   · eight flagged moments displayed as the three that happen to have timestamps
 *   · "Save as team example" offered as a switch rather than as a request to the rep
 *   · a comment the manager SENT not appearing anywhere the rep can read it
 */

const fetchMock = vi.fn();

const row = (over: Record<string, unknown> = {}) => ({
  pitchId: "p1",
  repId: "rep1",
  recordedAt: "2026-09-19T15:52:00.000Z",
  durationS: 480,
  outcome: "follow_up",
  total: 78.5,
  band: "Solid",
  qualifying: true,
  notQualifyingReason: null,
  patternMoments: 1,
  hasAudio: true,
  ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  pitchId: "p1",
  repId: "rep1",
  recordedAt: "2026-09-19T15:52:00.000Z",
  durationS: 480,
  audioUrl: null,
  total: 78.5,
  base: 62,
  bonus: 20,
  violations: 3.5,
  band: "Solid",
  outcome: "follow_up",
  moments: [],
  coverage: { total: 0, placeable: 0, unplaced: 0 },
  lines: [],
  linesApproximate: true,
  share: { shareable: false, status: "none", requestedAt: null, answeredAt: null, note: null },
  viewerId: "mgr1",
  ...over,
});

/** Routed by URL: the list and the detail are two different reads of the same endpoint. */
const serve = (opts: { list?: unknown; listOk?: boolean; detail?: unknown; detailOk?: boolean }) => {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    if (url.includes("pitchId=")) {
      return { ok: opts.detailOk ?? true, json: async () => opts.detail ?? detail() };
    }
    return {
      ok: opts.listOk ?? true,
      json: async () => opts.list ?? { rows: [row()], capped: false },
    };
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("a failed read is not an empty history", () => {
  it("says the read failed rather than 'no recordings yet'", async () => {
    // The two render almost identically and mean opposite things. One sends a manager to the rep
    // to ask why they have not pitched; the other sends them to reload.
    serve({ listOk: false });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
    expect(screen.queryByText(/No scored recordings yet/i)).toBeNull();
  });

  it("says 'no recordings yet' when the read succeeded and was empty", async () => {
    serve({ list: { rows: [], capped: false } });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText(/No scored recordings yet/i)).toBeTruthy();
  });
});

describe("the list", () => {
  it("labels a pitch that does not count, rather than hiding it", async () => {
    // The board shows the score AND "Not counted". Hiding the row would give a rep and a manager
    // two different pitch histories for the same week.
    serve({
      list: {
        rows: [row({ pitchId: "p2", total: 44, qualifying: false, notQualifyingReason: "base_under_40" })],
        capped: false,
      },
    });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText("Not counted")).toBeTruthy();
    expect(screen.getByText("44.0")).toBeTruthy();
  });

  it("counts pattern moments in the singular when there is one", async () => {
    serve({});
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText("1 pattern moment")).toBeTruthy();
  });

  it("says when a recording has no audio, instead of offering a dead play button", async () => {
    serve({ list: { rows: [row({ hasAudio: false })], capped: false }, detail: detail({ audioUrl: null }) });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText("No audio")).toBeTruthy();
  });
});

describe("key moments", () => {
  it("reports the moments it cannot place as well as the ones it can", async () => {
    // Eight flagged moments of which three are placeable is not three flagged moments. A strip
    // that shows three agrees with itself and disagrees with the pitch.
    serve({
      detail: detail({
        moments: [
          { id: "m1", kind: "missed", atSeconds: 12, label: "Trucks", detail: null, points: -3 },
          { id: "m2", kind: "missed", atSeconds: null, label: "Catches", detail: null, points: -6 },
        ],
        coverage: { total: 2, placeable: 1, unplaced: 1 },
      }),
    });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText(/1 of 2 moments have no timestamp/i)).toBeTruthy();
  });

  it("shows a violation's cost as a loss", async () => {
    serve({
      detail: detail({
        moments: [
          { id: "v1", kind: "violation", atSeconds: 312, label: "Talking over customer", detail: null, points: -2 },
        ],
        coverage: { total: 1, placeable: 1, unplaced: 0 },
      }),
    });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText("-2")).toBeTruthy();
  });
});

describe("'Save as team example' is a request, not a switch", () => {
  it("offers to ASK when nobody has been asked", async () => {
    serve({});
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByRole("button", { name: /Save as team example/i })).toBeTruthy();
  });

  it("does not offer the button at all while the rep has not answered", async () => {
    // A live button here would let a manager ask twice and read the second "pending" as a yes.
    serve({
      detail: detail({
        share: { shareable: false, status: "pending", requestedAt: "2026-09-20T10:00:00Z", answeredAt: null, note: null },
      }),
    });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText(/Waiting on the rep/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Save as team example/i })).toBeNull();
  });

  it("says 'ask again' after a decline, so a no is visibly a no", async () => {
    serve({
      detail: detail({
        share: {
          shareable: false,
          status: "declined",
          requestedAt: "2026-09-20T10:00:00Z",
          answeredAt: "2026-09-20T11:00:00Z",
          note: null,
        },
      }),
    });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByRole("button", { name: /Ask again/i })).toBeTruthy();
  });

  it("shows it as cleared only when the verdict says so", async () => {
    serve({
      detail: detail({
        share: {
          shareable: true,
          status: "granted",
          requestedAt: "2026-09-20T10:00:00Z",
          answeredAt: "2026-09-20T11:00:00Z",
          note: null,
        },
      }),
    });
    render(<RecordingsTab repId="rep1" isManager />);
    expect(await screen.findByText(/Cleared as a team example/i)).toBeTruthy();
  });
});

describe("a rep does not get the manager's controls", () => {
  it("shows no comment box and no team-example button", async () => {
    serve({});
    render(<RecordingsTab repId="rep1" isManager={false} />);
    await screen.findByRole("heading", { name: /Key moments/i });
    expect(screen.queryByPlaceholderText(/What should the rep hear here/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Save as team example/i })).toBeNull();
  });
});

describe("the rep's side of a sent comment", () => {
  it("renders a comment the manager sent", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        moments: [
          {
            id: "c1",
            kind: "comment",
            atSeconds: 442,
            label: "Comment · 9/18/2026",
            detail: "Slow down before the close.",
            points: null,
          },
        ],
      }),
    }));
    render(<ManagerComments pitchId="p1" />);
    expect(await screen.findByText("Slow down before the close.")).toBeTruthy();
    expect(screen.getByText(/At 7:22/)).toBeTruthy();
  });

  it("renders NOTHING when there are none, rather than an empty panel on every pitch", async () => {
    // An always-present "From your manager" heading trains a rep to stop looking at it.
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ moments: [] }) }));
    const { container } = render(<ManagerComments pitchId="p1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("stays silent when the read fails, rather than alarming a rep about the wrong thing", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    const { container } = render(<ManagerComments pitchId="p1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
