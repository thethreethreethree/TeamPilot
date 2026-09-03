// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

/**
 * NotificationBell — realtime wiring (founder 2026-09-04). Locks that the bell subscribes to THIS manager's own
 * manager_notifications INSERTs (RLS + an explicit recipient filter) and re-fetches on each event, with the poll
 * as the backstop. The Supabase browser client is faked; the fetch is stubbed.
 */
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

const captured = vi.hoisted(() => ({
  channelName: "",
  onArgs: null as null | { event: string; schema: string; table: string; filter: string },
  onHandler: null as null | ((payload: unknown) => void),
  removed: false,
}));

vi.mock("@/lib/supabase/client", () => ({
  supabaseEnabled: true,
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "mgr-1" } } }) },
    channel: (name: string) => {
      captured.channelName = name;
      const chan: Record<string, unknown> = {};
      chan.on = (_evt: string, cfg: typeof captured.onArgs, handler: (p: unknown) => void) => {
        captured.onArgs = cfg;
        captured.onHandler = handler;
        return chan;
      };
      chan.subscribe = () => chan;
      return chan;
    },
    removeChannel: () => {
      captured.removed = true;
    },
  }),
}));

import { NotificationBell } from "../NotificationBell";

let fetchCount = 0;
beforeEach(() => {
  fetchCount = 0;
  captured.channelName = "";
  captured.onArgs = null;
  captured.onHandler = null;
  captured.removed = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      fetchCount += 1;
      return Promise.resolve({ ok: true, json: async () => ({ notifications: [], unread: 0 }) });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NotificationBell — realtime", () => {
  it("subscribes to this manager's own notification INSERTs with an explicit recipient filter", async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(captured.onArgs).not.toBeNull());
    expect(captured.channelName).toBe("manager-notifs:mgr-1");
    expect(captured.onArgs).toMatchObject({
      event: "INSERT",
      schema: "public",
      table: "manager_notifications",
      filter: "recipient_id=eq.mgr-1",
    });
  });

  it("re-fetches when a realtime INSERT arrives", async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(captured.onHandler).not.toBeNull());
    const before = fetchCount; // the initial load already fired
    captured.onHandler!({ new: { id: "n1" } });
    await waitFor(() => expect(fetchCount).toBe(before + 1));
  });

  it("tears down the channel on unmount", async () => {
    const { unmount } = render(<NotificationBell />);
    await waitFor(() => expect(captured.onHandler).not.toBeNull());
    unmount();
    expect(captured.removed).toBe(true);
  });

  it("still renders the bell and its unread badge from the fetched state", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => ({ notifications: [], unread: 3 }) }),
    );
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByLabelText(/3 unread/i)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/Notifications/i));
    expect(screen.getByText(/No notifications yet/i)).toBeTruthy();
  });
});
