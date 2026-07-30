import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/outcome — records the call outcome + (new) the deal value, the Layer-1
 * KPI source. Locks: the deal value is threaded through to setSessionOutcome, and a bad outcome is rejected
 * by the schema. getSession's RLS read is the access check (kept real-shaped via a mock returning a session).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
// readBody is REAL — it validates with the route's zod schema and returns a NextResponse(400) on failure,
// which is exactly what the route checks for. Mocking it would bypass the schema we want to lock.
vi.mock("@/lib/data/salesCoach", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/salesCoach")>();
  return { ...actual, getSession: vi.fn(), setSessionOutcome: vi.fn() };
});

import { createClient } from "@/lib/supabase/server";
import { getSession, setSessionOutcome } from "@/lib/data/salesCoach";
import { POST } from "../outcome/route";

const call = (body: unknown) =>
  POST({ json: async () => body, headers: { get: () => null } } as unknown as Parameters<typeof POST>[0], {
    params: Promise.resolve({ id: "s1" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  });
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1" });
  (setSessionOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1", outcome: "sold", dealValue: 2500 });
});

describe("POST /outcome", () => {
  it("threads outcome + dealValue through to setSessionOutcome", async () => {
    const res = await call({ outcome: "sold", dealValue: 2500 });
    expect(res.status).toBe(200);
    expect((setSessionOutcome as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      sessionId: "s1",
      outcome: "sold",
      dealValue: 2500,
      actorId: "u1",
    });
  });

  it("records an outcome without a deal value (dealValue optional)", async () => {
    const res = await call({ outcome: "no_sale" });
    expect(res.status).toBe(200);
    const arg = (setSessionOutcome as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { dealValue?: number };
    expect(arg.dealValue).toBeUndefined();
  });

  it("rejects a negative deal value (schema)", async () => {
    const res = await call({ outcome: "sold", dealValue: -5 });
    expect(res.status).toBe(400);
    expect(setSessionOutcome).not.toHaveBeenCalled();
  });
});
