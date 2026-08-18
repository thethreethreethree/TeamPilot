// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Render gate for Pitch Performance (renamed from Report Card, founder spec 2026-08-19). Two locks: a failed
 * load shows an honest, retryable error — NOT the "No pitches recorded" empty state (a rep would think their
 * pitches vanished; the error-dressed-as-no-data honesty fix, audit 2026-08-18); and a good load renders the
 * recordings list with each pitch's after-pitch summary + outcome under the "Pitch Performance" heading.
 */

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { ReportCard } from "../ReportCard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Pitch Performance", () => {
  it("a failed load renders the honest error (not the misleading 'no pitches' empty state)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    render(<ReportCard />);
    await waitFor(() => expect(screen.getByText(/Couldn't load your pitches/i)).toBeTruthy());
    expect(screen.getByText(/Retry/i)).toBeTruthy();
    expect(screen.queryByText(/No pitches recorded yet/i)).toBeNull();
  });

  it("a good load renders the recordings list with each after-pitch summary + outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          pitches: [
            {
              id: "p1",
              name: "Blue door",
              status: "complete",
              recordedAt: "2026-08-19T15:00:00Z",
              outcome: "sold",
              summary: "Strong open, rushed the close.",
            },
          ],
        }),
      })),
    );
    render(<ReportCard />);
    await waitFor(() => expect(screen.getByText("Pitch Performance")).toBeTruthy());
    expect(screen.getByText("Blue door")).toBeTruthy();
    expect(screen.getByText("Strong open, rushed the close.")).toBeTruthy(); // the after-pitch summary inline
    expect(screen.getByText("Sold")).toBeTruthy(); // the outcome badge
  });
});
