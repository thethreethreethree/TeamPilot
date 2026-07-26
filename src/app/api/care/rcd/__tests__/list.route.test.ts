import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RCD list route (/api/care/rcd) — what the panel/sheet loads to show the tenant's captures.
 * Session-authed; reads through the RLS client (0194 SELECT policy scopes to the caller's company).
 * Adds a first-message PREVIEW (one batched query for seq 0) so same-channel captures are
 * distinguishable. Degrades to an empty list on any read error (missing table / 0194 unapplied) — A34.
 */

vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));

import { GET } from "@/app/api/care/rcd/route";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

// Table-aware mock: the conversations query terminates at .limit(); the messages (preview) query
// terminates at .eq() after .in(). That lets one builder serve both without ambiguity.
function makeSb(store: { conversations: unknown[] | null; convError?: unknown; firsts?: unknown[] }) {
  return {
    from() {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.order = () => b;
      b.in = () => b;
      b.limit = () => Promise.resolve({ data: store.conversations, error: store.convError ?? null });
      b.eq = () => Promise.resolve({ data: store.firsts ?? [], error: null });
      return b;
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/rcd", () => {
  it("401s when unauthenticated", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({ ok: false, error: "no", status: 401 } as never);
    expect((await GET()).status).toBe(401);
  });

  it("returns the tenant's conversations, each with a first-message preview", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      sb: makeSb({
        conversations: [
          { id: "c1", channel: "whatsapp", source_url: null, message_count: 3, captured_at: "2026-07-26T00:00:00Z", captured_by: "u1" },
          { id: "c2", channel: "whatsapp", source_url: null, message_count: 1, captured_at: "2026-07-25T00:00:00Z", captured_by: "u1" },
        ],
        firsts: [{ conversation_id: "c1", body: "  hi, where is my order?  " }], // c2 has no seq-0 body
      }),
    } as never);
    const json = await (await GET()).json();
    expect(json.conversations[0]).toMatchObject({ id: "c1", preview: "hi, where is my order?" });
    expect(json.conversations[1]).toMatchObject({ id: "c2", preview: null }); // no preview → null, not undefined
  });

  it("degrades to an empty list on a read error (0194 unapplied) — not a 500", async () => {
    vi.mocked(requireCareAgent).mockResolvedValue({
      ok: true,
      sb: makeSb({ conversations: null, convError: { code: "PGRST205", message: "Could not find the table in the schema cache" } }),
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).conversations).toEqual([]);
  });
});
