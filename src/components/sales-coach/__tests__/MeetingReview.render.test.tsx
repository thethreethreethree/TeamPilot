// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * MeetingReview pending-audio auto-terminal (audit D5). A 409 means no assembled audio yet; early on that can be
 * transient (a chunk still landing), so the review offers "Try again" — but it used to offer it FOREVER. After
 * MAX_PENDING_RETRIES consecutive 409s it now becomes a hard TERMINAL "not recorded" state (Back only, no
 * Try-again), so a rep whose meeting genuinely wasn't recorded isn't stuck retrying. This locks that transition.
 */

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { MeetingReview } from "../MeetingReview";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MeetingReview — pending-audio auto-terminal (audit D5)", () => {
  it("offers Try again on early 409s, then goes hard-terminal after MAX retries", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409, json: async () => ({}) })));
    render(<MeetingReview sessionId="s1" />);

    // 1st 409 (on mount) → pending-audio WITH a Try again.
    await waitFor(() => expect(screen.getByText(/isn't ready yet/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /Try again/i })).toBeTruthy();

    // 2nd 409 (retry) → still pending-audio (below the terminal threshold).
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Try again/i })).toBeTruthy());
    expect(screen.queryByText(/doesn't appear to have been recorded/i)).toBeNull();

    // 3rd 409 (retry) → HARD TERMINAL: names "not recorded", drops Try again, keeps Back.
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => expect(screen.getByText(/doesn't appear to have been recorded/i)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Try again/i })).toBeNull();
    expect(screen.getByRole("link", { name: /Back to Meeting Coach/i })).toBeTruthy();
  });

  it("a non-409 (ready) resets the pending sequence — no premature terminal", async () => {
    // First a 409, then a 200 with a dissect → renders the review, not the terminal.
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) return { ok: false, status: 409, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ dissect: { decisions: [], actions: [], openItems: [], summary: "ok" } }) };
      }),
    );
    render(<MeetingReview sessionId="s1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Try again/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => expect(screen.queryByText(/isn't ready yet/i)).toBeNull());
    expect(screen.queryByText(/doesn't appear to have been recorded/i)).toBeNull(); // recovered, not terminal
  });
});
