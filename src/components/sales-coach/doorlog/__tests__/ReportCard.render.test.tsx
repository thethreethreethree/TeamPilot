// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Render gate for the error-dressed-as-no-data fix (audit 2026-08-18). When the Report Card's load FAILS
 * (network error or non-200) it must show an honest, retryable error — NOT the "No pattern summary yet /
 * No pitches recorded" empty state, which would make a rep think their pitches vanished.
 */

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { ReportCard } from "../ReportCard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ReportCard — load failure shows an honest error, not empty (render gate)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
  });

  it("a failed load renders the error card (not the misleading 'no data' empty state)", async () => {
    render(<ReportCard />);
    await waitFor(() => expect(screen.getByText(/Couldn't load your Report Card/i)).toBeTruthy());
    expect(screen.getByText(/Retry/i)).toBeTruthy();
    // The misleading empty states must NOT be shown on an error.
    expect(screen.queryByText(/No pattern summary yet/i)).toBeNull();
    expect(screen.queryByText(/No pitches recorded yet/i)).toBeNull();
  });
});
