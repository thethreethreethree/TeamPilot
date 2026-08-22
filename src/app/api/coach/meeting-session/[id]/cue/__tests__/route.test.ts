import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/coach/meeting-session/[id]/cue — the live meeting/huddle cue endpoint. Boundaries: 401 unauth;
 * 404 inaccessible; 403 non-owner (only the facilitator generates its cues); 400 when the session isn't a
 * meeting/huddle (sales sessions use the sales route); happy path runs the meeting strategy over the transcript
 * and persists a delivered cue, mapping the generalized mode → the coaching_cues CHECK vocabulary
 * ('directive' → 'guide_response'); a silent decision persists nothing.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(), appendCue: vi.fn(async () => ({ id: "cue1" })) }));
vi.mock("@/lib/claude", () => ({ liveMeetingCue: vi.fn() }));
// Prep-up (agenda) — default: no prep for this session (agenda-less path; existing tests). Coverage-persist noop.
vi.mock("@/lib/data/meetingPrep", () => ({
  getMeetingPrepBySession: vi.fn(async () => null),
  getPrepDocContext: vi.fn(async () => ""),
  setMeetingPrepTopicsCovered: vi.fn(async () => true),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession, appendCue } from "@/lib/data/salesCoach";
import { liveMeetingCue } from "@/lib/claude";
import { getMeetingPrepBySession, setMeetingPrepTopicsCovered } from "@/lib/data/meetingPrep";
import { POST } from "../route";

const OWNER = "facil-1";
const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

function setAuth(userId: string | null) {
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
}
function req(body: unknown): NextRequest {
  return {
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as unknown as NextRequest;
}
const ctx = { params: Promise.resolve({ id: "s1" }) };
const twoTurns = [
  { speaker: "Alex", text: "Let's settle the launch date." },
  { speaker: "Dana", text: "I think we push a week." },
];
const meetingCue = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ phase: "decision_point", trigger: "undecided", shouldCue: true, cue: "Close the decision.", ...over });

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(OWNER);
  asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, companyId: "co1", sessionKind: "meeting" });
  asMock(appendCue).mockResolvedValue({ id: "cue1" });
  asMock(liveMeetingCue).mockResolvedValue({ text: meetingCue(), suppressed: false });
});

describe("POST meeting-session cue", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req({ mode: "suggestion" }), ctx)).status).toBe(401);
  });

  it("404 when the session isn't found/accessible", async () => {
    asMock(getSession).mockResolvedValue(null);
    expect((await POST(req({ mode: "suggestion" }), ctx)).status).toBe(404);
  });

  it("403 for a non-owner facilitator", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "someone-else", companyId: "co1", sessionKind: "meeting" });
    expect((await POST(req({ mode: "suggestion" }), ctx)).status).toBe(403);
    expect(liveMeetingCue).not.toHaveBeenCalled();
  });

  it("400 when the session is a sales session (wrong route)", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, companyId: "co1", sessionKind: "sales" });
    expect((await POST(req({ mode: "suggestion", liveTranscript: twoTurns }), ctx)).status).toBe(400);
    expect(liveMeetingCue).not.toHaveBeenCalled();
  });

  it("happy path: runs the meeting brain and persists the delivered cue", async () => {
    const res = await POST(req({ mode: "suggestion", liveTranscript: twoTurns }), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cue.shouldCue).toBe(true);
    expect(json.cue.trigger).toBe("undecided");
    expect(json.cueId).toBe("cue1");
    expect(appendCue).toHaveBeenCalledTimes(1);
    expect(asMock(appendCue).mock.calls[0]?.[0].mode).toBe("suggestion");
  });

  it("maps 'directive' mode to 'guide_response' at persist (coaching_cues CHECK)", async () => {
    await POST(req({ mode: "directive", liveTranscript: twoTurns }), ctx);
    expect(asMock(appendCue).mock.calls[0]?.[0].mode).toBe("guide_response");
  });

  it("persists nothing on a silent decision", async () => {
    asMock(liveMeetingCue).mockResolvedValue({ text: meetingCue({ shouldCue: false, cue: "" }), suppressed: false });
    const res = await POST(req({ mode: "suggestion", liveTranscript: twoTurns }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).cue.shouldCue).toBe(false);
    expect(appendCue).not.toHaveBeenCalled();
  });

  it("Prep-up: passes the agenda and PERSISTS the coverage the brain reports (founder 2026-08-22)", async () => {
    asMock(getMeetingPrepBySession).mockResolvedValue({
      id: "prep-1",
      companyId: "co1",
      createdBy: OWNER,
      goal: "Lock the launch date",
      topics: [
        { id: "t1", text: "launch date", covered: false },
        { id: "t2", text: "budget", covered: false },
      ],
      status: "active",
      sessionId: "s1",
    });
    // The brain saw topic t1 discussed this window (even alongside a normal cue).
    asMock(liveMeetingCue).mockResolvedValue({ text: meetingCue({ covered: ["t1"] }), suppressed: false });

    const res = await POST(req({ mode: "suggestion", liveTranscript: twoTurns }), ctx);
    expect(res.status).toBe(200);
    // The agenda reached the brain (the cue LLM was invoked with a user message carrying the goal/topics).
    const userMsg = asMock(liveMeetingCue).mock.calls[0]?.[0]?.userMessage as string;
    expect(userMsg).toContain("Lock the launch date");
    expect(userMsg).toContain("launch date");
    // Coverage persisted: t1 flipped to covered, t2 left uncovered.
    expect(setMeetingPrepTopicsCovered).toHaveBeenCalledTimes(1);
    const savedTopics = asMock(setMeetingPrepTopicsCovered).mock.calls[0]?.[0]?.topics as Array<{ id: string; covered: boolean }>;
    expect(savedTopics.find((t) => t.id === "t1")?.covered).toBe(true);
    expect(savedTopics.find((t) => t.id === "t2")?.covered).toBe(false);
  });

  it("Prep-up: no double-write when the covered set is unchanged", async () => {
    asMock(getMeetingPrepBySession).mockResolvedValue({
      id: "prep-1", companyId: "co1", createdBy: OWNER, goal: "g",
      topics: [{ id: "t1", text: "launch date", covered: true }], status: "active", sessionId: "s1",
    });
    asMock(liveMeetingCue).mockResolvedValue({ text: meetingCue({ covered: ["t1"] }), suppressed: false }); // already covered
    await POST(req({ mode: "suggestion", liveTranscript: twoTurns }), ctx);
    expect(setMeetingPrepTopicsCovered).not.toHaveBeenCalled();
  });
});
