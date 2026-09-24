// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Pattern Interrupt — the surface I told the founder to avoid in a live investor demo.
 *
 * The caution was honest and unverified: its detection has only ever run inside the scoring route,
 * so no pattern has ever opened, and once pitches are scored it begins producing them on data
 * nobody has looked at. "I would not demo this" is a reasonable thing to say about a screen you
 * have never seen. It is a better thing to say — or withdraw — after seeing it.
 *
 * Two states, because they are the two a room could land on: the EMPTY one every account has
 * today, and a POPULATED one resembling what the backfill would produce.
 *
 * Every field below is copied from its type — `Wire` at PatternInterrupt.tsx:49, `PatternRow` at
 * readPatterns.ts:24, `StatusVerdict` at status.ts:103. Inventing the shape is how a capture
 * photographs an error state and calls it the screen.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/patterns",
}));

import { PatternInterrupt } from "@/components/sales-coach/PatternInterrupt";

const EMPTY = {
  repId: null,
  chips: [],
  patterns: [],
  counts: { open: 0, fixed: 0, improving: 0, isNew: 0, stalled: 0, openNotImproving: 0 },
  teamWide: [],
  capped: false,
  scored: false,
  repProgress: null,
  viewerId: "mgr1",
  nameByActor: {},
};

const PATTERN = {
  id: "pat1",
  repId: "rep1",
  itemId: "intro.trucks",
  itemKind: "element" as const,
  label: "Trucks in the area",
  section: "INTRODUCTION · TRUCKS / NEIGHBORHOOD NOTICE",
  firstSeen: "2026-09-14T09:00:00.000Z",
  missesAtDetection: 6,
  applicableAtDetection: 10,
  costPerPitch: 3.2,
  strip: ["missed", "missed", "hit", "missed", "missed", "hit", "missed", "missed", "hit", "missed"] as never,
  coachedAt: "2026-09-18T09:00:00.000Z",
  fixedAt: null,
  repReviewed: false,
  events: [
    { kind: "coached", at: "2026-09-18T09:00:00.000Z", actorId: "mgr1", body: "Lead with the trucks line before they reach for the door." },
  ],
  verdict: {
    status: "coaching" as const,
    open: true,
    reason: "Coached 6 days ago; no clean streak yet.",
    streak: 0,
    comparison: null,
  },
  daysOpen: 10,
};

const POPULATED = {
  ...EMPTY,
  chips: [{ repId: "rep1", open: 1, fullName: "Jordan Ellis" }],
  patterns: [PATTERN],
  counts: { open: 1, fixed: 0, improving: 0, isNew: 0, stalled: 0, openNotImproving: 1 },
  scored: true,
  nameByActor: { mgr1: "You", rep1: "Jordan Ellis" },
};

const serve = (wire: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => wire })));

describe("capture", () => {
  it("pattern interrupt, the empty state every account has today", async () => {
    stubBrowserApis();
    serve(EMPTY);
    const { container } = render(<PatternInterrupt />);
    // findAll: the word appears in the heading, the tabs and the empty copy. Both boards
    // rendered on the first run; only the matchers were ambiguous.
    await screen.findAllByText(/pattern/i, undefined, { timeout: 8000 });
    capture("pattern-interrupt-empty", container, { width: 1180, height: 700 });
  });

  it("pattern interrupt, one open pattern", async () => {
    stubBrowserApis();
    serve(POPULATED);
    const { container } = render(<PatternInterrupt />);
    await screen.findAllByText("Trucks in the area", undefined, { timeout: 8000 });
    capture("pattern-interrupt", container, { width: 1180, height: 900 });
  });
});
