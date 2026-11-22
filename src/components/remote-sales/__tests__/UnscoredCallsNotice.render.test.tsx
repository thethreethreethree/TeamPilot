// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

import { UnscoredCallsNotice } from "../UnscoredCallsNotice";

/** Founder 2026-11-23: scoring stays manual; a manager's Today says how many phone/video calls are waiting. */
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

const answer = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body });
const settle = async () => {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 0));
};

describe("waiting phone/video calls on Today", () => {
  it("asks for the Remote Sales backlog — the Coaching panel's own count", async () => {
    fetchMock.mockResolvedValue(answer(200, { unscored: 0, unscorable: 0 }));
    render(<UnscoredCallsNotice />);
    await settle();
    expect(String(fetchMock.mock.calls[0]![0])).toContain("pitch-score/backfill?module=remote_sales");
  });

  it("names the number and links to Coaching", async () => {
    fetchMock.mockResolvedValue(answer(200, { unscored: 3, unscorable: 1 }));
    render(<UnscoredCallsNotice />);
    expect(await screen.findByText(/3 phone\/video calls are waiting to be scored/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /score in coaching/i }).getAttribute("href")).toBe("/dashboard/remote-sales/coaching");
  });

  it("uses the singular for one", async () => {
    fetchMock.mockResolvedValue(answer(200, { unscored: 1 }));
    render(<UnscoredCallsNotice />);
    expect(await screen.findByText(/1 phone\/video call is waiting/i)).toBeTruthy();
  });

  for (const [why, res] of [
    ["nothing is waiting", answer(200, { unscored: 0, unscorable: 4 })],
    ["the viewer is not a manager", answer(403)],
    ["the count failed (the Coaching panel says so there)", answer(500)],
  ] as const) {
    it(`shows nothing when ${why}`, async () => {
      fetchMock.mockResolvedValue(res);
      const { container } = render(<UnscoredCallsNotice />);
      await settle();
      expect(container.textContent).toBe("");
    });
  }
});
