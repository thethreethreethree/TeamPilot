// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ShareRequestPrompt } from "../ShareRequestPrompt";

/**
 * The rep's side of "may the team hear this one?"
 *
 * What these pin is the difference between a permission and a formality:
 *
 *   · a panel that appears on pitches nobody asked about, training the rep to ignore it
 *   · a grant the rep cannot take back, which is a transfer rather than a consent
 *   · a client that decides for itself what the log now means instead of re-reading it
 *   · a "no" that looks like it costs something
 */

const fetchMock = vi.fn();

const SHARE = {
  none: { shareable: false, status: "none", requestedAt: null, answeredAt: null, note: null },
  pending: {
    shareable: false,
    status: "pending",
    requestedAt: "2026-09-20T10:00:00Z",
    answeredAt: null,
    note: "Great rebuttal at the door",
  },
  granted: {
    shareable: true,
    status: "granted",
    requestedAt: "2026-09-20T10:00:00Z",
    answeredAt: "2026-09-20T11:00:00Z",
    note: null,
  },
  declined: {
    shareable: false,
    status: "declined",
    requestedAt: "2026-09-20T10:00:00Z",
    answeredAt: "2026-09-20T11:00:00Z",
    note: null,
  },
} as const;

const serveShare = (share: unknown) => {
  fetchMock.mockImplementation(async (input: unknown, init?: { method?: string }) => {
    if (init?.method === "POST") return { ok: true, json: async () => ({ ok: true }) };
    return { ok: true, json: async () => ({ share }) };
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("it stays out of the way", () => {
  it("renders nothing when nobody has asked", async () => {
    // Most pitches are in this state. A standing "Team example" panel on all of them is how a rep
    // learns to skip the one that matters.
    serveShare(SHARE.none);
    const { container } = render(<ShareRequestPrompt pitchId="p1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("renders nothing when the read fails", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    const { container } = render(<ShareRequestPrompt pitchId="p1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});

describe("a live request", () => {
  it("shows the ask, the manager's note, and both answers", async () => {
    serveShare(SHARE.pending);
    render(<ShareRequestPrompt pitchId="p1" />);
    expect(await screen.findByText(/asked to play this pitch to the team/i)).toBeTruthy();
    expect(screen.getByText(/Great rebuttal at the door/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Yes, they can hear it/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /No thanks/i })).toBeTruthy();
  });

  it("says a no costs nothing, because otherwise it is not a free answer", async () => {
    serveShare(SHARE.pending);
    render(<ShareRequestPrompt pitchId="p1" />);
    expect(await screen.findByText(/changes nothing about your score/i)).toBeTruthy();
  });

  it("posts the rep's own answer and then RE-READS rather than patching its copy", async () => {
    // The client deciding what the log now means is the second place the verdict gets decided.
    serveShare(SHARE.pending);
    render(<ShareRequestPrompt pitchId="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Yes, they can hear it/i }));

    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");
      expect(posts).toHaveLength(1);
      expect(JSON.parse(String(posts[0]?.[1]?.body))).toMatchObject({ pitchId: "p1", kind: "granted" });
    });
    // Two GETs: the mount read and the re-read after the answer.
    await waitFor(() => {
      const gets = fetchMock.mock.calls.filter((c) => c[1]?.method !== "POST");
      expect(gets.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("a grant can be taken back", () => {
  it("offers to revoke, because a consent that cannot be withdrawn is a transfer", async () => {
    serveShare(SHARE.granted);
    render(<ShareRequestPrompt pitchId="p1" />);
    const btn = await screen.findByRole("button", { name: /Take it back/i });
    fireEvent.click(btn);
    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");
      expect(JSON.parse(String(posts[0]?.[1]?.body))).toMatchObject({ kind: "revoked" });
    });
  });
});

describe("a settled no", () => {
  it("says so and offers nothing to press", async () => {
    serveShare(SHARE.declined);
    render(<ShareRequestPrompt pitchId="p1" />);
    expect(await screen.findByText(/You said no to this one/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
