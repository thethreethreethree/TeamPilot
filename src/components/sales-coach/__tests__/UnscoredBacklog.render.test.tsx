// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

import { UnscoredBacklog, REFUSAL_LABEL } from "../UnscoredBacklog";

/**
 * The panel that tells a manager why their dashboards are empty, and drains the backlog.
 *
 * What these pin are the four ways a panel in front of a paid operation goes quietly wrong:
 *
 *   · a failed count rendered as "0 unscored", which reads as "nothing to do" about a number
 *     nobody managed to read
 *   · a loop that keeps POSTing — each pass an LLM bill — because it watches `remaining`, which
 *     never reaches zero when some recordings can never be scored
 *   · a run that stops early and says nothing, so "guidance is off for this account" arrives as
 *     a silent 0
 *   · a permanent "0 unscored" panel, which is furniture people learn not to read
 */

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

const count = (unscored: number, unscorable = 0) => ({ ok: true, json: async () => ({ unscored, unscorable }) });

/**
 * GET first, then one response per POST. The count FOLLOWS the run, as the real route does: after a pass
 * the next GET answers with that pass's `remaining` (the panel recounts when a run ends, 2026-10-01).
 */
const serve = (unscored: number, ...posts: Array<Record<string, unknown>>) => {
  let now = unscored;
  fetchMock.mockImplementation(async (_url: unknown, init?: { method?: string }) => {
    if (init?.method !== "POST") return count(now);
    const next = posts.shift() ?? { scored: 0, remaining: 0, refused: {}, more: false, note: null };
    if (typeof next.remaining === "number") now = next.remaining;
    return { ok: true, json: async () => next };
  });
};

describe("the count", () => {
  it("names the number before anything is spent", async () => {
    serve(142);
    render(<UnscoredBacklog />);
    expect(await screen.findByText(/142 recordings have never been scored/i)).toBeTruthy();
  });

  it("says a pitch appears on NO dashboard until it is scored", async () => {
    // The consequence is the reason a manager should care. "142 unscored" alone is trivia.
    serve(142);
    render(<UnscoredBacklog />);
    expect(await screen.findByText(/appears on no dashboard/i)).toBeTruthy();
  });

  it("does not claim an empty backlog when the count could not be read", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    render(<UnscoredBacklog />);
    expect(await screen.findByText(/could not be read/i)).toBeTruthy();
    // "0 recordings unscored" here would be the confident-zero the whole feature exists to remove.
    expect(screen.queryByRole("button", { name: /score them all/i })).toBeNull();
  });

  it("renders nothing at all when there is nothing waiting", async () => {
    serve(0);
    const { container } = render(<UnscoredBacklog />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // A panel that always says zero is furniture.
    expect(container.textContent).toBe("");
  });
});

describe("the drain", () => {
  it("keeps going while the server says there is more", async () => {
    serve(
      16,
      { scored: 8, remaining: 8, refused: {}, more: true, note: null },
      { scored: 8, remaining: 0, refused: {}, more: false, note: null }
    );
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    await waitFor(() => expect(screen.getByText(/Every recording has been scored/i)).toBeTruthy());
    expect(await screen.findByText(/16 scored just now/i)).toBeTruthy();
  });

  it("STOPS when a pass scores nothing, even with recordings left", async () => {
    // The loop watches `more`, not `remaining`. Recordings with no rep speech stay candidates
    // forever — there is no attempted-at column — so watching `remaining` would POST until the
    // tab closed, paying for every pass.
    serve(3, {
      scored: 0,
      remaining: 3,
      refused: { no_agent_turns: 3 },
      more: false,
      note: "Nothing in this batch could be scored.",
    });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    await waitFor(() => expect(screen.getByText(/3 have no rep speech to grade/i)).toBeTruthy());
    const posts = fetchMock.mock.calls.filter((c) => (c[1] as { method?: string })?.method === "POST");
    expect(posts).toHaveLength(1);
  });

  it("says out loud why nothing was scored, instead of showing a silent zero", async () => {
    serve(50, {
      scored: 0,
      remaining: 50,
      refused: { suppressed: 1 },
      more: false,
      note: "AI guidance is off for this account, so pitches are not scored yet. Nothing more can be scored until that changes.",
    });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    expect(await screen.findByText(/guidance is off for this account/i)).toBeTruthy();
  });

  it("does not lose what it already scored when a pass fails", async () => {
    let call = 0;
    fetchMock.mockImplementation(async (_u: unknown, init?: { method?: string }) => {
      // The count follows what was scored, as the real route does: 20 before, 12 after the first pass.
      if (init?.method !== "POST") return count(call >= 1 ? 12 : 20);
      call += 1;
      if (call === 1) {
        return { ok: true, json: async () => ({ scored: 8, remaining: 12, refused: {}, more: true, note: null }) };
      }
      return { ok: false, json: async () => ({}) };
    });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    expect(await screen.findByText(/Nothing already scored is lost/i)).toBeTruthy();
    // The eight that landed are real and stay counted.
    expect(screen.getByText(/12 recordings have never been scored/i)).toBeTruthy();
  });
});

/**
 * "I PRESSED SCORE THEM ALL AND NOTHING HAPPENED." — 2026-09-25, the founder, several times.
 *
 * Every one of these is a run that SUCCEEDS. No throw, no non-2xx, no refusal to report. The
 * defect was that a successful finish set the message to `body.note`, which the route leaves null
 * on every ordinary completion — so the last act of a working run was to blank the only element
 * that could have said it worked. Disabled button returns to normal, no text appears, and a
 * finished pass is pixel-identical to a button that is not wired to anything.
 */
describe("a run that finishes must never finish in silence", () => {
  it("says what it did when the server sends no note", async () => {
    serve(16, { scored: 8, remaining: 8, refused: {}, more: true, note: null, nextOffset: 0 });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    // Second POST falls through to the default: scored 0, remaining 0, more false, note NULL.
    expect(await screen.findByText(/Done — 8 recordings scored/i)).toBeTruthy();
  });

  it("says so when it scored nothing and the server gave no reason", async () => {
    serve(4, { scored: 0, remaining: 4, refused: {}, more: false, note: null, nextOffset: 4 });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    const el = await screen.findByText(/nothing was scored/i);
    // And it names ITSELF as the defect rather than blaming the recordings, because a refusal
    // with no reason attached is the server failing to answer, not an unscorable pitch.
    expect(el.textContent).toMatch(/gave no reason.*defect/i);
  });

  it("does not vanish at zero once a run has happened, taking its own answer with it", async () => {
    // The panel hides itself at 0 so it is not furniture. But hiding DURING the press is how a
    // completed drain disappears before it can report — the press then looks like it did nothing.
    serve(0);
    const { rerender } = render(<UnscoredBacklog />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/never been scored/i)).toBeNull(); // still furniture-free at rest
    rerender(<UnscoredBacklog />);
  });
});

describe("the rate limit the drain outruns", () => {
  it("waits out a 429 and carries on instead of calling it an error", async () => {
    let call = 0;
    fetchMock.mockImplementation(async (_u: unknown, init?: { method?: string }) => {
      if (init?.method !== "POST") return count(16);
      call += 1;
      if (call === 2) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => "1" },
          json: async () => ({ error: "Rate limit exceeded for pitch-score-backfill." }),
        };
      }
      if (call === 1) {
        return { ok: true, status: 200, headers: { get: () => null },
          json: async () => ({ scored: 8, remaining: 8, refused: {}, more: true, note: null, nextOffset: 0 }) };
      }
      return { ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ scored: 8, remaining: 0, refused: {}, more: false, note: null, nextOffset: 0 }) };
    });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    // 16 scored across the throttle, NOT "scoring stopped" at 8.
    expect(await screen.findByText(/Done — 16 recordings scored/i, undefined, { timeout: 6000 })).toBeTruthy();
    expect(screen.queryByText(/Scoring stopped/i)).toBeNull();
  });
});

/**
 * 2026-09-30. Labels render as `{n} {label}`. Four were written as if the count came after them, so the
 * panel printed "194 failed unexpectedly for" through the whole out-of-credit outage.
 */
describe("every refusal reads as a sentence with the count first", () => {
  it("no label is left dangling on a preposition", () => {
    for (const [reason, label] of Object.entries(REFUSAL_LABEL)) {
      expect(label, reason).not.toMatch(/\b(for|of|to|with)[,]?$/i);
      expect(label, reason).not.toMatch(/^the\b/i); // "10 the scorer returned nothing" is the old shape
    }
  });

  it("says a failed save was graded and is our fault", async () => {
    serve(10, { scored: 0, remaining: 10, refused: { store_failed: 2 }, more: false, note: "stopped" });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    await waitFor(() =>
      expect(screen.getByText(/2 were graded but could not be saved \(a fault on our side\)/i)).toBeTruthy()
    );
  });
});

/**
 * 2026-10-01, from production: one company's whole remaining backlog (92 recordings) had no rep speech, so
 * the panel offered "Score them all" for recordings the scorer refuses every time. The count route now
 * splits them out (`unscorable`), and the panel tells them without offering the button.
 */
describe("recordings with no rep speech", () => {
  it("are told, but never offered a button that cannot score them", async () => {
    fetchMock.mockImplementation(async () => count(0, 92));
    const { container } = render(<UnscoredBacklog />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Nothing a press could score: no panel at all, as with an empty backlog.
    expect(container.textContent).toBe("");
  });

  it("are named beside a real backlog", async () => {
    fetchMock.mockImplementation(async () => count(95, 101));
    render(<UnscoredBacklog />);
    expect(await screen.findByText(/95 recordings have never been scored/i)).toBeTruthy();
    expect(screen.getByText(/101 more have no rep speech, so they can't be scored/i)).toBeTruthy();
  });

  it("after a run that leaves only those, says everything scorable is done", async () => {
    let ran = false;
    fetchMock.mockImplementation(async (_u: unknown, init?: { method?: string }) => {
      if (init?.method !== "POST") return ran ? count(0, 3) : count(2, 3);
      ran = true;
      return { ok: true, json: async () => ({ scored: 2, remaining: 3, refused: { no_agent_turns: 3 }, more: false, note: null }) };
    });
    render(<UnscoredBacklog />);
    fireEvent.click(await screen.findByRole("button", { name: /score them all/i }));
    expect(await screen.findByText(/Everything that can be scored has been/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /score them all/i })).toBeNull();
  });
});
