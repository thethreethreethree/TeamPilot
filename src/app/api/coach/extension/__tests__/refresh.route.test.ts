import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * The Sales Coach extension refresh route — same shape + behavior as the C.A.R.E refresh route (both call
 * the shared refreshExtensionSession). Branches: rate limited → 429; env not configured → 500; upstream
 * renews → 200 with the new tokens; upstream rejects → 401; upstream unreachable → 502; refresh-token
 * fallback. No auth gate (the refresh token IS the credential — allowlisted in invariant-audit INVARIANT 8).
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ refresh_token: "old-refresh" })) }));

import { POST } from "@/app/api/coach/extension/refresh/route";
import { rateLimit } from "@/lib/api/rateLimit";

const req = {} as never;
const okFetch = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.example.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/coach/extension/refresh", () => {
  it("rate limited → 429", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req)).status).toBe(429);
  });

  it("auth env not configured → 500", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await POST(req)).status).toBe(500);
  });

  it("upstream renews → 200 with the new tokens", async () => {
    vi.stubGlobal("fetch", okFetch({ access_token: "new-access", refresh_token: "new-refresh" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("new-access");
    expect(body.refresh_token).toBe("new-refresh");
  });

  it("upstream returns no access_token → 401", async () => {
    vi.stubGlobal("fetch", okFetch({ error: "invalid_grant" }, false));
    expect((await POST(req)).status).toBe(401);
  });

  it("falls back to the submitted refresh token when upstream omits a new one", async () => {
    vi.stubGlobal("fetch", okFetch({ access_token: "new-access" }));
    const body = await (await POST(req)).json();
    expect(body.refresh_token).toBe("old-refresh");
  });

  it("upstream unreachable (throws) → 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    expect((await POST(req)).status).toBe(502);
  });
});
