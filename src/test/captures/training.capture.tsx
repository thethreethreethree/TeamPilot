// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Training — six white-alpha container sites, rep-facing, and never rendered.
 *
 * THREE SCREENS on one route, and the branch is chosen by an HTTP STATUS rather than a flag:
 * `/coach-assessment` 200 → the manager's team view; 403 → fall through to the rep's own
 * `/my-training`; anything else → an honest error, because a 5xx must not silently demote a real
 * manager to the rep view (the page's own F2 note at :282).
 *
 * All three are captured. That status-driven fork is the same trap as Standard/Expert with an
 * extra edge: a fixture that returns 200 for everything can only ever photograph one of them.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/training",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: true, isExpert: false, loaded: true }),
}));

import TrainingPage from "@/app/dashboard/sales-coach/training/page";

/** `RepTraining` at training/page.tsx:18 + `ManagerPracticeSummary` at practiceAnalytics.ts:117. */
const TEAM = [
  {
    agentId: "m1",
    agentName: "Jordan Ellis",
    dissectCount: 14,
    growthAreas: ["Asks the incumbent question with no reason attached."],
    strategies: ["Attach the reason to the question before the prospect answers."],
    practice: { attempts: 9, latest: 78, trend: "up" as const },
  },
  {
    agentId: "m2",
    agentName: "Sam Ortiz",
    dissectCount: 6,
    growthAreas: ["Stops before the ask."],
    strategies: ["Name a time, not a question, to close."],
    practice: { attempts: 3, latest: 51, trend: "down" as const },
  },
];

/** `TeamPracticeSummary` at practiceAnalytics.ts:132. */
const TEAM_PRACTICE = {
  activeReps: 2,
  totalAttempts: 12,
  avgLatest: 64,
  improving: 1,
  slipping: 1,
};

/**
 * `Mine` at :26 with `RepPracticeSummary` at practiceAnalytics.ts:34.
 *
 * `byFocus` carries one of each TREND — up, flat, down — on purpose. TrendChip at :35 renders a
 * different colour and word for each, and a fixture with one trend photographs one branch. Same
 * reason the Scoreboard fixture put a rep in every band.
 */
const MINE = {
  dissectCount: 11,
  growthAreas: ["You answer the words, not the worry underneath them."],
  strategies: ["Say the worry out loud and let them correct you."],
  strengths: ["You take a brush-off without arguing with it."],
  practice: {
    totalAttempts: 9,
    appliedAttempts: 7,
    latest: 78,
    trend: "up" as const,
    byFocus: [
      { focus: "Attach a reason to the question", attempts: 4, latest: 78, first: 52, trend: "up" as const },
      { focus: "Name the worry underneath", attempts: 3, latest: 61, first: 60, trend: "flat" as const },
      { focus: "Ask for the sale", attempts: 2, latest: 44, first: 58, trend: "down" as const },
    ],
  },
};

/** The route's STATUS is the branch selector, so each state is served by status, not by body. */
const serve = (mode: "manager" | "rep" | "error") =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("coach-assessment")) {
        if (mode === "manager")
          return { ok: true, json: async () => ({ team: TEAM, teamPractice: TEAM_PRACTICE }) };
        if (mode === "rep") return { ok: false, status: 403, json: async () => ({}) };
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url.includes("my-training")) return { ok: true, json: async () => MINE };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("training, a manager's team", async () => {
    stubBrowserApis();
    serve("manager");
    const { container } = render(<TrainingPage />);
    await screen.findByText(/Jordan Ellis/i, undefined, { timeout: 8000 });
    capture("training-manager", container, { width: 1180, height: 1400 });
  });

  it("training, a rep's own", async () => {
    stubBrowserApis();
    serve("rep");
    const { container } = render(<TrainingPage />);
    // A focus label from `byFocus` — the practice card is the deepest thing on this branch, and
    // waiting on a growth area would go green with the trend chips unrendered.
    await screen.findByText(/Name the worry underneath/i, undefined, { timeout: 8000 });
    capture("training-rep", container, { width: 1180, height: 1400 });
  });

  it("training, the read failed", async () => {
    stubBrowserApis();
    serve("error");
    const { container } = render(<TrainingPage />);
    await screen.findByText(/couldn't|could not|error|try again/i, undefined, { timeout: 8000 });
    capture("training-error", container, { width: 1180, height: 500 });
  });
});
