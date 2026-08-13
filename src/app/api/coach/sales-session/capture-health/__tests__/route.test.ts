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
  ended?: { id: string; audio_asset_url: string | null; agent_id?: string | null }[];
  segments?: { session_id: string; speaker?: string }[];
  agentNames?: { id: string; full_name: string | null }[];
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
      // awaited directly: the head count + ended-sessions read on coaching_sessions, and the agent-name
      // lookup on profiles (.in(ids) → the affected reps' names).
      chain.then = (resolve: (v: unknown) => unknown) => {
        if (table === "profiles") return resolve({ data: t.agentNames ?? [], error: null });
        return resolve(chain._head ? { count: t.total ?? 0, error: null } : { data: t.ended ?? [], error: null });
      };
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
    expect(body).toMatchObject({ total: 0, noFeedback: 0, failed: 0, oneSided: 0, undecided: 0, customerLabeled: 0, recoverable: 0, lost: 0 });
  });

  it("splits no-feedback by CAUSE (empty / undecided / customerLabeled) + per agent + names", async () => {
    // 5 ended. captured-fine = has an AGENT segment; no-feedback = 0 agent turns, split by cause:
    //   s1,s2 (agent A): have agent turns → captured fine.
    //   s3 (agent B): segments, ONLY customer → customerLabeled (mis-attribution or true one-sided). audio → recoverable.
    //   s4 (agent B): segments, an `unknown` → UNDECIDED (attribution failed → fixable). audio → recoverable.
    //   s5 (agent C): no segments → EMPTY (STT captured nothing). no audio → lost.
    setClient({
      total: 5,
      ended: [
        { id: "s1", audio_asset_url: "assets/a1", agent_id: "A" },
        { id: "s2", audio_asset_url: "assets/a2", agent_id: "A" },
        { id: "s3", audio_asset_url: "assets/a3", agent_id: "B" },
        { id: "s4", audio_asset_url: "assets/a4", agent_id: "B" },
        { id: "s5", audio_asset_url: null, agent_id: "C" },
      ],
      segments: [
        { session_id: "s1", speaker: "agent" },
        { session_id: "s1", speaker: "customer" },
        { session_id: "s2", speaker: "agent" },
        { session_id: "s3", speaker: "customer" }, // customerLabeled — customer only, no agent
        { session_id: "s4", speaker: "unknown" }, // undecided — attribution failed to decide
      ],
      agentNames: [
        { id: "B", full_name: "Bianca Reyes" },
        { id: "C", full_name: "Carlos Diaz" },
      ],
    });
    const body = await (await GET()).json();
    expect(body.total).toBe(5);
    expect(body.noFeedback).toBe(3); // s3 + s4 + s5
    expect(body.failed).toBe(1); // empty (no transcript): s5
    expect(body.undecided).toBe(1); // s4 (unknown segment) — fixable in code
    expect(body.customerLabeled).toBe(1); // s3
    expect(body.oneSided).toBe(2); // undecided + customerLabeled (s3, s4)
    expect(body.recoverable).toBe(2); // s3, s4 have audio
    expect(body.lost).toBe(1); // s5 no audio
    expect(body.noFeedbackRate).toBe(60); // 3/5
    // Per-agent: B worst (2/2 = 100%, split 1 undecided + 1 customerLabeled), C (1/1 = 100%, empty), A (0/2).
    const byAgent = body.byAgent as {
      agentId: string; agentName: string | null; ended: number; noFeedback: number;
      undecided: number; customerLabeled: number; empty: number; rate: number;
    }[];
    const A = byAgent.find((x) => x.agentId === "A");
    const B = byAgent.find((x) => x.agentId === "B");
    const C = byAgent.find((x) => x.agentId === "C");
    expect(A).toMatchObject({ ended: 2, noFeedback: 0, rate: 0 });
    expect(B).toMatchObject({ ended: 2, noFeedback: 2, undecided: 1, customerLabeled: 1, empty: 0, rate: 100 });
    expect(C).toMatchObject({ ended: 1, noFeedback: 1, empty: 1, rate: 100 });
    expect(byAgent[byAgent.length - 1]?.agentId).toBe("A"); // lowest rate last
    expect(B?.agentName).toBe("Bianca Reyes");
    expect(A?.agentName ?? null).toBeNull();
    // Names resolved for the affected reps (find WHO). A (no no-feedback) isn't looked up → null.
    expect((B as unknown as { agentName: string | null }).agentName).toBe("Bianca Reyes");
    expect((A as unknown as { agentName: string | null }).agentName).toBeNull();
  });
});
