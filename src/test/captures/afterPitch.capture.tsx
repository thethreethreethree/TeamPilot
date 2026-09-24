// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * After Pitch Summary — the screen this product's own copy calls the real output. One Liners says
 * it in words: "Your real calls get the full timeline and score in the After Pitch Summary."
 *
 * 1815 lines, ten white-at-low-alpha sites of the class that emptied every card in the module
 * today, and it had never been rendered in either theme when the render pass was reported
 * complete. It is the natural end of the manager demo path — Coach Assessment → a rep → a
 * recording — so it is the last screen an investor sees.
 *
 * The fixture must produce a summary with `hasSignal: true` AND a non-blank narrative, or the page
 * fires its auto-heal and auto-recover paths (page.tsx:372-395) and photographs a regeneration
 * instead of the surface.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "sess-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/sess-1/after-pitch",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
/**
 * Mutable, because the two branches of this page are two different screens. STANDARD renders
 * scores + read + cue loop + focus. EXPERT additionally renders the conversation TIMELINE — and
 * the timeline is where the page's remaining white-alpha values live, so a Standard-only capture
 * would have reported this file clean while leaving them unseen.
 */
const mode = { isStandard: true };
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: mode.isStandard, isExpert: !mode.isStandard, loaded: true }),
}));

import AfterPitchPage from "@/app/dashboard/sales-coach/[id]/after-pitch/page";

/** `Session` at after-pitch/page.tsx:104-125. */
const SESSION = {
  id: "sess-1",
  context: "in_person" as const,
  clientLabel: "Door 17",
  audioDurationSeconds: 163,
  audioAssetUrl: null,
  territory: "Maple Ct",
  approach: "Fiber on the block",
  offer: "1 Gbps symmetrical",
  startedAt: "2026-09-20T15:02:00.000Z",
  endedAt: "2026-09-20T15:05:43.000Z",
  outcome: "follow_up",
  dealValue: null,
};

/** `Summary` at after-pitch/page.tsx:83-96; `SalesMoment` and `ScoreCategory` from summaryTypes.ts. */
const SUMMARY = {
  hasSignal: true,
  narrative: {
    hasSignal: true,
    strengths: [
      {
        point: "You opened with the street, not the company.",
        example: "“I'm with the fiber crew that's been on Maple this week.”",
      },
      {
        point: "You took the brush-off without arguing with it.",
        example: "“Totally fair.” then a question, not a counter.",
      },
    ],
    growthAreas: [
      {
        opportunity: "You asked who they were with and gave no reason for asking.",
        nextStep: "Attach the reason to the question: “I ask because the crew's already pulled fiber to this block.”",
      },
    ],
    closing: "One reason attached to one question turns this door into a callback.",
  },
  moments: [
    {
      atSeq: 2,
      timestampLabel: "0:08",
      kind: "opener" as const,
      label: "Opened on the street",
      customerLine: null,
      repLine: "I'm with the fiber crew that's been on Maple this week.",
      note: "Local and visible — it earned the second sentence.",
      isBreakdown: false,
      correction: null,
      sentiment: "neutral" as const,
    },
    {
      atSeq: 7,
      timestampLabel: "0:34",
      kind: "objection" as const,
      label: "Brush-off",
      customerLine: "I've already got internet and I'm late for something.",
      repLine: "Totally fair. Who are you with right now?",
      note: "You agreed first, which kept the door open.",
      isBreakdown: false,
      correction: null,
      sentiment: "warming" as const,
    },
    {
      atSeq: 14,
      timestampLabel: "1:12",
      kind: "breakdown" as const,
      label: "The question with no reason",
      customerLine: "Spectrum. It's fine. Why?",
      repLine: "Just checking who everyone's with around here.",
      note: "A question with no reason attached reads as a survey.",
      isBreakdown: true,
      correction: {
        correctLine:
          "I ask because the crew's already pulled fiber to this block, and that changes the price.",
        whyItWorks: "The reason makes the question relevant and plants the thing only you can offer.",
      },
      sentiment: "cooling" as const,
    },
    {
      atSeq: 21,
      timestampLabel: "2:40",
      kind: "close" as const,
      label: "No ask",
      customerLine: "Alright, well — thanks.",
      repLine: "Yeah, no worries. Have a good one.",
      note: "The conversation stopped rather than closing.",
      isBreakdown: false,
      correction: null,
      sentiment: "cooling" as const,
    },
  ],
  scores: [
    { key: "opener" as const, label: "Opener", score: 8, display: "8/10", rationale: "Local, visible, and short.", citation: "0:08", computed: false },
    { key: "objection" as const, label: "Objections", score: 6, display: "6/10", rationale: "You agreed before answering, but never named the worry underneath.", citation: "0:34", computed: false },
    { key: "talk_ratio" as const, label: "Talk / Listen", score: 4, display: "71% you", rationale: "You spoke roughly three words for every one of theirs.", citation: null, computed: true, flagged: true, focusSuggestion: "Leave more room to listen" },
    { key: "question_rate" as const, label: "Questions", score: 5, display: "12% of your turns", rationale: "Two questions in a three-minute conversation.", citation: null, computed: true },
    { key: "tone" as const, label: "Tone", score: 9, display: "9/10", rationale: "Warm and unhurried throughout.", citation: null, computed: false },
    { key: "close" as const, label: "Close", score: 2, display: "2/10", rationale: "No ask was made before the conversation ended.", citation: "2:40", computed: false },
    { key: "next_step" as const, label: "Next step", score: 3, display: "3/10", rationale: "No callback time was agreed.", citation: null, computed: false },
  ],
  cueLoop: [
    {
      cueText: "Ask what they're paying now.",
      mode: "suggestion" as const,
      timestampLabel: "1:05",
      determination: "ignored" as const,
      source: "inferred" as const,
      evidence: "No price question appears after the cue.",
    },
    {
      cueText: "Agree before you answer.",
      mode: "suggestion" as const,
      timestampLabel: "0:30",
      determination: "followed" as const,
      source: "inferred" as const,
      evidence: "“Totally fair.” at 0:34.",
    },
  ],
  focus: {
    focus: "Attach a reason to every question you ask at the door.",
    why: "Your one breakdown moment was a question with no reason, and it cooled the conversation.",
  },
};

const serve = (summary: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Every route this page touches, answered explicitly. A catch-all `{}` would hand the page
      // bodies its routes cannot return, which has manufactured three phantom crashes today.
      if (url.includes("/after-pitch"))
        return { ok: true, json: async () => ({ summary, isOwner: true }) };
      if (url.includes("/segments")) return { ok: true, json: async () => ({ segments: [] }) };
      if (url.includes("/outcome")) return { ok: true, json: async () => ({ ok: true }) };
      if (url.includes("/sales-session/sess-1"))
        return { ok: true, json: async () => ({ session: SESSION }) };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("after pitch, a scored call with a breakdown moment", async () => {
    stubBrowserApis();
    serve(SUMMARY);
    const { container } = render(<AfterPitchPage />);
    // Wait on the BREAKDOWN moment's correction — the deepest thing on the page, and the one piece
    // of content that exists in no other state. A wait on the header would be satisfied before any
    // of this rendered.
    await screen.findByText(/pulled fiber to this block/i, undefined, { timeout: 8000 });
    capture("after-pitch", container, { width: 430, height: 2400 });
  });

  it("after pitch, a call too thin to read", async () => {
    stubBrowserApis();
    serve({
      hasSignal: false,
      narrative: { hasSignal: false, strengths: [], growthAreas: [] },
      moments: [],
      scores: [],
      cueLoop: [],
      focus: null,
    });
    const { container } = render(<AfterPitchPage />);
    // The thin state's OWN sentence. My first matcher was /Door 17|not enough|too short|thin/i —
    // and "Door 17" is the header, which renders in every state including the populated one. That
    // is the eighth time today I have written a wait satisfied by the state I was not aiming at.
    await screen.findByText(/No conversation was captured/i, undefined, { timeout: 8000 });
    capture("after-pitch-thin", container, { width: 430, height: 1000 });
  });

  /**
   * EXPERT mode — the branch that renders the conversation timeline.
   *
   * Worth knowing, and flagged to the founder rather than changed here: One Liners tells a rep
   * "Your real calls get the full timeline and score in the After Pitch Summary", and STANDARD —
   * the default experience — has no timeline on this page at all.
   */
  it("after pitch expert, the conversation timeline", async () => {
    stubBrowserApis();
    mode.isStandard = false;
    serve(SUMMARY);
    try {
      const { container } = render(<AfterPitchPage />);
      await screen.findAllByText(/The question with no reason/i, undefined, { timeout: 8000 });
      capture("after-pitch-expert", container, { width: 430, height: 2600 });
    } finally {
      mode.isStandard = true;
    }
  });
});
