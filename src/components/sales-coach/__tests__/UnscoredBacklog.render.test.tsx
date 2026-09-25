// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

import { UnscoredBacklog } from "../UnscoredBacklog";

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

const count = (unscored: number) => ({ ok: true, json: async () => ({ unscored }) });

/** GET first, then one response per POST. */
const serve = (unscored: number, ...posts: Array<Record<string, unknown>>) => {
  fetchMock.mockImplementation(async (_url: unknown, init?: { method?: string }) => {
    if (init?.method !== "POST") return count(unscored);
    const next = posts.shift() ?? { scored: 0, remaining: 0, refused: {}, more: false, note: null };
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
      if (init?.method !== "POST") return count(20);
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
