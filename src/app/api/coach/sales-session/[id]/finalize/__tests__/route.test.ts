import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/finalize — appends the live attributed transcript, then generates +
 * stores the dissect/summary/moments/pivot/intel. The boundary that makes this route distinct: it is
 * OWNER-ONLY, stricter than the usual owner-OR-manager gate. getSession returns a session for a manager too,
 * but finalize APPENDS transcript segments (what the rep "said"), so letting a manager call it would be the
 * A18 transcript-injection vector — a manager fabricating the record. This locks: 401; 404 (inaccessible);
 * 403 for a manager who can SEE the session but is NOT its rep, with NOTHING appended; and 200 for the owner.
 * The five generation engines are mocked (no LLM); appendTranscriptSegment is captured.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => [{ speaker: "agent", text: "Hi", seq: 0 }]),
  appendTranscriptSegment: vi.fn(async () => true),
}));
vi.mock("@/lib/coach/v5/salesDissect", () => ({ runAndStoreDissect: vi.fn(async () => ({})) }));
vi.mock("@/lib/coach/v5/salesSummary", () => ({ runAndStoreSummary: vi.fn(async () => ({})) }));
vi.mock("@/lib/coach/v5/salesPivot", () => ({ runAndStorePivot: vi.fn(async () => ({})) }));
vi.mock("@/lib/coach/v5/salesMoments", () => ({ runAndStoreMoments: vi.fn(async () => []) }));
vi.mock("@/lib/coach/v5/salesIntel", () => ({ runAndStoreIntel: vi.fn(async () => ({})) }));

import { createClient } from "@/lib/supabase/server";
import { getSession, appendTranscriptSegment } from "@/lib/data/salesCoach";
import { runAndStoreDissect } from "@/lib/coach/v5/salesDissect";
import { POST } from "../route";

// The dissect-marker idempotency read (supabase.from("events")…). Default empty = "not yet generated".
let priorDissect: unknown[] = [];
const setAuth = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: (t: string) => {
      if (t === "events") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ limit: async () => ({ data: priorDissect }) }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  });
const setSession = (s: unknown) => (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(s);

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const BODY = { segments: [{ speaker: "agent", text: "Hi, thanks for your time.", seq: 0 }] };

beforeEach(() => {
  vi.clearAllMocks();
  priorDissect = []; // default: not yet generated
});

describe("POST /finalize — owner-only (A18 transcript-injection defense)", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    setSession({ agentId: "rep1", context: "in_person" });
    expect((await POST(req(BODY), ctx)).status).toBe(401);
  });

  it("404 when the session isn't accessible", async () => {
    setAuth("rep1");
    setSession(null);
    expect((await POST(req(BODY), ctx)).status).toBe(404);
  });

  it("403 for a MANAGER who can see the session but isn't its rep — and appends NOTHING", async () => {
    setAuth("manager1"); // getSession returned the session (manager can view), but they are not the agent
    setSession({ agentId: "rep1", context: "in_person" });
    const res = await POST(req(BODY), ctx);
    expect(res.status).toBe(403);
    // The A18 guarantee: not a single fabricated segment reached the transcript.
    expect(appendTranscriptSegment).not.toHaveBeenCalled();
  });

  it("200 for the owning rep — appends the transcript AND generates (no prior dissect)", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", context: "in_person" });
    const res = await POST(req(BODY), ctx);
    expect(res.status).toBe(200);
    expect(appendTranscriptSegment).toHaveBeenCalledTimes(1); // the one segment in BODY
    expect(runAndStoreDissect).toHaveBeenCalledTimes(1); // first finalize → the engines run
  });

  it("IDEMPOTENT (finding 9): a second finalize with the dissect already generated appends but does NOT re-run the 5 engines", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", context: "in_person" });
    priorDissect = [{ id: "e1" }]; // coach.dissect_generated already exists for this session
    const res = await POST(req(BODY), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyGenerated).toBe(true);
    // The transcript append is still idempotent-safe, but the expensive LLM generation is SKIPPED.
    expect(runAndStoreDissect).not.toHaveBeenCalled();
  });
});
