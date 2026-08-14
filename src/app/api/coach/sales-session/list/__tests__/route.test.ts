import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/list — the session list. Previously untested. It reads via the ADMIN client
 * (bypasses RLS), so the ROUTE must scope the query itself: a non-manager rep is confined to their OWN
 * sessions (`.eq("agent_id", userId)`), while a manager sees the whole company. A regression dropping that rep
 * filter would leak every teammate's sessions to every rep. This is NOT the `?agentId=` shape INV6 guards, so
 * it needs its own lock. isSalesCoachManager is the real predicate; the query is captured to assert the scope.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

/** Capture every .eq(col,val) on the coaching_sessions query; return an empty list so the downstream
 *  badge/signal queries (guarded by subjects.length) are skipped. */
let eqCalls: Array<{ col: string; val: unknown }>;
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.gte = () => chain;
      chain.in = () => chain;
      chain.eq = (col: string, val: unknown) => {
        eqCalls.push({ col, val });
        return chain;
      };
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
      return chain;
    },
  });

const req = () => ({ url: "https://x/api/coach/sales-session/list" }) as unknown as Parameters<typeof GET>[0];
const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls = [];
  mockAdmin();
});

describe("GET /list — session scope", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, null);
    expect((await GET(req())).status).toBe(401);
  });

  it("a REP's query is scoped to company AND their own agent_id (no peer sessions)", async () => {
    setCaller("rep1", REP);
    await GET(req());
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" });
    expect(eqCalls).toContainEqual({ col: "agent_id", val: "rep1" });
  });

  it("a MANAGER's query is company-scoped but NOT agent-filtered (sees the whole team)", async () => {
    setCaller("boss", MANAGER);
    await GET(req());
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" });
    expect(eqCalls.some((c) => c.col === "agent_id")).toBe(false);
  });
});

/**
 * The badge + signal event reads were UNBOUNDED `.select()`s (silently capped at 1000 rows) until the
 * truncation-class fix (founder-authorized 2026-08-12); both now page via fetchAllPaged. Two things about that
 * change are load-bearing and were previously unguarded (TBC closure residual R3):
 *
 *   1. The SIGNAL read must page by (created_at desc, id desc) — the route keeps the FIRST-seen event per
 *      (session, kind), so "first seen" only equals "latest" if that descending order is preserved across
 *      pages. Regressing to `.order("id")` alone (the exact mistake the route comment warns against) would make
 *      an OLDER pivot win. Guarded two ways: (A) the captured `.order()` arguments assert the contract, and
 *      (B) a behavioural test feeds the events in the contracted desc order and asserts the latest pivot wins.
 *      The mock returns rows in the DB's contracted order, so (B) guards the route's first-seen loop while (A)
 *      guards the order contract itself — neither alone is sufficient.
 *   2. A badge-read ERROR must set badgesAvailable=false (§3.4 honest-unavailable), never a false "nothing
 *      generated" for every session.
 */
type EventRow = { kind: string; subject: string; id: string; payload?: unknown; created_at?: string };
const isSignalKinds = (kinds: unknown) =>
  Array.isArray(kinds) && kinds.includes("coach.session_pivot_generated");

function richAdmin(opts: {
  sessions: Array<Record<string, unknown>>;
  badgeEvents?: EventRow[];
  signalEvents?: EventRow[];
  badgeError?: boolean;
}) {
  const signalOrderCalls: Array<[string, unknown]> = [];
  const badgeOrderCalls: Array<[string, unknown]> = [];
  const from = (table: string) => {
    if (table === "coaching_sessions") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.gte = () => chain;
      chain.then = (res: (v: unknown) => unknown) => res({ data: opts.sessions, error: null });
      return chain;
    }
    if (table === "events") {
      let kinds: unknown = null;
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.in = (col: string, vals: unknown) => {
        if (col === "kind") kinds = vals;
        return chain;
      };
      chain.order = (col: string, o: unknown) => {
        (isSignalKinds(kinds) ? signalOrderCalls : badgeOrderCalls).push([col, o]);
        return chain;
      };
      chain.range = (rangeFrom: number) => {
        const signal = isSignalKinds(kinds);
        if (!signal && opts.badgeError) {
          return Promise.resolve({ data: null, error: { message: "boom" } });
        }
        const rows = signal ? (opts.signalEvents ?? []) : (opts.badgeEvents ?? []);
        // One short page (<1000) ends fetchAllPaged; page 1+ is empty.
        return Promise.resolve({ data: rangeFrom > 0 ? [] : rows, error: null });
      };
      return chain;
    }
    throw new Error(`unexpected table ${table}`);
  };
  return { from, signalOrderCalls, badgeOrderCalls };
}

const session = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  agent_id: "rep1",
  client_label: "Acme",
  context: "in_person",
  status: "reviewed",
  started_at: "2026-01-01T00:00:00Z",
  ended_at: "2026-01-01T00:30:00Z",
  audio_duration_seconds: 1800,
  territory: null,
  offer: null,
  outcome: "sold",
  ...over,
});

describe("GET /list — paged badge + signal reads (truncation-class fix, R3)", () => {
  it("(A) pages the SIGNAL read by (created_at desc, id desc) and the BADGE read by id", async () => {
    setCaller("rep1", REP);
    const admin = richAdmin({ sessions: [session()] });
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(admin);
    await GET(req());
    // The exact ordering the latest-wins rule depends on — a regression to `.order("id")` alone fails here.
    expect(admin.signalOrderCalls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(admin.badgeOrderCalls).toEqual([["id", undefined]]);
  });

  it("(B) latest pivot per session wins — the newest event is kept, not an older one", async () => {
    setCaller("rep1", REP);
    // Supplied in the DB's contracted desc order: newest (gained) first, older (lost) second. First-seen wins,
    // so on a SOLD session the flag must be 'outstanding'. If the order were reversed (older winning), the lost
    // pivot would classify as 'examination', which a rep never sees → flag null. So this pins latest-wins.
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      richAdmin({
        sessions: [session()],
        signalEvents: [
          {
            kind: "coach.session_pivot_generated",
            subject: "sales_session:s1",
            id: "e2",
            created_at: "2026-01-02T00:00:00Z",
            payload: { pivot: { direction: "gained" } },
          },
          {
            kind: "coach.session_pivot_generated",
            subject: "sales_session:s1",
            id: "e1",
            created_at: "2026-01-01T00:00:00Z",
            payload: { pivot: { direction: "lost" } },
          },
        ],
      }),
    );
    const body = await (await GET(req())).json();
    expect(body.sessions[0].flag?.kind).toBe("outstanding");
  });

  it("(B) badge events from the paged read populate the per-session flags", async () => {
    setCaller("rep1", REP);
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      richAdmin({
        sessions: [session()],
        badgeEvents: [
          { kind: "coach.dissect_generated", subject: "sales_session:s1", id: "b1" },
          { kind: "coach.session_summary_generated", subject: "sales_session:s1", id: "b2" },
        ],
      }),
    );
    const body = await (await GET(req())).json();
    expect(body.badgesAvailable).toBe(true);
    expect(body.sessions[0].hasDissect).toBe(true);
    expect(body.sessions[0].hasSummary).toBe(true);
    expect(body.sessions[0].hasReview).toBe(false);
  });

  it("REGRESSION (finding 3): the 'reviewed' filter returns ended sessions WITH a review event (status='reviewed' is never written)", async () => {
    setCaller("rep1", REP);
    const reqReviewed = () =>
      ({ url: "https://x/api/coach/sales-session/list?status=reviewed" }) as unknown as Parameters<typeof GET>[0];
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      richAdmin({
        // Two ENDED sessions; only s1 has a review event. Old code filtered on status='reviewed' (never
        // written) → zero rows for everyone. New code fetches ended + keeps only those with a review event.
        sessions: [session({ id: "s1", status: "ended" }), session({ id: "s2", status: "ended" })],
        badgeEvents: [{ kind: "coach.sales_review_generated", subject: "sales_session:s1", id: "b1" }],
      }),
    );
    const body = await (await GET(reqReviewed())).json();
    expect(body.sessions.map((r: { id: string }) => r.id)).toEqual(["s1"]); // s1 kept, s2 dropped, NOT empty
  });

  it("(2) a badge-read error sets badgesAvailable=false (§3.4 honest-unavailable, not a false 'nothing generated')", async () => {
    setCaller("rep1", REP);
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      richAdmin({ sessions: [session()], badgeError: true }),
    );
    const body = await (await GET(req())).json();
    expect(body.badgesAvailable).toBe(false);
    expect(body.sessions[0].hasDissect).toBe(false);
  });
});
