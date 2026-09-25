// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * LiveCoachingPanel — the surface that runs WHILE a rep is at the door.
 *
 * It is captured on its own, against every convention this session established, and the exception
 * is deliberate. The render-tree rule says capture the ROUTE, and `/[id]` was captured yesterday —
 * but this panel only shows anything once a websocket is live, a transcript is arriving and a cue
 * has been generated. No route-level fixture produces that, so the route capture photographed its
 * idle shell and I recorded the component as "fixed by pattern, unseen" two builds running.
 *
 * `useLiveCoaching` is mocked at its return shape, read from useLiveCoaching.ts:1848-1878 rather
 * than imagined — a mock built from imagination is the failure this session has already paid for
 * twice (`arm`, then `start`, in the door recorder).
 *
 * TWO STATES, because the two that matter are not the same screen: a cue on offer, and the
 * capture-stalled warning — the one that tells a rep their mic died mid-pitch, which is the
 * highest-consequence thing this panel ever says.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: false, isExpert: true, loaded: true }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
  }),
}));
/**
 * The upload card is NOT mocked out any more.
 *
 * It renders underneath the panel, and the not-recording state is precisely where a rep reaches
 * for it — live capture failed, so upload the recording instead. Its three white-alpha sites were
 * fixed by pattern in this build and would otherwise have shipped unseen for the third time.
 */

/** `ConfidenceRead` — liveConfidence.ts:18-28. */
const CONFIDENCE = {
  level: "watch" as const,
  fillerHigh: true,
  rushing: false,
  repTalkShare: 0.71,
  talkShareKnown: true,
  overTalking: true,
  hasEnough: true,
  note: "A signal-based read, never a verdict.",
};

/** `Turn` — useLiveCoaching.ts:173. */
const TURNS = [
  { text: "Morning — I'm with the fiber crew that's been on Maple this week.", speaker: "agent" as const },
  { text: "I've already got internet and I'm late for something.", speaker: "customer" as const },
  { text: "Totally fair. Who are you with right now?", speaker: "agent" as const },
  { text: "Spectrum. It's fine. Why?", speaker: "customer" as const },
];

const live = (over: Record<string, unknown> = {}) => ({
  recordingBlob: null,
  clearRecording: vi.fn(),
  transcriptSaved: false,
  micLevel: 0.42,
  status: "live" as const,
  audioCapturing: true,
  turns: TURNS,
  partial: "Just checking who everyone's",
  currentCue: "Give a reason for the question — the crew already pulled fiber to this block.",
  cueMarked: false,
  markCueUsed: vi.fn(),
  cueStatus: "",
  cueSummary: null,
  phase: "objection",
  confidence: CONFIDENCE,
  observing: false,
  observeUntil: null,
  autoCoach: true,
  setAutoCoach: vi.fn(),
  agentSpeaking: false,
  toggleAgentSpeaking: vi.fn(),
  lockHeldWarning: false,
  anchorHint: false,
  mode: "suggestion" as const,
  setMode: vi.fn(),
  error: null,
  start: vi.fn(async () => true),
  stop: vi.fn(async () => {}),
  requestCue: vi.fn(),
  ...over,
});

/**
 * The persist effect fires the moment a `recordingBlob` appears on a non-live session (:121).
 * Mocked so the recovery capture does not depend on storage.
 */
vi.mock("@/lib/coach/v5/persistRecording", () => ({
  persistRecording: vi.fn(async () => ({ ok: true })),
}));

const mocked = { value: live() };
vi.mock("@/lib/coach/v5/useLiveCoaching", () => ({
  useLiveCoaching: () => mocked.value,
}));

import { LiveCoachingPanel } from "@/components/sales-coach/LiveCoachingPanel";

describe("capture", () => {
  it("live coaching, a cue on offer mid-call", async () => {
    stubBrowserApis();
    mocked.value = live();
    const { container } = render(<LiveCoachingPanel sessionId="sess-1" context="in_person" />);
    // The CUE's own words — the thing the panel exists to deliver. The chrome renders without it.
    await screen.findAllByText(/pulled fiber to this block/i, undefined, { timeout: 8000 });
    // 448px = Tailwind's `max-w-md`, which is the container this panel actually sits in at
    // [id]/page.tsx:~470. The first shot used 430 and the header wrapped; a layout judged at a
    // width the product never uses is how this harness nearly reported its own first false
    // finding, so the width is taken from the page rather than chosen.
    capture("live-coaching", container, { width: 448, height: 1200 });
  });

  /**
   * THE NOT-RECORDING BANNER, and my first attempt at this capture was a fraud.
   *
   * I set `audioCapturing: false` against a LIVE socket and waited on `/audio|mic|recording/i`.
   * The banner is gated on `!live` (:320), so it could never have appeared — and the matcher
   * passed anyway, on the words "MIC LEVEL", which render in every state. A green capture of a
   * screen that does not contain the thing it is named for. EIGHTH vacuous wait of this session,
   * written in the same file whose docstring warns about them.
   *
   * The real condition is a session that is NOT live: `status: "error"` with no audio capture,
   * which `notRecordingBanner` answers with "Recording stopped — nothing is being captured."
   * That is the trap the component's own comment at :316 exists to close — a rep pitching a door
   * while nothing records.
   */
  it("live coaching, not recording", async () => {
    stubBrowserApis();
    mocked.value = live({
      status: "error",
      audioCapturing: false,
      currentCue: null,
      partial: "",
      turns: [],
      error: "The mic was released by another app.",
    });
    const { container } = render(<LiveCoachingPanel sessionId="sess-1" context="in_person" />);
    // The banner's OWN sentence, from notRecordingBanner.ts:26.
    await screen.findByText(/nothing is being captured/i, undefined, { timeout: 8000 });
    capture("live-coaching-not-recording", container, { width: 448, height: 700 });
  });

  /**
   * THE RECOVERY PATH — and the only state that renders `SessionRecordingUpload`.
   *
   * Gated at :813 on `!transcriptSaved && !live && (recordingBlob || savingState === "saved")`:
   * the live transcript did not save, but the audio did, so the rep re-transcribes from the
   * recording. Un-mocking the component was not enough to make it appear — it needed the blob,
   * which is why its three sites had been "fixed by pattern, unseen" through two builds.
   */
  it("live coaching, recovering a call whose transcript did not save", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    mocked.value = live({
      status: "idle",
      audioCapturing: false,
      currentCue: null,
      partial: "",
      turns: [],
      transcriptSaved: false,
      recordingBlob: new Blob(["audio"], { type: "audio/webm" }),
    });
    const { container } = render(<LiveCoachingPanel sessionId="sess-1" context="in_person" />);
    // `SessionRecordingUpload`'s OWN button (:342) — the component this capture exists to
    // photograph. My first matcher used the panel's intro sentence at :818, which the persist
    // mock's success flips to the other branch's wording; waiting on the CARD rather than on the
    // copy above it is both more robust and the correct target.
    await screen.findByText(/Re-transcribe from saved recording/i, undefined, { timeout: 8000 });
    capture("live-coaching-recover", container, { width: 448, height: 900 });
  });
});
