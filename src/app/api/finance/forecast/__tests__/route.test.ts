import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * finance/forecast must not leak the raw Postgres/RPC error to the client (CWE-209). The forecast RPC error
 * (`fc.error.message`) is a raw backend string — table/relation names on schema drift — and was previously
 * returned to the caller with a misleading 403. This locks: an RPC error yields a GENERIC 500 with no raw
 * string, and the unauth path still 401s. Found by the whole-app raw-error-field sweep (build xi).
 */
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "@/app/api/finance/forecast/route";
import { createClient } from "@/lib/supabase/server";

const req = () => ({ url: "http://localhost/api/finance/forecast?days=90" }) as never;

function fakeSb(opts: { user: boolean; fcError?: { message: string } | null }) {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user ? { id: "user-1" } : null } }),
    },
    rpc: async () => ({ data: opts.fcError ? null : [], error: opts.fcError ?? null }),
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({ data: null }),
        order: () => ({ limit: async () => ({ data: [] }) }),
      }),
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/finance/forecast — CWE-209", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb({ user: false }) as never);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns a GENERIC 500 (not the raw RPC error, not a 403) when the forecast RPC errors", async () => {
    const secret = "relation \"fin_cash_forecast\" does not exist";
    vi.mocked(createClient).mockResolvedValue(
      fakeSb({ user: true, fcError: { message: secret } }) as never
    );
    const res = await GET(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("fin_cash_forecast");
    expect(body.error).not.toContain("relation");
    expect(body.error).toBe(
      "Couldn't compute the forecast right now — please try again in a moment."
    );
  });
});
