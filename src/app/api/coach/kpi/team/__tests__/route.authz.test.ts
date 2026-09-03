import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/kpi/team — the MANAGER rollup. Security boundary: a non-manager must NOT see the team's
 * per-agent KPIs. These lock the two deny paths (unauthenticated → 401; authenticated non-manager → 403)
 * against a future refactor silently opening the gate. isSalesCoachManager is the REAL pure function; we
 * only feed it a non-manager profile.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

/** The route now resolves auth from the request (cookie first, then a mobile
 *  Bearer token), so it needs one. Same helper shape as the kpi/me tests. */
const req = () => new Request("http://localhost/api/coach/kpi/team");

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** Fake supabase whose profiles read returns the given role row. */
const setProfile = (row: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }),
    }),
  });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/coach/kpi/team — manager gate", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setProfile(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("403 for an authenticated NON-manager (member with no sales-coach admin)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setProfile({ role: "member", sales_coach_role: null, company_id: "co1" });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("a company admin is treated as a manager (does NOT 403 at the gate)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    // A CEO/COO/admin OR sales_coach_role='admin' passes isSalesCoachManager. Past the gate it queries
    // members; our stub returns the same row shape (maybeSingle) for every from() call, so `.not(...)` etc.
    // must exist — provide a permissive chain that resolves to an empty member list → { agents: [] }.
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" } });
        chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [] }); // awaited query → empty list
        return chain;
      },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ agents: [] });
  });

  it("computes the per-agent rollup for a manager (Alice: 5 sold → 100% conversion)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    const sess = (id: string, day: string) => ({
      id,
      agent_id: "a1",
      outcome: "sold",
      deal_value: 100,
      started_at: `${day}T10:00:00.000Z`,
      ended_at: `${day}T10:30:00.000Z`,
    });
    const tables: Record<string, { data: unknown }> = {
      // from("profiles") awaited → members list (the manager check uses maybeSingle instead, below).
      profiles: { data: [{ id: "a1", full_name: "Alice" }] },
      coaching_sessions: {
        data: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"].map((d, i) =>
          sess(`s${i}`, d)
        ),
      },
      coaching_cues: { data: [] },
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" } });
        chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
        return chain;
      },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agents: { name: string; sessionCount: number; conversionRate: { value: number | null } }[];
    };
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0]?.name).toBe("Alice");
    expect(body.agents[0]?.sessionCount).toBe(5);
    expect(body.agents[0]?.conversionRate.value).toBe(100);
  });

  it("flags a slipping rep (recent conversion ≥15% below their own baseline) end-to-end", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    // 10 sessions in ascending time: prior 5 all sold (100%), recent 5 all no_sale (0%) → slipping.
    const row = (id: string, day: string, outcome: string) => ({
      id,
      agent_id: "a1",
      outcome,
      deal_value: outcome === "sold" ? 100 : null,
      started_at: `${day}T10:00:00.000Z`,
      ended_at: `${day}T10:30:00.000Z`,
    });
    const sessions = [
      ...[1, 2, 3, 4, 5].map((n) => row(`p${n}`, `2026-07-0${n}`, "sold")),
      ...[6, 7, 8, 9, 10].map((n, i) => row(`r${n}`, `2026-07-${10 + i}`, "no_sale")),
    ];
    const tables: Record<string, { data: unknown }> = {
      profiles: { data: [{ id: "a1", full_name: "Bob" }] },
      coaching_sessions: { data: sessions },
      coaching_cues: { data: [] },
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" } });
        chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
        return chain;
      },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agents: { name: string; slipping: boolean }[];
      alertDropPct: number;
    };
    expect(body.alertDropPct).toBe(15);
    expect(body.agents[0]?.slipping).toBe(true);
    expect((body.agents[0] as { slippingReasons?: string[] }).slippingReasons).toEqual(["conversion"]);
  });

  it("flags QUALITY slippage even when conversion holds (recent pitch scores ≥15% below baseline)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    // All 10 sold → conversion 100% on both halves (no conversion slip). But after-pitch quality drops
    // 8 → 6 across the halves (6 < 8×0.85=6.8) → quality slips alone.
    const sessions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, i) => ({
      id: `q${n}`,
      agent_id: "a1",
      outcome: "sold",
      deal_value: 100,
      started_at: `2026-07-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      ended_at: `2026-07-${String(i + 1).padStart(2, "0")}T10:30:00.000Z`,
    }));
    const afterPitch = sessions.map((s, i) => ({
      session_id: s.id,
      payload: { scores: [{ key: "opener", score: i < 5 ? 8 : 6 }] },
    }));
    const tables: Record<string, { data: unknown }> = {
      profiles: { data: [{ id: "a1", full_name: "Bob" }] },
      coaching_sessions: { data: sessions },
      coaching_cues: { data: [] },
      after_pitch_summaries: { data: afterPitch },
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" } });
        chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
        return chain;
      },
    });
    const res = await GET(req());
    const body = (await res.json()) as {
      agents: { slipping: boolean; slippingReasons: string[]; conversionRate: { value: number | null } }[];
    };
    expect(body.agents[0]?.conversionRate.value).toBe(100); // conversion held
    expect(body.agents[0]?.slipping).toBe(true);
    expect(body.agents[0]?.slippingReasons).toEqual(["quality"]); // only quality tripped
  });

  it("rolls up per-rep quota attainment against the company target (manager sees who's tracking)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    // Company target = 10 deals/month. This UTC month, Bob has 5 sold → 50%.
    const now = new Date();
    const m = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const sessions = [1, 2, 3, 4, 5].map((n) => ({
      id: `w${n}`,
      agent_id: "a1",
      outcome: "sold",
      deal_value: 100,
      started_at: `${m}-0${n}T10:00:00.000Z`,
      ended_at: `${m}-0${n}T10:30:00.000Z`,
    }));
    const tables: Record<string, { data: unknown }> = {
      profiles: { data: [{ id: "a1", full_name: "Bob" }] },
      coaching_sessions: { data: sessions },
      coaching_cues: { data: [] },
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        // companies quota read (maybeSingle) → target 10; profiles manager check → admin.
        chain.maybeSingle = async () =>
          t === "companies"
            ? { data: { sales_coach_monthly_deal_target: 10 }, error: null }
            : { data: { role: "admin", sales_coach_role: null, company_id: "co1" }, error: null };
        chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
        return chain;
      },
    });
    const res = await GET(req());
    const body = (await res.json()) as {
      agents: { quotaAttainment: { value: number | null } }[];
      monthlyQuotaTarget: number | null;
    };
    expect(body.monthlyQuotaTarget).toBe(10);
    expect(body.agents[0]?.quotaAttainment.value).toBe(50); // 5 of 10
  });

  it("computes reliance only from coach-active sessions (segment-filtered, matching /me)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    // 10 coached sessions (each has a transcript segment) with DECLINING cue counts 10→1 → negative slope.
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      agent_id: "a1",
      outcome: "sold",
      deal_value: 100,
      started_at: `2026-07-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      ended_at: `2026-07-${String(i + 1).padStart(2, "0")}T10:30:00.000Z`,
    }));
    // session c_i gets (10 - i) cue rows; every session has one transcript segment (coach ran).
    const cues = sessions.flatMap((s, i) =>
      Array.from({ length: 10 - i }, () => ({ session_id: s.id }))
    );
    const segments = sessions.map((s) => ({ session_id: s.id }));
    const tables: Record<string, { data: unknown }> = {
      profiles: { data: [{ id: "a1", full_name: "Bob" }] },
      coaching_sessions: { data: sessions },
      coaching_cues: { data: cues },
      coaching_transcript_segments: { data: segments },
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" }, error: null });
        chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
        return chain;
      },
    });
    const res = await GET(req());
    const body = (await res.json()) as { agents: { relianceReduction: { value: number | null } }[] };
    // Coached sessions flowed through → a real (negative) reliance slope, not gated to null.
    expect(body.agents[0]?.relianceReduction.value).not.toBeNull();
    expect(body.agents[0]!.relianceReduction.value!).toBeLessThan(0);
  });

  it("A18: the rollup exposes the quality SLIP flag but NEVER a rep's raw per-session quality scores", async () => {
    // The route READS the private after-pitch payload (Layer-3 scores are owner-private — a manager sees a
    // rep's growth signal, not their self-assessment numbers) to derive the quality-slippage alert. The
    // guarantee is that only the DERIVED boolean/reason leaves the route — never the raw score or the payload.
    // A refactor that added `qualityScore` (or echoed the payload) to the agent object would silently break
    // A18 with no other test catching it, because the existing quality test only checks `slipping`/reasons.
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    const sessions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, i) => ({
      id: `q${n}`,
      agent_id: "a1",
      outcome: "sold",
      deal_value: 100,
      started_at: `2026-07-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      ended_at: `2026-07-${String(i + 1).padStart(2, "0")}T10:30:00.000Z`,
    }));
    // Distinctive raw score values (91 baseline → 42 recent) so a leak would be unambiguous in the payload.
    const afterPitch = sessions.map((s, i) => ({
      session_id: s.id,
      payload: { scores: [{ key: "opener", score: i < 5 ? 91 : 42 }] },
    }));
    const tables: Record<string, { data: unknown }> = {
      profiles: { data: [{ id: "a1", full_name: "Bob" }] },
      coaching_sessions: { data: sessions },
      coaching_cues: { data: [] },
      after_pitch_summaries: { data: afterPitch },
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" }, error: null });
        chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
        return chain;
      },
    });
    const res = await GET(req());
    const raw = await res.text();
    const body = JSON.parse(raw) as { agents: Record<string, unknown>[] };
    const agent = body.agents[0]!;
    // The derived alert IS present…
    expect(agent.slipping).toBe(true);
    expect(agent.slippingReasons).toEqual(["quality"]);
    // …but the agent object exposes ONLY the safe, growth-framed fields — an exact allowlist, so any newly
    // added field (a leaked score, an echoed payload) fails here.
    expect(Object.keys(agent).sort()).toEqual(
      [
        "agentId",
        "companyRole",
        "conversionRate",
        "establishingBaseline",
        "firstSessionAt",
        "name",
        // Aggregate MetricResults (value/sampleSize/gated/sourceSessionIds) — growth-framed rollups like
        // conversion/reliance, NOT raw per-session scores. Added when the new /me metrics were surfaced to the roster.
        "objectionsPerSession",
        "objectionResolutionRate",
        "recommendationUptake",
        "followUpRate",
        "salesCycleLength",
        "quotaAttainment",
        "relianceReduction",
        "sessionCount",
        "slipping",
        "slippingReasons",
      ].sort()
    );
    // And the raw private score values never appear anywhere in the serialized response.
    expect(raw).not.toContain("91");
    expect(raw).not.toContain("42");
    expect(raw).not.toContain("payload");
  });

  it("marks a new rep as establishing a baseline (< 2·MIN_SESSIONS) with a first-session date", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    // 3 sessions only — below 2·MIN_SESSIONS (10), so no trend/alert yet → establishingBaseline true.
    const sessions = [1, 2, 3].map((n) => ({
      id: `n${n}`,
      agent_id: "a1",
      outcome: "sold",
      deal_value: 100,
      started_at: `2026-07-0${n}T10:00:00.000Z`,
      ended_at: `2026-07-0${n}T10:30:00.000Z`,
    }));
    const tables: Record<string, { data: unknown }> = {
      profiles: { data: [{ id: "a1", full_name: "Newbie" }] },
      coaching_sessions: { data: sessions },
      coaching_cues: { data: [] },
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.range = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" }, error: null });
        chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
        return chain;
      },
    });
    const res = await GET(req());
    const body = (await res.json()) as {
      agents: { establishingBaseline: boolean; firstSessionAt: string | null }[];
    };
    expect(body.agents[0]?.establishingBaseline).toBe(true);
    expect(body.agents[0]?.firstSessionAt).toBe("2026-07-01T10:00:00.000Z"); // earliest (rows ascending)
  });
});
