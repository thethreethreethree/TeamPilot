// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";

/**
 * The bell, which is no longer the manager's bell.
 *
 * It began as manager-only (gamification Phase 4) and now also carries `pitch_score_corrected` to
 * the REP whose score a manager changed. That makes three things worth pinning:
 *
 *   1. The correction alert is addressed to the rep, in the second person. Every other alert here
 *      is a manager reading about somebody else, and reusing that voice would produce "A rep made
 *      a correction" to the person it happened to.
 *   2. A lost qualification is SAID. An override can cross the 40-base line downward, and a rep
 *      must not learn their pitch stopped counting from a leaderboard they quietly fell off.
 *   3. It links to the session page, where the corrections section actually renders — not to the
 *      Door Log's report card, which takes a different id and merely shares the word "pitch".
 */

vi.mock("@/lib/supabase/client", () => ({
  supabaseEnabled: true,
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "../NotificationBell";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/** Records what the bell subscribes to, so the event filter can be asserted rather than assumed. */
let subscribedTo: Record<string, unknown> | null = null;
const mockRealtime = () => {
  subscribedTo = null;
  const channel: Record<string, unknown> = {};
  channel.on = (_evt: string, cfg: Record<string, unknown>) => {
    subscribedTo = cfg;
    return channel;
  };
  channel.subscribe = () => channel;
  asMock(createClient).mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
    channel: () => channel,
    removeChannel: () => {},
  });
};

const CORRECTION = {
  id: "n1",
  agent_id: "rep1",
  session_id: "sess-9",
  type: "pitch_score_corrected" as const,
  payload: { item_label: "Options close", total: 72.5, qualifying: true },
  created_at: new Date().toISOString(),
  read_at: null,
};

const STRONG = {
  id: "n2",
  agent_id: "rep2",
  session_id: "sess-2",
  type: "strong_session" as const,
  payload: { agent_name: "Ada Vance", total: 91 },
  created_at: new Date().toISOString(),
  read_at: null,
};

const fetchMock = vi.fn();
const respond = (notifications: unknown[], unread = notifications.length) =>
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ notifications, unread }),
  }));

/** Open the dropdown — the list only renders once the bell is clicked. */
const openBell = async () => {
  const bell = await screen.findByRole("button");
  fireEvent.click(bell);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mockRealtime();
});
afterEach(cleanup);

describe("a correction speaks to the rep it happened to", () => {
  it("is written in the second person, not about a third party", async () => {
    respond([CORRECTION]);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/A manager made a correction to Options close/i)).toBeTruthy();
    // The manager-voice fallback would have produced "A rep …" for the person it happened to.
    expect(screen.queryByText(/^A rep/)).toBeNull();
  });

  it("gives the new score in the alert itself", async () => {
    respond([CORRECTION]);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/your score is now 72.5/i)).toBeTruthy();
  });

  it("says when the pitch no longer counts", async () => {
    // The worst way to find this out is from a leaderboard you have quietly fallen off.
    respond([{ ...CORRECTION, payload: { ...CORRECTION.payload, qualifying: false } }]);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/no longer counts/i)).toBeTruthy();
  });

  it("stays silent about counting when the pitch still counts", async () => {
    respond([CORRECTION]);
    render(<NotificationBell />);
    await openBell();
    expect(screen.queryByText(/no longer counts/i)).toBeNull();
  });

  it("still renders when the payload is missing its detail", async () => {
    // A row written by an older build, or a payload that lost a key. An alert that says nothing is
    // better than one that throws and takes the whole dropdown with it.
    respond([{ ...CORRECTION, payload: {} }]);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/A manager made a correction/i)).toBeTruthy();
  });
});

describe("the link goes where the correction actually renders", () => {
  it("sends a correction to the session page, not the door log report card", async () => {
    respond([CORRECTION]);
    const { container } = render(<NotificationBell />);
    await openBell();
    await screen.findByText(/A manager made a correction/i);
    const href = container.querySelector("a")?.getAttribute("href");
    // PitchScorePanel — and the corrections section — render on /dashboard/sales-coach/[id].
    expect(href).toBe("/dashboard/sales-coach/sess-9");
    expect(href).not.toContain("report-card");
    expect(href).not.toContain("after-pitch");
  });

  it("still sends a manager alert to the debrief", async () => {
    respond([STRONG]);
    const { container } = render(<NotificationBell />);
    await openBell();
    await screen.findByText(/ran a strong session/i);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/dashboard/sales-coach/sess-2/after-pitch"
    );
  });
});

describe("the manager alerts it already carried still work", () => {
  it("renders a strong session in the third person", async () => {
    respond([STRONG]);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/Ada Vance ran a strong session — 91 points/i)).toBeTruthy();
  });

  it("renders a deal with its value", async () => {
    respond([
      { ...STRONG, id: "n3", type: "deal_closed" as const, payload: { agent_name: "Bo Iqbal", deal_value: 1200 } },
    ]);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/Bo Iqbal closed a deal \(\$1,200\)/i)).toBeTruthy();
  });

  it("shows both kinds in one list without either breaking the other", async () => {
    respond([CORRECTION, STRONG]);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/A manager made a correction/i)).toBeTruthy();
    expect(screen.getByText(/ran a strong session/i)).toBeTruthy();
  });
});

describe("empty is said, not implied", () => {
  it("says there are none when there are none", async () => {
    respond([], 0);
    render(<NotificationBell />);
    await openBell();
    expect(await screen.findByText(/No notifications yet/i)).toBeTruthy();
  });

  it("keeps the last state when a later read fails, rather than blanking", async () => {
    // A transient failure must not wipe alerts the rep has already been shown. The re-read has to
    // come from the POLL: clicking the bell only toggles the dropdown, so an earlier version of
    // this test never re-fetched at all and passed against a component that blanked on failure.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      respond([CORRECTION]);
      render(<NotificationBell />);
      await openBell();
      await screen.findByText(/A manager made a correction/i);

      fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000);
      });

      expect(screen.getByText(/A manager made a correction/i)).toBeTruthy();
      expect(screen.queryByText(/No notifications yet/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the realtime subscription covers a refreshed alert", () => {
  it("listens for every change, not only INSERT", async () => {
    // Every notification in this table used to be an insert. The correction notice is an UPSERT:
    // a SECOND correction on one pitch UPDATES the existing row. Under an INSERT-only
    // subscription the first correction arrives instantly and every one after it waits for the
    // 60s poll — the confusing way round, and invisible unless the filter itself is asserted.
    respond([CORRECTION]);
    render(<NotificationBell />);
    await screen.findByRole("button");
    await waitFor(() => expect(subscribedTo).not.toBeNull());

    expect(subscribedTo).toMatchObject({
      event: "*",
      schema: "public",
      table: "manager_notifications",
    });
    // Still scoped to this subscriber: RLS enforces it per-subscriber, and the filter is what
    // stops the client asking for rows it would not be given.
    expect(String(subscribedTo!.filter)).toBe("recipient_id=eq.me");
  });
});
