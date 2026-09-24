// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Sessions — the list a rep or manager lands on from "Back to sessions" on the After Pitch
 * Summary, so it sits directly on the demo path and had never been rendered.
 *
 * 1011 lines, eight white-alpha sites in its own file plus a `bg-black/30 … text-primary` search
 * input — the recipe found in 11 places this morning, whose severity depends entirely on what
 * ground it sits on. This one sits on `bg-base`, so it should be an ugly grey box rather than
 * illegible text. That prediction is the reason to render it rather than assume it.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/sessions",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
/**
 * Mutable, because this page is THREE screens, not one:
 *   Standard + manager → StandardSessionsManagerView (a team roster)
 *   Standard + rep     → the session list
 *   Expert             → the session list plus StartSessionPanel
 *
 * My first fixture served `{}` for /team from the catch-all, so the manager view read
 * `isManager: Boolean(undefined)` → false → rendered its `fallback`, which sessions/page.tsx:317
 * passes as `null`. The page rendered a completely empty container and both captures failed on
 * their matchers. Had I waited on a heading instead of a row label, I would have photographed an
 * empty page and called it rendered.
 */
const mode = { isStandard: true };
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: mode.isStandard, isExpert: !mode.isStandard, loaded: true }),
}));

import SalesCoachSessionsPage from "@/app/dashboard/sales-coach/sessions/page";

/** `Row` at sessions/page.tsx:52-73. */
const ROWS = [
  {
    id: "s1",
    clientLabel: "Door 17",
    context: "in_person" as const,
    status: "reviewed" as const,
    startedAt: "2026-09-20T15:02:00.000Z",
    endedAt: "2026-09-20T15:05:43.000Z",
    audioDurationSeconds: 163,
    territory: "Maple Ct",
    offer: "1 Gbps symmetrical",
    outcome: "follow_up",
    agentName: "Jordan Ellis",
    hasDissect: true,
    hasSummary: true,
    hasReview: true,
    readIssue: null,
    flag: null,
  },
  {
    id: "s2",
    clientLabel: "Door 18",
    context: "in_person" as const,
    status: "ended" as const,
    startedAt: "2026-09-20T15:14:00.000Z",
    endedAt: "2026-09-20T15:16:20.000Z",
    audioDurationSeconds: 140,
    territory: "Maple Ct",
    offer: "1 Gbps symmetrical",
    outcome: "no_sale",
    agentName: "Jordan Ellis",
    hasDissect: false,
    hasSummary: true,
    hasReview: false,
    readIssue: "one-sided" as const,
    flag: null,
  },
  {
    id: "s3",
    clientLabel: "Birch Row 4",
    context: "video" as const,
    status: "active" as const,
    startedAt: "2026-09-20T16:40:00.000Z",
    endedAt: null,
    audioDurationSeconds: null,
    territory: "Birch Row",
    offer: null,
    outcome: null,
    agentName: "Sam Ortiz",
    hasDissect: false,
    hasSummary: false,
    hasReview: false,
    readIssue: null,
    flag: null,
  },
];

const STATS = {
  sessionsTotal: 66,
  sessionsThisWeek: 4,
  activeCount: 1,
  awaitingReview: 2,
  reviewedCount: 60,
  cuesTotal: 214,
  reviewsGenerated: 58,
  recentGrowth: [],
};

const serve = (opts: { rows?: unknown; degraded?: boolean; noAccess?: boolean; isManager?: boolean } = {}) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Answered by route, never by a catch-all. Three phantom crashes today came from `{}`.
      if (url.includes("/list")) {
        if (opts.noAccess) return { ok: false, status: 403, json: async () => ({}) };
        if (opts.degraded) return { ok: true, json: async () => ({ degraded: true }) };
        return {
          ok: true,
          json: async () => ({ sessions: opts.rows ?? ROWS, isManager: opts.isManager ?? true, badgesAvailable: true }),
        };
      }
      if (url.includes("/dashboard"))
        return { ok: true, json: async () => ({ stats: STATS, series: [] }) };
      if (url.includes("team-activity"))
        return {
          ok: true,
          json: async () => ({
            byAgent: {
              m1: { count: 41, lastActiveAt: "2026-09-23T18:10:00.000Z", withAudio: 38 },
              m2: { count: 6, lastActiveAt: "2026-09-19T14:02:00.000Z", withAudio: 0 },
              m3: { count: 0, lastActiveAt: "2026-09-01T09:00:00.000Z", withAudio: 0 },
            },
          }),
        };
      if (url.includes("/team"))
        return {
          ok: true,
          json: async () => ({
            isManager: true,
            members: [
              { id: "m1", fullName: "Jordan Ellis", companyRole: "member", salesCoachRole: "staff" },
              { id: "m2", fullName: "Sam Ortiz", companyRole: "member", salesCoachRole: "staff" },
              { id: "m3", fullName: null, companyRole: "member", salesCoachRole: "staff" },
            ],
            pendingInvites: [],
          }),
        };
      if (url.includes("why-patterns"))
        return { ok: true, json: async () => ({ hasEnoughData: false, whysAnalyzed: 3, patterns: [] }) };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("sessions, a manager's team roster", async () => {
    stubBrowserApis();
    serve();
    const { container } = render(<SalesCoachSessionsPage />);
    // A MEMBER's name, not "Your team" — the heading renders before the roster arrives.
    await screen.findByText(/Jordan Ellis/i, undefined, { timeout: 8000 });
    capture("sessions-manager", container, { width: 1180, height: 700 });
  });

  it("sessions, a rep's own history", async () => {
    stubBrowserApis();
    serve({ isManager: false });
    const { container } = render(<SalesCoachSessionsPage />);
    await screen.findAllByText(/Birch Row 4/i, undefined, { timeout: 8000 });
    capture("sessions-rep", container, { width: 1180, height: 1500 });
  });

  it("sessions, expert mode", async () => {
    stubBrowserApis();
    mode.isStandard = false;
    serve({ isManager: false });
    try {
      const { container } = render(<SalesCoachSessionsPage />);
      await screen.findAllByText(/Birch Row 4/i, undefined, { timeout: 8000 });
      capture("sessions-expert", container, { width: 1180, height: 1600 });
    } finally {
      mode.isStandard = true;
    }
  });

  it("sessions, a rep with no history yet", async () => {
    stubBrowserApis();
    serve({ rows: [], isManager: false });
    const { container } = render(<SalesCoachSessionsPage />);
    await screen.findByText(/No sessions match|No sessions yet|nothing here/i, undefined, {
      timeout: 8000,
    });
    capture("sessions-empty", container, { width: 1180, height: 700 });
  });
});
