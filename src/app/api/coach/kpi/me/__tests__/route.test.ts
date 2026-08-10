import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/kpi/me — the agent's own KPI view. Locks: 401 unauthenticated, and that it computes the
 * Layer-1/2 metrics end-to-end from the caller's sessions (compute is REAL — this is the integration seam).
 * The supabase client is faked with a per-table data map; every query is awaited (no maybeSingle here).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** Fake supabase: from(table) → a thenable chain resolving to that table's data. */
const setTables = (tables: Record<string, { data: unknown; error?: unknown }>) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: (t: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.range = () => chain;
      chain.in = () => chain;
      // companies quota-target read uses maybeSingle; null target → quota metric stays "building".
      chain.maybeSingle = async () => ({
        data: t === "companies" ? { sales_coach_monthly_deal_target: null } : null,
        error: null,
      });
      chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
      return chain;
    },
  });

const sess = (id: string, day: string) => ({
  id,
  outcome: "sold",
  deal_value: 100,
  started_at: `${day}T10:00:00.000Z`,
  ended_at: `${day}T10:30:00.000Z`,
  client_label: null,
});

beforeEach(() => vi.clearAllMocks());

describe("GET /api/coach/kpi/me", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setTables({});
    expect((await GET()).status).toBe(401);
  });

  it("computes Layer-1/2 metrics from the caller's sessions (5 sold → 100% conversion, $500 revenue)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setTables({
      coaching_sessions: {
        data: [
          sess("s1", "2026-07-01"),
          sess("s2", "2026-07-02"),
          sess("s3", "2026-07-03"),
          sess("s4", "2026-07-04"),
          sess("s5", "2026-07-05"),
        ],
      },
      after_pitch_summaries: { data: [] },
      coaching_cues: { data: [] },
      coaching_cue_outcomes: { data: [] },
      coaching_transcript_segments: { data: [] },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionCount).toBe(5);
    expect(body.minSessions).toBe(5);
    expect(body.metrics.conversionRate.value).toBe(100);
    expect(body.metrics.revenue.value).toBe(500);
    expect(body.metrics.avgDealSize.value).toBe(100);
    // A metric with no data stays gated ("building").
    expect(body.metrics.cueAcceptanceRate.value).toBeNull();
    // Win/loss with 5 wins and 0 losses is an UNDEFINED ratio → gated, never ∞ (consumer wiring, not just compute).
    expect(body.metrics.winLossRatio.value).toBeNull();
    expect(body.metrics.winLossRatio.gated).toBe(true);
    // Quota with no company target set stays "building" (the mock returns target null).
    expect(body.metrics.quotaAttainment.value).toBeNull();
  });

  it("surfaces a real win/loss ratio through the route (4 sold + 1 no_sale → 4.0)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    const mixed = (id: string, day: string, outcome: string) => ({
      id,
      outcome,
      deal_value: outcome === "sold" ? 100 : null,
      started_at: `${day}T10:00:00.000Z`,
      ended_at: `${day}T10:30:00.000Z`,
      client_label: null,
    });
    setTables({
      coaching_sessions: {
        data: [
          mixed("s1", "2026-07-01", "sold"),
          mixed("s2", "2026-07-02", "sold"),
          mixed("s3", "2026-07-03", "sold"),
          mixed("s4", "2026-07-04", "sold"),
          mixed("s5", "2026-07-05", "no_sale"),
        ],
      },
      after_pitch_summaries: { data: [] },
      coaching_cues: { data: [] },
      coaching_cue_outcomes: { data: [] },
      coaching_transcript_segments: { data: [] },
    });
    const body = await (await GET()).json();
    expect(body.metrics.winLossRatio.value).toBe(4); // 4 wins ÷ 1 loss
    expect(body.metrics.conversionRate.value).toBe(80); // 4 of 5 opportunities
  });
});
