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

  it("states that a reply on its own does not change the score", async () => {
    // A manager who assumes otherwise replies and believes the rep's number changed.
    //
    // UPDATED 2026-09-21. This assertion previously also required "Re-score the pitch if the grade
    // was wrong", which was the right instruction when the card could not correct anything. It can
    // now, so that sentence would send a manager away from the control sitting directly above it.
    // The half that still matters — replying ALONE is score-neutral — is what is asserted.
    await openOne();
    expect(screen.getByText(/Replying on its own does not change the score/i)).toBeTruthy();
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

describe("correcting the score from the queue", () => {
  /**
   * The founder's 2026-09-21 decision, and the rubric's p.7 note, made this card able to move a
   * number. Every test here is about a way that power could misfire in the manager's hands:
   * offered where it cannot work, fired without a reason, or reported wrongly afterwards.
   */
  // `| null` on every field, because a whole-score dispute genuinely carries null itemId/itemLabel
  // and the fixture's inferred types would otherwise forbid the case most worth testing.
  const openOne = async (over: Partial<{ [K in keyof typeof OPEN]: (typeof OPEN)[K] | null }> = {}) => {
    respond({ ok: true, body: { disputes: [{ ...OPEN, ...over }] } });
    render(<DisputeQueue />);
    await screen.findByText(/disputed/);
  };

  const typeNote = (text: string) =>
    fireEvent.change(screen.getByLabelText(/Reply to this dispute/i), { target: { value: text } });

  const correctBtn = () => screen.getByRole("button", { name: /Correct and reply/i }) as HTMLButtonElement;

  it("offers the grades for an element, in the rubric's own vocabulary", async () => {
    await openOne();
    const select = screen.getByLabelText(/correct it/i) as HTMLSelectElement;
    const options = [...select.options].map((o) => o.textContent);
    expect(options).toEqual(["Leave as scored", "Hit", "Partial", "Missed"]);
  });

  it("offers award/take-back for a bonus instead of grades", async () => {
    // Asked of the rubric, not parsed from the id's prefix — a bonus cannot be graded "Partial".
    await openOne({ itemId: "bonus.directv", itemLabel: "Gets inside the house or backyard" });
    const select = screen.getByLabelText(/correct it/i) as HTMLSelectElement;
    const options = [...select.options].map((o) => o.textContent);
    expect(options).toEqual(["Leave as scored", "Award it", "Take it back"]);
  });

  it("offers nothing to correct on a whole-score dispute, but still allows a reply", async () => {
    await openOne({ itemId: null, itemLabel: null });
    expect(screen.queryByLabelText(/correct it/i)).toBeNull();
    // Not a dead end: the manager can still answer.
    expect(screen.getByLabelText(/Reply to this dispute/i)).toBeTruthy();
  });

  it("offers nothing when the current rubric no longer knows the item", async () => {
    // A retired element cannot be re-graded under a rubric that does not contain it, and the
    // server would refuse it anyway. Better to not offer than to offer and fail.
    await openOne({ itemId: "retired.element", itemLabel: "Something from an old rubric" });
    expect(screen.queryByLabelText(/correct it/i)).toBeNull();
  });

  it("will not correct without a reason", async () => {
    await openOne();
    fireEvent.change(screen.getByLabelText(/correct it/i), { target: { value: "hit" } });
    expect(correctBtn().disabled).toBe(true);
  });

  it("will not correct without a new value", async () => {
    await openOne();
    typeNote("You are right, I listened again.");
    expect(correctBtn().disabled).toBe(true);
  });

  it("sends the correction with the note as the reason, and the kind the rubric gave", async () => {
    await openOne();
    respond({ ok: true, body: { total: 70 } }, { ok: true, body: { ok: true } }, { ok: true, body: { disputes: [] } });
    typeNote("Listened back at 3:20 — that was certain.");
    fireEvent.change(screen.getByLabelText(/correct it/i), { target: { value: "hit" } });
    fireEvent.click(correctBtn());

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toContain("/pitch-score/override");
    expect(JSON.parse(init.body as string)).toMatchObject({
      pitchId: OPEN.pitchId,
      itemType: "element",
      itemId: "deliv.tone",
      newValue: "hit",
      reason: "Listened back at 3:20 — that was certain.",
    });
  });

  it("sends the kind the rubric gave, not a fixed one", async () => {
    // A bonus sent as itemType "element" is refused by the route (unknown_item), so this fails
    // loudly rather than silently — but it fails for every bonus dispute a manager tries to
    // resolve, which is the commonest override the rubric actually specifies.
    await openOne({ itemId: "bonus.directv", itemLabel: "Gets inside the house or backyard" });
    respond({ ok: true, body: {} }, { ok: true, body: { ok: true } }, { ok: true, body: { disputes: [] } });
    typeNote("They did get inside at 6:10.");
    fireEvent.change(screen.getByLabelText(/correct it/i), { target: { value: "awarded" } });
    fireEvent.click(correctBtn());

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      itemType: "bonus",
      itemId: "bonus.directv",
      newValue: "awarded",
    });
  });

  it("corrects BEFORE it replies, so a failed correction never leaves a reply claiming otherwise", async () => {
    await openOne();
    respond({ ok: true, body: {} }, { ok: true, body: { ok: true } }, { ok: true, body: { disputes: [] } });
    typeNote("ok");
    fireEvent.change(screen.getByLabelText(/correct it/i), { target: { value: "hit" } });
    fireEvent.click(correctBtn());

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/override");
    expect(String(fetchMock.mock.calls[2]![0])).toContain("/disputes");
  });

  it("does not reply at all when the correction failed", async () => {
    await openOne();
    respond({ ok: false, body: { error: "nope" } });
    typeNote("ok");
    fireEvent.change(screen.getByLabelText(/correct it/i), { target: { value: "hit" } });
    fireEvent.click(correctBtn());

    await waitFor(() => expect(screen.getByText(/Nothing was recorded/i)).toBeTruthy());
    // Exactly two calls: the initial load and the failed override. No answer was filed.
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("does not report a landed correction as a failure when only the reply failed", async () => {
    // The score really did move and the rep will read the reason on their own pitch. Saying "that
    // didn't save" would invite a second correction on a score that is already right.
    await openOne();
    respond({ ok: true, body: {} }, { ok: false, body: { error: "reply died" } });
    typeNote("ok");
    fireEvent.change(screen.getByLabelText(/correct it/i), { target: { value: "hit" } });
    fireEvent.click(correctBtn());

    await waitFor(() => expect(screen.getByText(/score was corrected/i)).toBeTruthy());
    expect(screen.getByText(/don't correct it again/i)).toBeTruthy();
    expect(screen.queryByText(/Nothing was recorded/i)).toBeNull();
  });

  it("warns that the note is what the rep will read", async () => {
    await openOne();
    expect(screen.getByText(/becomes the reason/i)).toBeTruthy();
    expect(screen.getByText(/Logged and\s+permanent/i)).toBeTruthy();
  });
});
