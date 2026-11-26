import { describe, it, expect, vi, beforeEach } from "vitest";

/** /[id]/custom-brief (F13.2, 0364): only a call the caller can open; only a live company template; the run's outcomes. */
const st = vi.hoisted(() => ({
  session: { id: "11111111-1111-4111-8111-111111111111", agentId: "rep1", startedAt: "2026-11-20T10:00:00Z", audioStartedAt: null, context: "phone", sessionKind: "sales" } as Record<string, unknown> | null,
  template: { id: "22222222-2222-4222-8222-222222222222", sections: [{ question: "Budget?", instructions: "" }], retired_at: null } as Record<string, unknown> | null,
  run: { answers: [{ question: "Budget?", answer: "Ten thousand.", seqs: [1] }], transcriptVersion: 2, createdAt: "x" } as unknown,
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
vi.mock("@/lib/coach/remote/briefTemplatesRun", () => ({ runBriefTemplate: vi.fn(async () => st.run) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: st.template, error: null });
      return q;
    },
  }),
}));
import { POST } from "../route";
import { runBriefTemplate } from "@/lib/coach/remote/briefTemplatesRun";
const ID = "11111111-1111-4111-8111-111111111111";
const TID = "22222222-2222-4222-8222-222222222222";
const run = (templateId = TID) => POST(new Request("http://t/x", { method: "POST", body: JSON.stringify({ templateId }) }) as never, { params: Promise.resolve({ id: ID }) });

beforeEach(() => {
  st.session = { id: ID, agentId: "rep1", startedAt: "2026-11-20T10:00:00Z", audioStartedAt: null, context: "phone", sessionKind: "sales" };
  st.template = { id: TID, sections: [{ question: "Budget?", instructions: "" }], retired_at: null };
  st.run = { answers: [{ question: "Budget?", answer: "Ten thousand.", seqs: [1] }], transcriptVersion: 2, createdAt: "x" };
  vi.mocked(runBriefTemplate).mockClear();
});

describe("custom brief", () => {
  it("runs a live template on a call the caller can open", async () => {
    const r = await run();
    expect(r.status).toBe(200);
    expect((await r.json()).brief.answers[0]).toMatchObject({ answer: "Ten thousand.", seqs: [1] });
  });
  it("a call the caller can't open is 404, and nothing runs (no AI spend)", async () => {
    st.session = null;
    expect((await run()).status).toBe(404);
    expect(runBriefTemplate).not.toHaveBeenCalled();
  });
  it("a retired or unknown template is 404; a door pitch is refused", async () => {
    st.template = { ...(st.template as object), retired_at: "2026-11-25T00:00:00Z" };
    expect((await run()).status).toBe(404);
    st.template = { id: TID, sections: [], retired_at: null };
    st.session = { ...(st.session as object), context: "in_person" };
    expect((await run()).status).toBe(400);
    expect(runBriefTemplate).not.toHaveBeenCalled();
  });
  it("no transcript or AI off are said, not shown as empty answers", async () => {
    st.run = "empty";
    expect((await run()).status).toBe(409);
    st.run = "suppressed";
    expect((await run()).status).toBe(409);
    st.run = null;
    expect((await run()).status).toBe(502);
  });
});
