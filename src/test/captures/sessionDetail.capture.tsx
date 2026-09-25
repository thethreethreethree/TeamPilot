// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Session detail (`/[id]`) — the Expert view of one recorded call, and the single highest-yield
 * route left: **22 of the 74 remaining white-alpha sites live in its render tree**, across
 * `[id]/page.tsx` (9), `PivotAndScores` (7), `SessionRecordingUpload` (3), `LiveCoachingPanel` (2)
 * and `SessionCoachTools` (1).
 *
 * It is captured as a ROUTE rather than component-by-component for that reason: the tree is the
 * unit, which is what the render-tree sweep established an hour ago.
 *
 * TWO STATES. An ENDED session shows the review, the pivot, the moments and the transcript; an
 * ACTIVE one shows `LiveCoachingPanel` — the surface that runs while a rep is at the door, and the
 * one component here that has never been rendered in either theme.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "sess-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/sess-1",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
/** Expert: the Standard branch redirects an ended session to the After Pitch Summary (:190). */
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: false, isExpert: true, loaded: true }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
  }),
}));

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast";
import SessionDetail from "@/app/dashboard/sales-coach/[id]/page";

/** Both providers mount at the layout root (`layout.tsx:144` / `:8`) — a harness need, not a fix. */
const Page = () => (
  <ThemeProvider>
    <ToastProvider>
      <SessionDetail />
    </ToastProvider>
  </ThemeProvider>
);

/** `Session` at [id]/page.tsx:55-75. */
const ended = {
  id: "sess-1",
  context: "in_person" as const,
  sessionKind: "sales",
  clientLabel: "Door 17",
  status: "reviewed" as const,
  startedAt: "2026-09-20T15:02:00.000Z",
  territory: "Maple Ct",
  approach: "Fiber on the block",
  offer: "1 Gbps symmetrical",
  outcome: "follow_up",
  dealValue: null,
  audioAssetUrl: null,
};
const active = { ...ended, status: "active" as const, outcome: null };

const SEGMENTS = [
  { id: "g1", speaker: "agent" as const, seq: 1, text: "Morning — I'm with the fiber crew that's been on Maple this week." },
  { id: "g2", speaker: "customer" as const, seq: 2, text: "I've already got internet and I'm late for something." },
  { id: "g3", speaker: "agent" as const, seq: 3, text: "Totally fair. Who are you with right now?" },
  { id: "g4", speaker: "customer" as const, seq: 4, text: "Spectrum. It's fine. Why?" },
  { id: "g5", speaker: "unknown" as const, seq: 5, text: "(inaudible)" },
];

/** `Review` at :59. */
const REVIEW = {
  hasSignal: true,
  strengths: [{ point: "You opened with the street, not the company.", example: "“I'm with the fiber crew…”" }],
  growthAreas: [{ opportunity: "You asked who they were with and gave no reason.", nextStep: "Attach the reason to the question." }],
  closing: "One reason attached to one question turns this door into a callback.",
};

/** `PivotMoment` / `SalesMoment` / `SalesIntel` from summaryTypes.ts. */
const SUMMARIZE = {
  summary: "A short doorstep conversation that cooled after an unexplained question.",
  pivot: {
    atSeq: 4,
    timestampLabel: "1:12",
    direction: "lost" as const,
    label: "The question with no reason",
    customerLine: "Spectrum. It's fine. Why?",
    repLine: "Just checking who everyone's with around here.",
    whatHappened: "The rep asked without giving a reason, and the customer disengaged.",
    whyItMattered: "A question with no reason attached reads as a survey.",
  },
  moments: [
    { atSeq: 1, timestampLabel: "0:08", kind: "opener" as const, label: "Opened on the street", customerLine: null, repLine: "I'm with the fiber crew…", note: "Local and visible.", isBreakdown: false, correction: null, sentiment: "neutral" as const },
    { atSeq: 4, timestampLabel: "1:12", kind: "breakdown" as const, label: "The question with no reason", customerLine: "Spectrum. It's fine. Why?", repLine: "Just checking…", note: "Reads as a survey.", isBreakdown: true, correction: { correctLine: "I ask because the crew's already pulled fiber to this block.", whyItWorks: "The reason makes the question relevant." }, sentiment: "cooling" as const },
  ],
  intel: { competitors: ["Spectrum"], topics: ["pricing", "contract length", "install timing"] },
};

const serve = (session: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Answered per route. A catch-all `{}` has manufactured three phantom crashes this session.
      if (url.includes("/summarize")) return { ok: true, json: async () => SUMMARIZE };
      if (url.includes("/review")) return { ok: true, json: async () => ({ review: REVIEW }) };
      if (url.includes("/why")) return { ok: true, json: async () => ({ why: null }) };
      if (url.includes("/segments")) return { ok: true, json: async () => ({ segments: SEGMENTS }) };
      if (url.includes("pitch-score")) return { ok: true, json: async () => ({ score: null }) };
      if (url.includes("/sales-session/sess-1"))
        return { ok: true, json: async () => ({ session, segments: SEGMENTS }) };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("session detail, an ended call", async () => {
    stubBrowserApis();
    serve(ended);
    const { container } = render(<Page />);
    // The PIVOT's own line — the deepest thing on this screen, and absent from every other state.
    await screen.findAllByText(/question with no reason/i, undefined, { timeout: 8000 });
    capture("session-detail", container, { width: 1180, height: 2400 });
  });

  /**
   * The THIN state, and it replaced a "live call" capture that was worth nothing.
   *
   * `LiveCoachingPanel` is mounted UNCONDITIONALLY at :1027 — not behind `status === "active"` —
   * so an active session renders the same body as an ended one and the two captures would have
   * been the same picture twice. Checked rather than assumed, which is the only reason it was
   * caught before it became a second image nobody needed.
   *
   * What differs meaningfully is a session the coach could not read: no review signal, no moments,
   * no pivot. That is what most recordings look like before anything has analysed them, and it is
   * the branch carrying this page's honest-empty copy.
   */
  it("session detail, nothing to read yet", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/summarize"))
          return { ok: true, json: async () => ({ summary: null, pivot: null, moments: [], intel: null }) };
        if (url.includes("/review"))
          return { ok: true, json: async () => ({ review: { hasSignal: false, strengths: [], growthAreas: [] } }) };
        if (url.includes("/why")) return { ok: true, json: async () => ({ why: null }) };
        if (url.includes("/segments")) return { ok: true, json: async () => ({ segments: [] }) };
        if (url.includes("pitch-score")) return { ok: true, json: async () => ({ score: null }) };
        if (url.includes("/sales-session/sess-1"))
          return { ok: true, json: async () => ({ session: active, segments: [] }) };
        return { ok: true, json: async () => ({}) };
      })
    );
    const { container } = render(<Page />);
    // This branch's OWN sentence (:1020), not the page chrome — the chrome renders in every state.
    await screen.findByText(/Not enough of the conversation yet/i, undefined, { timeout: 8000 });
    capture("session-detail-thin", container, { width: 1180, height: 1200 });
  });
});
