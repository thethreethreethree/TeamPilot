import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RCD list route (/api/care/rcd) — what the panel/sheet loads to show the tenant's captures.
 * Session-authed; reads through the RLS client (0194 SELECT policy scopes to the caller's company).
 * Degrades to an empty list on any read error (missing table / 0194 unapplied) — never a 500 (A34).
 */

vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));

import { GET } from "@/app/api/care/rcd/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

function sbReturning(result: { data: unknown[] | null; error: unknown }) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.order = () => b;
  b.limit = () => Promise.resolve(result);
  return { from: () => b };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/rcd", () => {
  it("401s when unauthenticated", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: false, error: "no", status: 401 } as never);
    expect((await GET()).status).toBe(401);
  });

  it("returns the tenant's conversations", async () => {
    const rows = [{ id: "c1", channel: "whatsapp", source_url: null, message_count: 3, captured_at: "2026-07-26T00:00:00Z", captured_by: "u1" }];
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: true, sb: sbReturning({ data: rows, error: null }) } as never);
    const json = await (await GET()).json();
    expect(json.conversations).toEqual(rows);
  });

  it("degrades to an empty list on a read error (0194 unapplied) — not a 500", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      sb: sbReturning({ data: null, error: { code: "PGRST205", message: "Could not find the table in the schema cache" } }),
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).conversations).toEqual([]);
  });
});
