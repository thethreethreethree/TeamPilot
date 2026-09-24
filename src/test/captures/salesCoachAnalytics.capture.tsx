// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Pitch Analytics — one of the four cards on the rep launchpad, and the eleventh of thirteen
 * Sales Coach surfaces to be rendered.
 *
 * Two states. The populated one is what a rep sees once sessions exist; the EMPTY one is what
 * every rep sees today, because nothing scored a pitch until this morning's pipeline. On this
 * product the empty state is not an edge case — it is the default until somebody presses a button.
 *
 * `Stats` and `ProgressPoint` are copied from their declarations at analytics/page.tsx:45-55. The
 * page reads three endpoints; each is stubbed by URL rather than with one catch-all, because a
 * catch-all `{}` manufactured three phantom crashes earlier today — bodies those routes cannot
 * return.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/analytics",
}));
/**
 * Mutable. `AgentEloBadge` — and through it the EloMeter gauge — renders only when `!isStandard`
 * (analytics/page.tsx:189). A Standard-only capture never photographs it, which is how the
 * gauge's TRACK and its 1500 "standard" tick, both `text-white/N` driving currentColor on an SVG
 * stroke, went unseen: invisible on cream, and invisible to every sweep, since neither is spelled
 * `stroke-white` nor sits on a border or a background.
 */
const mode = { isStandard: true };
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: mode.isStandard, isExpert: !mode.isStandard, loaded: true }),
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({ LearningHint: () => null }));

import SalesCoachAnalyticsPage from "@/app/dashboard/sales-coach/analytics/page";

const STATS = {
  sessionsTotal: 66,
  sessionsThisWeek: 4,
  activeCount: 0,
  awaitingReview: 2,
  reviewedCount: 60,
  cuesTotal: 214,
  reviewsGenerated: 58,
  recentGrowth: [],
};

const EMPTY_STATS = {
  sessionsTotal: 0,
  sessionsThisWeek: 0,
  activeCount: 0,
  awaitingReview: 0,
  reviewedCount: 0,
  cuesTotal: 0,
  reviewsGenerated: 0,
  recentGrowth: [],
};

/**
 * `SkillRow` at analytics/page.tsx:20. In STANDARD mode this page renders
 * StandardAnalyticsManagerView with SkillScores as its fallback, so the skills array is most of
 * what a rep actually sees here — an empty one renders one honest sentence and nothing else.
 *
 * THE SCALE IS 0-10. RepSkillGrades.tsx:21 says it: "the rep's six /10 skill scores".
 *
 * My first fixture used 72 / 58 / 44 and the page rendered "A+ 72/10", "A+ 58/10", "A+ 44/10" —
 * which looks like three separate defects at once: a wrong denominator, a grade function stuck on
 * A+, and a header reading "last 0 scored calls" beside "14 of 18". All three were the fixture.
 * 72 on a 0-10 scale saturates the grade, and the header reads `sampleSessions`, which I never
 * supplied.
 *
 * FIFTH phantom of the session, and the most convincing: three independent-looking symptoms from
 * one out-of-range number. Checking the scale took one grep.
 */
const SKILLS = [
  { key: "discovery", label: "Discovery", score: 7.2, sampleSize: 18, read: "You ask, then you wait.", breakdown: "Asked a question in 14 of 18 scored calls." },
  { key: "objections", label: "Objections", score: 5.8, sampleSize: 18, read: "You answer the words, not the worry.", breakdown: "Named the underlying concern in 7 of 18." },
  { key: "close", label: "Close", score: 4.4, sampleSize: 18, read: "You stop before the ask.", breakdown: "Asked for the sale in 5 of 18 scored calls." },
];

const serve = (stats: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("team-analytics")) return { ok: true, json: async () => ({ team: null }) };
      if (url.includes("skills"))
        return { ok: true, json: async () => ({ skills: stats === EMPTY_STATS ? [] : SKILLS }) };
      if (url.includes("/elo"))
        return {
          ok: true,
          json: async () => ({
            elo: { rating: 1740, gamesPlayed: 18, provisional: false, lastDelta: 12, history: [] },
          }),
        };
      if (url.includes("dashboard"))
        return { ok: true, json: async () => ({ stats, series: [] }) };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("analytics, a rep with sessions", async () => {
    stubBrowserApis();
    serve(STATS);
    const { container } = render(<SalesCoachAnalyticsPage />);
    // Wait on a SKILL LABEL. The previous matcher (/66|session/i) passed on the word "session"
    // inside the EMPTY-state sentence — so it was green while the page rendered nothing, and went
    // red the moment the page actually populated. A matcher that only matches the empty state is
    // the vacuous-green shape, wearing a capture's clothes.
    await screen.findAllByText(/Discovery/i, undefined, { timeout: 8000 });
    capture("analytics", container, { width: 1180, height: 900 });
  });

  it("analytics, nothing recorded yet", async () => {
    stubBrowserApis();
    serve(EMPTY_STATS);
    const { container } = render(<SalesCoachAnalyticsPage />);
    await screen.findAllByText(/session/i, undefined, { timeout: 8000 });
    capture("analytics-empty", container, { width: 1180, height: 700 });
  });

  it("analytics expert, the ELO gauge", async () => {
    stubBrowserApis();
    mode.isStandard = false;
    serve(STATS);
    try {
      const { container } = render(<SalesCoachAnalyticsPage />);
      await screen.findAllByText(/1740/, undefined, { timeout: 8000 });
      capture("analytics-expert", container, { width: 1180, height: 900 });
    } finally {
      mode.isStandard = true;
    }
  });
});
