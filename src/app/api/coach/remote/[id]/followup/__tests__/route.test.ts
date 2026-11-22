import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/remote/:id/followup — writes a follow-up email/text draft from the call (never sends it). Pinned:
 * phone/video only; a failed read stops BEFORE the paid AI call (2026-11-23); a draft that couldn't be stored is still
 * returned, marked stored: false.
 */
const st = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  lines: null as null | { lines: unknown[]; version: number },
  brief: { data: { next_steps: [{ text: "Send pricing" }] }, error: null } as { data: unknown; error: { message: string } | null },
  storeError: null as null | { message: string },
}));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
vi.mock("@/lib/coach/remote/followThrough", () => ({ loadLines: vi.fn(async () => st.lines), numberedTranscript: () => "[1] REP: hi" }));
vi.mock("@/lib/claude", () => ({ followUpDraftCoach: vi.fn() }));
const chain = (answer: unknown) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
  q.maybeSingle = async () => answer;
  q.insert = () => ({ select: () => ({ maybeSingle: async () => (st.storeError ? { data: null, error: st.storeError } : { data: { id: "d1", created_at: "2026-11-23" }, error: null }) }) });
  return q;
};
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ from: () => chain(st.brief) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => chain({ data: { full_name: "Pat Rep" }, error: null }) }) }));

import { followUpDraftCoach } from "@/lib/claude";
import { POST } from "../route";

const CALL = "11111111-1111-4111-8111-111111111111";
const post = () => POST(new Request("http://x", { method: "POST", body: JSON.stringify({ channel: "email" }) }) as never, { params: Promise.resolve({ id: CALL }) });
const ai = vi.mocked(followUpDraftCoach);

beforeEach(() => {
  vi.clearAllMocks();
  st.session = { id: CALL, context: "phone", companyId: "co1", agentId: "rep-1", clientLabel: "Pat", startedAt: "2026-11-20T10:00:00Z" };
  st.lines = { lines: [{}, {}, {}], version: 1 };
  st.brief = { data: { next_steps: [{ text: "Send pricing" }] }, error: null };
  st.storeError = null;
  ai.mockResolvedValue({ text: JSON.stringify({ subject: "Next steps", body: "Hi Pat — as promised, pricing attached." }), suppressed: false } as never);
});

describe("follow-up drafts", () => {
  it("writes one from the call and its agreed next steps, and stores it", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(String(ai.mock.calls[0]![0].userMessage)).toContain("- Send pricing");
    expect(await res.json()).toMatchObject({ stored: true, draft: { id: "d1", channel: "email" } });
  });

  it("is for phone and video calls only", async () => {
    st.session = { ...st.session, context: "in_person" };
    expect((await post()).status).toBe(400);
    expect(ai).not.toHaveBeenCalled();
  });

  it("a transcript that fails to read is 'try again' — not 'too little transcript' — and costs nothing", async () => {
    st.lines = null;
    const res = await post();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/try again/i);
    expect(ai).not.toHaveBeenCalled();
  });

  it("too little transcript is still its own answer, and costs nothing", async () => {
    st.lines = { lines: [{}], version: 1 };
    expect((await post()).status).toBe(422);
    expect(ai).not.toHaveBeenCalled();
  });

  it("next steps that fail to read stop the draft BEFORE the AI call (never 'none found' when there were some)", async () => {
    st.brief = { data: null, error: { message: "boom" } };
    expect((await post()).status).toBe(500);
    expect(ai).not.toHaveBeenCalled();
  });

  it("AI turned off for the company → 409, nothing stored", async () => {
    ai.mockResolvedValue({ text: "", suppressed: true } as never);
    expect((await post()).status).toBe(409);
  });

  it("a draft that couldn't be stored is still given to the rep, marked stored: false", async () => {
    st.storeError = { message: "boom" };
    const body = await (await post()).json();
    expect(body).toMatchObject({ stored: false, draft: { id: null, channel: "email" } });
    expect(body.draft.body).toMatch(/pricing attached/);
  });
});
