// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * RepArena — the rep's gamification dashboard has three states (loading / empty / populated). This locks all three,
 * including the loading branch that used to render UNSTYLED (it now carries <ArenaStyles/> like its siblings). Fetch
 * is stubbed per-URL (the component reads /my-points + /leaderboard); static content is asserted (band label, stat
 * labels, odometer, best-pitch link) rather than the RAF-animated gauge number.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { RepArena } from "../RepArena";

function stubFetch(myPoints: unknown, leaderboard: unknown, opts: { hang?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (opts.hang) return new Promise(() => {}); // never resolves → component stays in loading
      const body = String(url).includes("leaderboard") ? leaderboard : myPoints;
      return Promise.resolve({ ok: true, json: async () => body });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RepArena — states", () => {
  it("shows the loading state (with styles) until data resolves", () => {
    stubFetch(null, null, { hang: true });
    const { container } = render(<RepArena />);
    expect(screen.getByText(/Loading your arena/i)).toBeTruthy();
    // the loading branch must carry the style block (the bug this locks) — a <style> is present.
    expect(container.querySelector("style")).toBeTruthy();
  });

  it("shows the empty state for a rep with no scored sessions", async () => {
    stubFetch({ rows: [], total: 0, avg: 0, sessions: 0 }, { rows: [], meId: "me", meRank: null });
    render(<RepArena />);
    await waitFor(() => expect(screen.getByText(/No pitches scored yet/i)).toBeTruthy());
  });

  it("renders the populated arena: band from avg, totals, stats, and a best-pitch link", async () => {
    const myPoints = {
      // s1 = Elite (92), s2 = Developing (45) so neither record band equals the gauge's band (avg 76 → Solid),
      // keeping each getByText unambiguous.
      rows: [
        { session_id: "s1", points: 92, band: "elite", created_at: "2026-09-01T00:00:00Z" },
        { session_id: "s2", points: 45, band: "developing", created_at: "2026-08-20T00:00:00Z" },
      ],
      total: 137,
      avg: 76,
      sessions: 2,
    };
    const leaderboard = { rows: [{ agent_id: "me", best_points: 92, deals: 3 }], meId: "me", meRank: 1 };
    stubFetch(myPoints, leaderboard);
    render(<RepArena />);

    await waitFor(() => expect(screen.getByText("Total points earned")).toBeTruthy());
    expect(screen.getByText("Solid")).toBeTruthy(); // gauge label = band for avg 76
    expect(screen.getByText(/Best 92/)).toBeTruthy(); // sub: best + rank
    expect(screen.getByText("Strong sessions")).toBeTruthy();
    expect(screen.getByText("Deals closed")).toBeTruthy();
    // the top best-pitch (92 → Elite) links to its own after-pitch
    const link = screen.getByRole("link", { name: /Elite/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/dashboard/sales-coach/s1/after-pitch");
  });
});
