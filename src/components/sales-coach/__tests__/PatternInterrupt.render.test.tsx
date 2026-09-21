// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * The Pattern Interrupt board.
 *
 * A pattern is a claim about a named person, shown to their manager, so the states that could
 * mislead matter more than the layout:
 *
 *   · a FAILED read must never render as "no patterns" — on this screen that reads as praise
 *   · "nothing scored yet" and "nothing found" are opposite facts that look identical
 *   · the counts come from the resolver's verdicts, not from a second filter on this surface,
 *     which is the C8 ruling (open = status ≠ Fixed) and the reason it can be lost quietly
 */

const isManagerMock = vi.fn(() => false);
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({
  useIsSalesCoachManager: () => isManagerMock(),
}));

import { PatternInterrupt } from "../PatternInterrupt";

const fetchMock = vi.fn();
const respond = (body: unknown, ok = true) => {
  fetchMock.mockImplementationOnce(async () => ({ ok, json: async () => body }));
};

const pattern = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  repId: "rep-1",
  itemId: "intro.trucks",
  itemKind: "element",
  label: "Trucks / neighborhood notice",
  section: "introduction",
  firstSeen: "2026-03-01T10:00:00Z",
  missesAtDetection: 5,
  applicableAtDetection: 7,
  costPerPitch: 2.1,
  strip: ["missed", "missed", "hit", "missed", "missed", "hit", "missed"],
  coachedAt: null,
  fixedAt: null,
  repReviewed: false,
  verdict: { status: "new", open: true, reason: "Detected, not coached yet", streak: 0 },
  daysOpen: 9,
  ...over,
});

const wire = (over: Record<string, unknown> = {}) => ({
  repId: "rep-1",
  patterns: [pattern()],
  counts: { open: 3, fixed: 1, improving: 1, isNew: 2, stalled: 0, openNotImproving: 2 },
  teamWide: [],
  capped: false,
  scored: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  isManagerMock.mockReturnValue(false);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("a failed read is not an empty board", () => {
  it("says it could not look, rather than that there is nothing to find", async () => {
    respond({}, false);
    render(<PatternInterrupt />);
    await screen.findByText(/could not be loaded/i);
    expect(screen.getByText(/failure to read them, not a finding/i)).toBeTruthy();
    // The praise-shaped sentence must be absent.
    expect(screen.queryByText(/No patterns right now/i)).toBeNull();
  });

  it("offers a retry rather than leaving a dead screen", async () => {
    respond({}, false);
    render(<PatternInterrupt />);
    await screen.findByText(/could not be loaded/i);
    respond(wire());
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText(/Path to fixed/i)).toBeTruthy();
  });

  it("treats a thrown fetch the same as a bad status", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    render(<PatternInterrupt />);
    await screen.findByText(/could not be loaded/i);
  });
});

describe("nothing found and nothing looked at are different sentences", () => {
  it("says nothing has been scored when no pitch has been", async () => {
    respond(wire({ patterns: [], scored: false }));
    render(<PatternInterrupt />);
    expect(await screen.findByText(/Nothing has been scored yet/i)).toBeTruthy();
  });

  it("calls an empty result a finding when pitches HAVE been scored", async () => {
    respond(wire({ patterns: [], scored: true }));
    render(<PatternInterrupt />);
    expect(await screen.findByText(/No patterns right now/i)).toBeTruthy();
    expect(screen.getByText(/That is a finding, not an absence of one/i)).toBeTruthy();
  });
});

describe("the counts are the resolver's, not this surface's", () => {
  it("shows the verdict counts even when they disagree with the visible list", async () => {
    // One pattern in the list, three open across the rep. A surface that recomputed from
    // `patterns.length` would print 1 — which is the C8 failure: a second definition of open,
    // arrived at honestly, disagreeing with the authority.
    respond(wire({ patterns: [pattern()] }));
    const { container } = render(<PatternInterrupt />);
    await screen.findByText(/Path to fixed/i);
    const active = container.textContent ?? "";
    expect(active).toContain("Active patterns");
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders the status pill from the verdict", async () => {
    respond(wire({ patterns: [pattern({ verdict: { status: "stalled", open: true, reason: "Coached 9 days ago with no improvement", streak: 0 } })] }));
    render(<PatternInterrupt />);
    // Twice on purpose: the card pill and the detail pill, both from the one verdict rather than
    // each deciding for itself.
    expect((await screen.findAllByText("Stalled")).length).toBe(2);
    // The reason travels with it — a status nobody can argue with is not evidence.
    expect(screen.getByText(/Coached 9 days ago with no improvement/)).toBeTruthy();
  });

  it("draws one dot per APPLICABLE pitch, never padded to ten (C4)", async () => {
    respond(wire());
    const { container } = render(<PatternInterrupt />);
    await screen.findByText(/Path to fixed/i);
    // Seven applicable pitches, seven dots — the board's "5 of 7". Only the card carries a
    // strip, so the count is exact.
    expect(container.querySelectorAll('[class*="rounded-[3px]"]').length).toBe(7);
  });

  it("fills the path-to-fixed bar from the verdict's streak", async () => {
    respond(wire({ patterns: [pattern({ verdict: { status: "coaching", open: true, reason: "Being coached", streak: 2 } })] }));
    render(<PatternInterrupt />);
    expect(await screen.findByText(/2 of 5 clean pitches in a row/)).toBeTruthy();
  });
});

describe("a truncated read says so", () => {
  it("warns when more patterns exist than one read returns", async () => {
    respond(wire({ capped: true }));
    render(<PatternInterrupt />);
    expect(await screen.findByText(/cover only part of them/i)).toBeTruthy();
  });

  it("is silent when the read was complete", async () => {
    respond(wire({ capped: false }));
    render(<PatternInterrupt />);
    await screen.findByText(/Path to fixed/i);
    expect(screen.queryByText(/cover only part of them/i)).toBeNull();
  });
});

describe("the role split", () => {
  it("gives a rep no tab row, because it would have one option", async () => {
    respond(wire());
    render(<PatternInterrupt />);
    await screen.findByText(/Path to fixed/i);
    expect(screen.queryByRole("button", { name: /^Rep progress$/ })).toBeNull();
  });

  it("gives a manager both tabs, and says Rep progress is unbuilt rather than faking it", async () => {
    isManagerMock.mockReturnValue(true);
    respond(wire());
    render(<PatternInterrupt />);
    await screen.findByText(/Path to fixed/i);
    fireEvent.click(screen.getByRole("button", { name: /^Rep progress$/ }));
    expect(screen.getByText(/Rep progress is not built yet/i)).toBeTruthy();
  });

  it("tells a rep their manager sees the same page", async () => {
    respond(wire());
    render(<PatternInterrupt />);
    await screen.findByText(/Your manager sees this same page/i);
  });

  it("surfaces a team-wide pattern as a training gap, not a rep problem", async () => {
    isManagerMock.mockReturnValue(true);
    respond(wire({ teamWide: [{ itemId: "deliv.spokenYes", label: "Spoken \"yes\" at hinge moments", repIds: ["a", "b", "c"] }] }));
    render(<PatternInterrupt />);
    expect(await screen.findByText(/Team-wide pattern/i)).toBeTruthy();
    expect(screen.getByText(/3 reps share this/i)).toBeTruthy();
  });
});
