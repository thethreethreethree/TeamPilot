// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ReviewFlagQueue } from "../ReviewFlagQueue";
import { REVIEW_FLAG_IDS, REVIEW_ANSWER } from "@/lib/coach/assessment/reviewFlags";
import type { ReviewFlag } from "@/lib/coach/assessment/reviewFlags";

/**
 * The rubric's one escalated violation, on the manager's board.
 *
 * This card carries a −10 deduction made by an LLM about a person's manner, so what these pin is
 * the set of states where a correct-looking card would be a false statement:
 *
 *   · a failed read rendered as "no flags", which on this card reads as reassurance
 *   · a correction applied with no reason, which is indistinguishable from editing a disliked number
 *   · a flag a manager can dismiss without seeing what the scorer actually heard
 *   · a second write path to a table that already has one
 */

const fetchMock = vi.fn();
const onReviewed = vi.fn();

const flag = (over: Partial<ReviewFlag> = {}): ReviewFlag => ({
  pitchId: "p1",
  repId: "rep-1",
  repName: "Anthony A.",
  itemId: "viol.rude",
  label: "Rude, dismissive, or condescending to the customer",
  deduction: 10,
  recordedAt: "2026-09-17T16:00:00.000Z",
  evidence: "Cut the customer off and said they clearly weren't listening.",
  atSeconds: 312,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("a failed read is not an empty queue", () => {
  it("says the read failed when flags is null", () => {
    // The wrong one here tells a manager nobody has been rude this week.
    render(<ReviewFlagQueue flags={null} onReviewed={onReviewed} />);
    expect(screen.getByText(/could not be read/i)).toBeTruthy();
    expect(screen.getByText(/not a finding that there are none/i)).toBeTruthy();
  });

  it("says nothing is outstanding when the list is genuinely empty", () => {
    render(<ReviewFlagQueue flags={[]} onReviewed={onReviewed} />);
    expect(screen.getByText(/No rude-or-dismissive flags awaiting review/i)).toBeTruthy();
    expect(screen.queryByText(/could not be read/i)).toBeNull();
  });
});

describe("the row, as the board draws it", () => {
  it("names the rep, the rule, the date and the cost", () => {
    render(<ReviewFlagQueue flags={[flag()]} onReviewed={onReviewed} />);
    expect(screen.getByText(/Anthony A\. · Rude, dismissive/)).toBeTruthy();
    expect(screen.getByText(/−10 applied\. Confirm or remove\./)).toBeTruthy();
  });

  it("shows WHAT THE SCORER HEARD, not just the label", () => {
    // The rubric asks for a human judgement. A manager cannot make one from a category name, and
    // a card that offers Remove without evidence is asking for a rubber stamp.
    render(<ReviewFlagQueue flags={[flag()]} onReviewed={onReviewed} />);
    expect(screen.getByText(/weren't listening/)).toBeTruthy();
  });

  it("offers the moment in the recording when the scorer timed it", () => {
    render(<ReviewFlagQueue flags={[flag()]} onReviewed={onReviewed} />);
    expect(screen.getByText(/at 5:12/)).toBeTruthy();
  });

  it("omits the moment rather than inventing 0:00 when it is untimed", () => {
    render(<ReviewFlagQueue flags={[flag({ atSeconds: null })]} onReviewed={onReviewed} />);
    expect(screen.queryByText(/at 0:00/)).toBeNull();
  });
});

describe("a reason is required before anything is written", () => {
  it("Review opens the reason box and writes nothing yet", async () => {
    render(<ReviewFlagQueue flags={[flag()]} onReviewed={onReviewed} />);
    fireEvent.click(screen.getByRole("button", { name: /^Review$/ }));
    expect(await screen.findByPlaceholderText(/the rep reads this/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps both answers disabled until a reason is typed", () => {
    render(<ReviewFlagQueue flags={[flag()]} onReviewed={onReviewed} />);
    fireEvent.click(screen.getByRole("button", { name: /^Review$/ }));
    expect(screen.getByRole("button", { name: /Remove the flag/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Confirm it stands/i })).toHaveProperty("disabled", true);
  });

  it("tells the manager the rep will read the reason, before they write it", () => {
    render(<ReviewFlagQueue flags={[flag()]} onReviewed={onReviewed} />);
    fireEvent.click(screen.getByRole("button", { name: /^Review$/ }));
    expect(screen.getByText(/the rep can read them/i)).toBeTruthy();
  });
});

describe("the two answers", () => {
  const open = () => {
    render(<ReviewFlagQueue flags={[flag()]} onReviewed={onReviewed} />);
    fireEvent.click(screen.getByRole("button", { name: /^Review$/ }));
    fireEvent.change(screen.getByPlaceholderText(/the rep reads this/i), {
      target: { value: "Listened back — he cut in but was not rude." },
    });
  };

  it("Remove posts 'removed' to the EXISTING override route", async () => {
    // Not a second write path to a table that already has one (§2.2).
    open();
    fireEvent.click(screen.getByRole("button", { name: /Remove the flag/i }));
    await waitFor(() => {
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(String(url)).toBe("/api/coach/sales-session/pitch-score/override");
      expect(JSON.parse(String(init.body))).toMatchObject({
        pitchId: "p1",
        itemType: "violation",
        itemId: "viol.rude",
        newValue: "removed",
        reason: "Listened back — he cut in but was not rude.",
      });
    });
  });

  it("Confirm posts 'awarded' — a no-op to the score and a real entry in the log", async () => {
    // A flag that simply goes quiet tells the rep nothing. A confirmation tells them a human
    // listened and agreed, which is what makes the −10 survivable.
    open();
    fireEvent.click(screen.getByRole("button", { name: /Confirm it stands/i }));
    await waitFor(() => {
      const [, init] = fetchMock.mock.calls[0]!;
      expect(JSON.parse(String(init.body)).newValue).toBe("awarded");
    });
  });

  it("re-reads after either answer, because removing rescores the pitch", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Remove the flag/i }));
    await waitFor(() => expect(onReviewed).toHaveBeenCalled());
  });

  it("surfaces a refusal instead of pretending it worked", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({ error: "Managers only." }) }));
    open();
    fireEvent.click(screen.getByRole("button", { name: /Confirm it stands/i }));
    expect(await screen.findByText(/Managers only/)).toBeTruthy();
    expect(onReviewed).not.toHaveBeenCalled();
  });

  it("can be cancelled without writing anything", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Review$/ })).toBeTruthy();
  });
});

describe("the escalated set comes from the rubric", () => {
  it("contains the rude violation", () => {
    expect(REVIEW_FLAG_IDS.has("viol.rude")).toBe(true);
  });

  it("does NOT contain the four arithmetic violations", () => {
    // Only one violation in the rubric carries "flag for manager review". If a second gains it,
    // this queue must pick it up without anyone editing a constant — which is why the set is
    // derived rather than listed.
    for (const id of ["viol.talkingOver", "viol.talkingTooMuch", "viol.notEnoughQuestions", "viol.ignoringQuestion"]) {
      expect(REVIEW_FLAG_IDS.has(id), id).toBe(false);
    }
  });

  it("maps the two answers to the values the override route accepts", () => {
    expect(REVIEW_ANSWER).toEqual({ confirm: "awarded", remove: "removed" });
  });
});
