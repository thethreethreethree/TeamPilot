import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/capture-health — the "cost of the capture incident" count (founder 2026-08-12).
 * Locks the load-bearing derivation: an ended session with NO transcript is a failed capture; split into
 * recoverable (audio_asset_url set) vs lost (null). Also the manager gate + honest zero. The count itself is
 * computed in-app (exact head for the total; the ended rows + segment session_ids are paged), so this mocks
 * the supabase reads and asserts the arithmetic.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/coach/v5/skillAccess", () => ({ isSalesCoachManager: vi.fn(() => true) }));

import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { GET } from "../route";

type Tables = {
  profile?: unknown;
  ended?: { id: string; audio_asset_url: string | null }[];
  segments?: { session_id: string }[];
  total?: number;
  userId?: string | null;
};

function setClient(t: Tables) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: t.userId === null ? null : { id: t.userId ?? "mgr" } } }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = { _head: false };
      chain.select = (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) chain._head = true;
        return chain;
      };
      chain.eq = () => chain;
      chain.in = () => chain;
      chain.order = () => chain;
      chain.maybeSingle = async () => ({ data: t.profile ?? { role: "admin", sales_coach_role: null }, error: null });
      // paged reads end on .range(from,to): page 0 returns the rows, page 1+ returns [] (short page → end).
      chain.range = async (from: number) => ({
        data:
          from > 0
            ? []
            : table === "coaching_transcript_segments"
              ? (t.segments ?? [])
              : (t.ended ?? []),
        error: null,
      });
      // awaited directly (the exact-count head query on coaching_sessions).
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve(chain._head ? { count: t.total ?? 0, error: null } : { data: t.ended ?? [], error: null });
      return chain;
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (isSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

describe("GET /capture-health", () => {
  it("401 unauthenticated", async () => {
    setClient({ userId: null });
    expect((await GET()).status).toBe(401);
  });

  it("403 for a non-manager", async () => {
    setClient({});
    (isSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect((await GET()).status).toBe(403);
  });

  it("honest zero when there are no ended sessions", async () => {
    setClient({ total: 0, ended: [], segments: [] });
    const body = await (await GET()).json();
    expect(body).toMatchObject({ total: 0, failed: 0, recoverable: 0, lost: 0 });
  });

  it("counts failed captures, split into recoverable (audio saved) vs lost (no audio)", async () => {
    // 5 ended; s1-s3 captured (have segments); s4 failed but audio saved → recoverable; s5 failed, no audio → lost.
    setClient({
      total: 5,
      ended: [
        { id: "s1", audio_asset_url: "assets/a1" },
        { id: "s2", audio_asset_url: "assets/a2" },
        { id: "s3", audio_asset_url: null },
        { id: "s4", audio_asset_url: "assets/a4" },
        { id: "s5", audio_asset_url: null },
      ],
      segments: [{ session_id: "s1" }, { session_id: "s2" }, { session_id: "s3" }],
    });
    const body = await (await GET()).json();
    expect(body.total).toBe(5);
    expect(body.failed).toBe(2); // s4, s5
    expect(body.recoverable).toBe(1); // s4 has audio
    expect(body.lost).toBe(1); // s5 has no audio
    expect(body.failureRate).toBe(40); // 2/5
  });
});
