// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { PitchScorePanel } from "../PitchScorePanel";

/**
 * The panel exists to keep five states apart. Collapsing them is the defect.
 *
 * generatePitchScore returns a discriminated union instead of a zero score specifically so that
 * "your recording has no rep speech" (the rep can fix it) never looks like "our scorer broke"
 * (they cannot) and neither looks like "scored 0". A single "Something went wrong" box in this
 * component would throw all of that away at the last step.
 */

const SCORED = {
  id: "p1",
  repId: "rep1",
  sessionId: "sess1",
  recordedAt: "2026-09-18T16:12:00.000Z",
  durationS: 660,
  audioUrl: null,
  outcome: "sold",
  base: 62.4,
  bonus: 20,
  violations: 2,
  total: 80.4,
  band: "Strong",
  qualifying: true,
  notQualifyingReason: null,
  deliveryScaled: false,
  rubricVersion: "attfiber-v1",
  sectionPoints: [{ id: "introduction", label: "Introduction", points: 9.5, maxPoints: 12 }],
  elements: [],
  events: [],
  disputes: [],
};

const fetchMock = vi.fn();

/**
 * The queue of PANEL responses, answered in order.
 *
 * ROUTED BY URL RATHER THAN BY CALL ORDER, since 2026-09-22. `PitchDetail` now renders
 * `ManagerComments`, which reads `pitch-recordings` to show a comment a manager SENT to this rep
 * (guide Step 4 item 6). That is a real fetch from a real feature, and under the previous
 * strictly-ordered mock it silently ate the response queued for the panel's next call — so five
 * tests failed for a reason that had nothing to do with what they assert.
 *
 * A queue keyed on call ORDER couples every test here to the number of requests the whole subtree
 * happens to make. Keying on the URL couples them to the panel, which is what they are about.
 */
const queued: { ok: boolean; body?: unknown }[] = [];

const isRecordingsRead = (input: unknown) =>
  typeof input === "string" && input.includes("/pitch-recordings");

const respond = (...responses: { ok: boolean; body?: unknown }[]) => {
  queued.push(...responses);
};

/** Calls the panel itself made — the number these tests mean by "called N times". */
const panelCalls = () => fetchMock.mock.calls.filter((c) => !isRecordingsRead(c[0]));

beforeEach(() => {
  vi.clearAllMocks();
  queued.length = 0;
  fetchMock.mockImplementation(async (input: unknown) => {
    // ManagerComments: no comments, which is the normal state of a pitch and renders nothing.
    if (isRecordingsRead(input)) return { ok: true, json: async () => ({ moments: [] }) };
    const next = queued.shift();
    if (!next) return { ok: false, json: async () => ({}) };
    return { ok: next.ok, json: async () => next.body ?? {} };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("the five states stay distinct", () => {
  it("offers to score a pitch that has none", async () => {
    respond({ ok: true, body: { pitch: null } });
    render(<PitchScorePanel sessionId="s1" />);
    expect(await screen.findByRole("button", { name: /Score this pitch/i })).toBeTruthy();
  });

  it("shows the score once there is one", async () => {
    respond({ ok: true, body: { pitch: SCORED } });
    render(<PitchScorePanel sessionId="s1" />);
    expect(await screen.findByText("80.4")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Score this pitch/i })).toBeNull();
  });

  it("does NOT offer to score when the READ failed", async () => {
    // The dangerous conflation. "Not scored yet" here invites the rep to spend an LLM call
    // re-scoring a pitch that is already scored and merely unreadable.
    respond({ ok: false, body: {} });
    render(<PitchScorePanel sessionId="s1" />);
    expect(await screen.findByText(/Could not load this pitch's score/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Score this pitch/i })).toBeNull();
  });

  it("renders nothing at all for a session that is not scorable", () => {
    const { container } = render(<PitchScorePanel sessionId="s1" scorable={false} />);
    expect(container.textContent).toBe("");
    // And it does not even ask — a huddle must not cost a request.
    expect(screen.queryByText(/Pitch Score/)).toBeNull();
  });
});

describe("a failed scoring run says WHICH failure", () => {
  it("shows the route's own reason, not a generic message", async () => {
    respond(
      { ok: true, body: { pitch: null } },
      { ok: false, body: { error: "This recording has no rep speech to grade.", failure: "no_agent_turns" } }
    );
    render(<PitchScorePanel sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Score this pitch/i }));
    expect(await screen.findByText(/no rep speech to grade/i)).toBeTruthy();
  });

  it("offers no retry for a failure a retry cannot fix", async () => {
    // A recording with no rep speech will still have none on the second attempt. A Try again
    // button here spends another LLM call to show the same message.
    respond(
      { ok: true, body: { pitch: null } },
      { ok: false, body: { error: "This recording has no rep speech to grade.", failure: "no_agent_turns" } }
    );
    render(<PitchScorePanel sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Score this pitch/i }));
    await screen.findByText(/no rep speech/i);
    expect(screen.queryByRole("button", { name: /Try again/i })).toBeNull();
  });

  it("offers a retry for a failure that might clear", async () => {
    respond(
      { ok: true, body: { pitch: null } },
      { ok: false, body: { error: "The scorer returned nothing.", failure: "llm_empty" } }
    );
    render(<PitchScorePanel sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Score this pitch/i }));
    expect(await screen.findByRole("button", { name: /Try again/i })).toBeTruthy();
  });

  it("re-reads the score after a successful run rather than trusting the POST body", async () => {
    respond(
      { ok: true, body: { pitch: null } },
      { ok: true, body: { pitchId: "p1" } },
      { ok: true, body: { pitch: SCORED } }
    );
    render(<PitchScorePanel sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Score this pitch/i }));
    expect(await screen.findByText("80.4")).toBeTruthy();
    expect(panelCalls()).toHaveLength(3);
  });
});

describe("dispute", () => {
  const openDispute = async () => {
    respond({ ok: true, body: { pitch: SCORED } });
    render(<PitchScorePanel sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Dispute a score/i }));
  };

  it("says plainly that it does not change the score", async () => {
    // A rep who thinks complaining re-scores the pitch files more and trusts the number less.
    await openDispute();
    expect(screen.getByText(/does not change the score/i)).toBeTruthy();
  });

  it("will not send an empty note", async () => {
    await openDispute();
    expect((screen.getByRole("button", { name: /^Send$/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("confirms only on a real 200", async () => {
    await openDispute();
    respond({ ok: true, body: { ok: true } });
    fireEvent.change(screen.getByLabelText(/What was wrong/i), { target: { value: "No objection happened" } });
    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }));
    expect(await screen.findByText(/Sent\./i)).toBeTruthy();
  });

  it("says nothing was recorded when the send failed", async () => {
    // Telling a rep it was filed when it was not means they stop asking and the grade stands.
    await openDispute();
    respond({ ok: false, body: { error: "Your dispute was not sent." } });
    fireEvent.change(screen.getByLabelText(/What was wrong/i), { target: { value: "Wrong grade" } });
    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }));
    await waitFor(() => expect(screen.getByText(/Nothing was recorded/i)).toBeTruthy());
    expect(screen.queryByText(/^Sent\./)).toBeNull();
  });
});
