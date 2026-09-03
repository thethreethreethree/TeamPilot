import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * my-points — the mobile Bearer path. When resolveApiAuth authenticates a caller who has NO cookie (a mobile
 * `Authorization: Bearer` request), the route must read through the CALLER-SCOPED token client (auth.uid() resolves
 * → owner-RLS applies), never the cookie client — otherwise the caller authenticates and then gets an empty result
 * (the "authenticate then fail at first query" gap callerScopedDb exists to close). The cookie client is stubbed to
 * THROW so any accidental fallback to it on a Bearer request fails loudly.
 */
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    throw new Error("cookie client must NOT be used on a Bearer request");
  }),
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { GET } from "../route";

const bearerReq = () =>
  new Request("http://localhost/api/coach/gamification/my-points", { headers: { authorization: "Bearer tok" } }) as never;

/** A minimal thenable query builder returning `rows` (mirrors the paged read in the route). */
function scopedClientReturning(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "range"]) chain[m] = () => chain;
  chain.then = (res: (v: unknown) => unknown) => res({ data: rows, error: null });
  return { from: () => chain };
}

beforeEach(() => vi.clearAllMocks());

describe("my-points — mobile Bearer path", () => {
  it("reads via the caller-scoped token client (never the cookie client) and returns the caller's own points", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "mobile", companyId: "c1", isAdmin: false });
    (callerScopedDb as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      scopedClientReturning([{ session_id: "s1", points: 70, detail: { band: "solid" }, created_at: "2026-08-01T00:00:00Z" }]),
    );
    const res = await GET(bearerReq());
    expect(res.status).toBe(200); // NOT a throw from the cookie client
    const body = await res.json();
    expect(body.sessions).toBe(1);
    expect(body.total).toBe(70);
    expect(callerScopedDb).toHaveBeenCalled(); // the token client was used
  });

  it("401 when neither cookie nor Bearer authenticates", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (callerScopedDb as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect((await GET(bearerReq())).status).toBe(401);
  });
});
