// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * 2026-11-23 sweep: on a call's page, a failed read of its review offered "Generate growth review" (a paid run) over a
 * review that existed, and a failed read of the rep's own "why" reopened the composer for a second permanent one.
 * Each part now says it couldn't load; the paid button is held until a refresh.
 */
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "s1" }), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({ useExperienceMode: () => ({ isStandard: false, mode: "expert" }) }));
vi.mock("@/lib/hooks/useRemoteMacroMode", () => ({ useRemoteMacroMode: () => ({ enabled: false }) }));
vi.mock("@/lib/hooks/useCurrentUserId", () => ({ useCurrentUserId: () => "rep1" }));
vi.mock("@/components/learning/LearningHint", () => ({ LearningHint: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
const none = () => null;
for (const [path, name] of [
  ["@/components/layout/TopBar", "default"],
  ["@/components/sales-coach/SessionCoachTools", "SessionCoachTools"],
  ["@/components/sales-coach/SessionTranscript", "SessionTranscript"],
  ["@/components/sales-coach/PitchScorePanel", "PitchScorePanel"],
  ["@/components/sales-coach/SessionRecordingUpload", "SessionRecordingUpload"],
  ["@/components/sales-coach/LiveCoachingPanel", "LiveCoachingPanel"],
  ["@/components/sales-coach/RemoteCallPanel", "RemoteCallPanel"],
  ["@/components/sales-coach/FeedbackRequest", "FeedbackRequest"],
  ["@/components/sales-coach/FollowThroughPanel", "FollowThroughPanel"],
  ["@/components/remote-sales/RemoteCallComments", "RemoteCallComments"],
  ["@/components/remote-sales/MacroCallView", "MacroCallView"],
  ["@/components/remote-sales/CallPipelineLink", "CallPipelineLink"],
  ["@/components/remote-sales/CallNotes", "CallNotes"],
  ["@/components/sales-coach/StageChips", "StageChips"],
  ["@/components/sales-coach/TrackerHitChips", "TrackerHitChips"],
] as const) vi.doMock(path, () => ({ [name]: none }));
vi.mock("@/components/remote-sales/RecordingConsent", () => ({ ConsentStatus: () => null }));

const SESSION = { id: "s1", status: "ended", context: "door", sessionKind: "sales", agentId: "rep1", startedAt: "2026-11-20T10:00:00Z", endedAt: "2026-11-20T10:10:00Z", outcome: "no_sale", clientLabel: null };
const res = (ok: boolean, body: unknown) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a call's page when parts fail to load", () => {
  it("review, summary and the rep's read each say they couldn't load; the paid button is held", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/coach/sales-session/s1") return res(true, { session: SESSION, transcript: [{ id: "t1", speaker: "agent", text: "hi", seq: 1 }] });
      if (url.includes("/review") || url.includes("/summarize") || url.endsWith("/why")) return res(false, {});
      return res(true, {});
    }));
    const { SessionDetailView } = await import("../SessionDetailView");
    render(<SessionDetailView module="sales_coach" />);
    expect(await screen.findByText(/Couldn.t load this call.s review/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Generate growth review/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Couldn.t load the summary/)).toBeTruthy();
    expect(screen.getByText(/Couldn.t load your read of this call/)).toBeTruthy();
    expect(screen.queryByPlaceholderText("Your honest read — even a hunch.")).toBeNull();
  });
});
