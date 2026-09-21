// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DisputeQueue } from "../DisputeQueue";

/**
 * The manager's half of a dispute.
 *
 * The state that matters most is the one that looks harmless: a FAILED read rendering as "no
 * open disputes". A manager acts on that by closing the tab, which is the worst possible response
 * to a queue that is full and merely unreadable — and it is the same shape as the empty-AI
 * outages this codebase has already paid for twice.
 */

const OPEN = {
  id: "d1",
  pitchId: "11111111-1111-4111-8111-111111111111",
  sessionId: "s1",
  repId: "rep1",
  actorId: "rep1",
  itemId: "deliv.tone",
  itemLabel: "Tone and certainty",
  timestampS: 200,
  note: "I was confident the whole way through.",
  filedAt: "2026-09-20T10:00:00.000Z",
  open: true,
  answer: null,
};

const ANSWERED = {
  ...OPEN,
  id: "d2",
  open: false,
  answer: { note: "Listened back — the grade stands.", actorId: "mgr1", answeredAt: "2026-09-20T11:00:00.000Z" },
};

const fetchMock = vi.fn();
const respond = (...rs: { ok: boolean; body?: unknown }[]) => {
  for (const r of rs) {
    fetchMock.mockImplementationOnce(async () => ({ ok: r.ok, json: async () => r.body ?? {} }));
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("empty and failed are different", () => {
  it("says there are none when there are none", async () => {
    respond({ ok: true, body: { disputes: [] } });
    render(<DisputeQueue />);
    expect(await screen.findByText(/No open disputes/i)).toBeTruthy();
  });

  it("does NOT say there are none when the read failed", async () => {
    respond({ ok: false });
    render(<DisputeQueue />);
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
    expect(screen.queryByText(/No open disputes/i)).toBeNull();
    // And it says so explicitly, because the manager's instinct is to read silence as "none".
    expect(screen.getByText(/do not\s+assume it is empty/i)).toBeTruthy();
  });

  it("offers a retry on failure", async () => {
    respond({ ok: false });
    render(<DisputeQueue />);
    expect(await screen.findByRole("button", { name: /Try again/i })).toBeTruthy();
  });
});

describe("the queue", () => {
  it("shows who disputed what, and when in the recording", async () => {
    respond({ ok: true, body: { disputes: [OPEN] } });
    render(<DisputeQueue repName={() => "Anthony"} />);
    expect(await screen.findByText(/Anthony disputed/)).toBeTruthy();
    expect(screen.getByText("Tone and certainty")).toBeTruthy();
    expect(screen.getByText(/at 3:20/)).toBeTruthy();
    expect(screen.getByText(/confident the whole way through/)).toBeTruthy();
  });

  it("counts the open ones in the header", async () => {
    respond({ ok: true, body: { disputes: [OPEN, { ...OPEN, id: "d3" }] } });
    render(<DisputeQueue />);
    expect(await screen.findByText("2 open")).toBeTruthy();
  });

  it("names a dispute filed by someone other than the rep", async () => {
    // Otherwise the manager has the wrong conversation with the wrong person.
    respond({ ok: true, body: { disputes: [{ ...OPEN, actorId: "mgr2" }] } });
    render(<DisputeQueue />);
    expect(await screen.findByText(/Filed by someone other than the rep/i)).toBeTruthy();
  });

  it("shows a whole-score dispute as such", async () => {
    respond({ ok: true, body: { disputes: [{ ...OPEN, itemId: null, itemLabel: null }] } });
    render(<DisputeQueue />);
    expect(await screen.findByText(/the whole score/)).toBeTruthy();
  });

  it("shows the answer instead of a reply box once answered", async () => {
    respond({ ok: true, body: { disputes: [ANSWERED] } });
    render(<DisputeQueue />);
    expect(await screen.findByText(/the grade stands/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Reply$/ })).toBeNull();
  });
});

describe("replying", () => {
  const openOne = async () => {
    respond({ ok: true, body: { disputes: [OPEN] } });
    render(<DisputeQueue />);
    await screen.findByText(/disputed/);
  };

  it("states that a reply does not change the score", async () => {
    // A manager who assumes otherwise replies and believes the rep's number changed.
    await openOne();
    expect(screen.getByText(/does not change the score/i)).toBeTruthy();
    expect(screen.getByText(/Re-score the pitch if the grade was wrong/i)).toBeTruthy();
  });

  it("will not send an empty reply", async () => {
    await openOne();
    expect((screen.getByRole("button", { name: /^Reply$/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reloads the queue after a saved reply", async () => {
    await openOne();
    respond({ ok: true, body: { ok: true } }, { ok: true, body: { disputes: [] } });
    fireEvent.change(screen.getByLabelText(/Reply to this dispute/i), {
      target: { value: "Listened back, you are right" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Reply$/ }));
    expect(await screen.findByText(/No open disputes/i)).toBeTruthy();
  });

  it("says nothing was recorded when the reply failed, and keeps the box", async () => {
    await openOne();
    respond({ ok: false, body: { error: "not saved" } });
    fireEvent.change(screen.getByLabelText(/Reply to this dispute/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reply$/ }));
    await waitFor(() => expect(screen.getByText(/Nothing was recorded/i)).toBeTruthy());
    // The dispute must still be there — a silently-vanished card would read as handled.
    expect(screen.getByText(/disputed/)).toBeTruthy();
  });

  it("sends the item id so the reply closes THAT thread, not the whole score", async () => {
    await openOne();
    respond({ ok: true, body: { ok: true } }, { ok: true, body: { disputes: [] } });
    fireEvent.change(screen.getByLabelText(/Reply to this dispute/i), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reply$/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const body = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(body).toMatchObject({ itemId: "deliv.tone", pitchId: OPEN.pitchId });
  });
});
