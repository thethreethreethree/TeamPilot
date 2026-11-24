import { describe, it, expect, vi, beforeEach } from "vitest";

/** POST send-to-crm (0330): whoever can open the call queues a call.to_crm with ids only; no endpoint → a clear 409. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
const st = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: st.rpc }) }));
import { getSession } from "@/lib/data/salesCoach";
import { POST } from "../route";

const call = () => POST(new Request("http://x", { method: "POST" }) as never, { params: Promise.resolve({ id: "s1" }) });
const S = { id: "s1", companyId: "co1", context: "phone", sessionKind: "sales", status: "ended" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(S as never);
  st.rpc.mockResolvedValue({ data: 1, error: null });
  process.env.RSS_WEBHOOK_SIGNING_SECRET = "test-master";
});

describe("send-to-crm", () => {
  it("signing not set up on the server → 503 in plain words, and nothing is queued (§1.5.3)", async () => {
    delete process.env.RSS_WEBHOOK_SIGNING_SECRET;
    const r = await call();
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/isn't switched on for ELOSTATE yet.*Nothing was sent/);
    expect(st.rpc).not.toHaveBeenCalled();
  });
  it("queues the call (ids only) for the company's CRM endpoints", async () => {
    expect(await (await call()).json()).toEqual({ queued: 1 });
    expect(st.rpc).toHaveBeenCalledWith("rss_webhook_enqueue", { p_company: "co1", p_event: "call.to_crm", p_payload: { sessionId: "s1", sentBy: "rep1" } });
  });
  it("no CRM connected → 409 saying where an admin sets it up", async () => {
    st.rpc.mockResolvedValue({ data: 0, error: null });
    const r = await call();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/Protection → Webhooks/);
  });
  it("a call the caller can't open is 404; a meeting or a live call is refused", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect((await call()).status).toBe(404);
    vi.mocked(getSession).mockResolvedValueOnce({ ...S, sessionKind: "meeting" } as never);
    expect((await call()).status).toBe(409);
    vi.mocked(getSession).mockResolvedValueOnce({ ...S, status: "active" } as never);
    expect((await call()).status).toBe(409);
    expect(st.rpc).not.toHaveBeenCalled();
  });
});
