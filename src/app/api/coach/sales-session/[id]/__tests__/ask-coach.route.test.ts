import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/ask-coach — the coach answers the rep's question about the call.
 *
 * Locks the §3.4 honest-empty guard (added 2026-08-08, the sales-session instance of the app-wide sweep): an
 * empty-NON-suppressed model answer must 502, never { answer: "" } 200 — which would show the rep a blank
 * coaching answer as if the coach said nothing. The suppressed path (the INTENDED no-answer) stays a 200 with
 * answer:null. Companion to the extension summarize/copilot/formulate empty guards.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ question: "how did the pricing part go?" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "c1") }));
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));
vi.mock("@/lib/data/salesCoach", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/salesCoach")>();
  return { ...actual, getSession: vi.fn(), getSessionTranscript: vi.fn() };
});

import { createClient } from "@/lib/supabase/server";
import { generateCareReply } from "@/lib/claude";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { POST } from "../ask-coach/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = (fn: unknown) => fn as any;
const call = () =>
  POST({ headers: { get: () => null } } as never, { params: Promise.resolve({ id: "s1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mock(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } });
  mock(getSession).mockResolvedValue({ id: "s1" });
  mock(getSessionTranscript).mockResolvedValue([
    { speaker: "rep", text: "hi" },
    { speaker: "customer", text: "hello" },
  ]);
});

describe("POST /ask-coach — §3.4 honest-empty guard", () => {
  it("empty answer (not suppressed) → 502, never { answer: '' } 200", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mock(generateCareReply).mockResolvedValue({ text: "   ", suppressed: false });
    const res = await call();
    expect(res.status).toBe(502);
    expect((await res.json()).answer).toBeUndefined();
    spy.mockRestore();
  });

  it("a real answer → 200 with the trimmed answer", async () => {
    mock(generateCareReply).mockResolvedValue({ text: "  Lead with the ROI framing next time.  ", suppressed: false });
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).answer).toBe("Lead with the ROI framing next time.");
  });

  it("suppressed → 200 { answer: null } (the intended no-answer, not a failure)", async () => {
    mock(generateCareReply).mockResolvedValue({ suppressed: true, reason: "control-window" });
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toBeNull();
    expect(body.suppressed).toBe(true);
  });
});
