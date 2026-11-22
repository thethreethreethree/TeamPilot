import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * notify: resolves the agent's managers (company admins OR sales_coach_role='admin', minus the agent) and upserts
 * one notification per manager with ignore-on-conflict (idempotent via the unique index). Best-effort — never throws.
 */
const state = vi.hoisted(() => ({
  profiles: [] as Array<{ id: string; role: string; sales_coach_role: string | null; manager_id?: string | null }>,
  // rss_tree_active (0273). Default: the function does not exist yet (pre-migration) → today's fan-out.
  tree: { data: null as boolean | null, error: { code: "PGRST202", message: "function not found" } as { code: string; message: string } | null },
  upserts: [] as Array<{ rows: unknown[]; opts: unknown }>,
  upsertError: null as { message: string } | null,
  // Recipients who already have an UNREAD alert of the type asked (the no-call dispute dedupe).
  unread: [] as string[],
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => state.tree,
    from: (table: string) => {
      if (table === "profiles") {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        // resolveManagers awaits the chain (list); the agent-name lookup calls maybeSingle.
        chain.maybeSingle = async () => ({ data: { full_name: "The Rep" }, error: null });
        chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: state.profiles, error: null });
        return chain;
      }
      if (table === "manager_notifications") {
        const read: Record<string, unknown> = {};
        for (const m of ["select", "eq", "is", "in"]) read[m] = () => read;
        read.then = (resolve: (v: unknown) => unknown) => resolve({ data: state.unread.map((recipient_id) => ({ recipient_id })), error: null });
        return {
          ...read,
          upsert: async (rows: unknown[], opts: unknown) => {
            if (state.upsertError) return { error: state.upsertError };
            state.upserts.push({ rows, opts });
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const { notifyStrongSession, notifyDealClosed, notifyScoreDisputed, notifyDisputeAnswered } = await import("../notify");

beforeEach(() => {
  state.profiles = [
    { id: "ceo", role: "CEO", sales_coach_role: null },
    { id: "mgr", role: "staff", sales_coach_role: "admin" },
    { id: "peer", role: "staff", sales_coach_role: "staff" }, // not a manager
    { id: "agent", role: "admin", sales_coach_role: null }, // the agent themself — excluded even though admin
  ];
  state.upserts = [];
  state.upsertError = null;
  state.unread = [];
  state.tree = { data: null, error: { code: "PGRST202", message: "function not found" } };
});

describe("reporting tree (RSS Phase 0 step 8, migration 0273)", () => {
  const recipientsOf = () =>
    (state.upserts[0]!.rows as Array<{ recipient_id: string }>).map((r) => r.recipient_id).sort();

  it("once the company is on the tree, the alert goes up the rep's chain only", async () => {
    state.profiles = [
      { id: "ceo", role: "CEO", sales_coach_role: null, manager_id: null },
      { id: "mgr", role: "staff", sales_coach_role: "admin", manager_id: "ceo" },
      { id: "other-mgr", role: "staff", sales_coach_role: "admin", manager_id: "ceo" },
      { id: "agent", role: "staff", sales_coach_role: "staff", manager_id: "mgr" },
    ];
    state.tree = { data: true, error: null };
    await notifyStrongSession({ companyId: "c1", agentId: "agent", sessionId: "s1", points: 88, band: "strong" });
    expect(recipientsOf()).toEqual(["ceo", "mgr"]); // other-mgr is not above the agent
  });

  it("a company not yet on the tree keeps today's fan-out to every manager", async () => {
    state.tree = { data: false, error: null };
    await notifyStrongSession({ companyId: "c1", agentId: "agent", sessionId: "s1", points: 88, band: "strong" });
    expect(recipientsOf()).toEqual(["ceo", "mgr"]);
  });

  it("an rpc that throws falls back to today's fan-out — the alert is never lost", async () => {
    state.tree = undefined as never; // rpc resolves undefined → destructuring throws inside the guard
    await notifyStrongSession({ companyId: "c1", agentId: "agent", sessionId: "s1", points: 88, band: "strong" });
    expect(recipientsOf()).toEqual(["ceo", "mgr"]);
  });
});

describe("gamification notify", () => {
  it("strong session: notifies company managers, excludes the agent, upserts idempotently", async () => {
    await notifyStrongSession({ companyId: "c1", agentId: "agent", sessionId: "s1", points: 88, band: "strong" });
    expect(state.upserts).toHaveLength(1);
    const { rows, opts } = state.upserts[0]!;
    const recipients = (rows as Array<{ recipient_id: string }>).map((r) => r.recipient_id).sort();
    expect(recipients).toEqual(["ceo", "mgr"]); // peer excluded (not a manager); agent excluded (is the rep)
    expect(opts).toMatchObject({ onConflict: "recipient_id,type,session_id", ignoreDuplicates: true });
    expect((rows as Array<{ type: string; payload: { total: number } }>)[0]!.type).toBe("strong_session");
    expect((rows as Array<{ payload: { total: number } }>)[0]!.payload.total).toBe(88);
  });

  it("deal closed: notifies managers with the deal payload", async () => {
    await notifyDealClosed({ companyId: "c1", agentId: "agent", sessionId: "s1", dealValue: 1500 });
    expect(state.upserts).toHaveLength(1);
    const rows = state.upserts[0]!.rows as Array<{ type: string; payload: { deal_value: number } }>;
    expect(rows[0]!.type).toBe("deal_closed");
    expect(rows[0]!.payload.deal_value).toBe(1500);
  });

  it("no managers → no upsert (an agent whose company has no admin isn't an error)", async () => {
    state.profiles = [{ id: "agent", role: "staff", sales_coach_role: null }];
    await notifyStrongSession({ companyId: "c1", agentId: "agent", sessionId: "s1", points: 90, band: "elite" });
    expect(state.upserts).toHaveLength(0);
  });

  it("an upsert error is swallowed (best-effort — never throws into the caller)", async () => {
    state.upsertError = { message: "db down" };
    await expect(
      notifyStrongSession({ companyId: "c1", agentId: "agent", sessionId: "s1", points: 88, band: "strong" }),
    ).resolves.toBeUndefined();
  });
});

describe("score disputes (Gong F15.21, 0305)", () => {
  const recipients = () => state.upserts.flatMap((u) => (u.rows as Array<{ recipient_id: string }>).map((r) => r.recipient_id)).sort();

  it("a dispute alerts the rep's managers — never the manager who filed it", async () => {
    await notifyScoreDisputed({ companyId: "c1", repId: "agent", sessionId: "s1", pitchId: "p1", note: "wrong", channel: "phone", actorId: "mgr" });
    expect(recipients()).toEqual(["ceo"]);
  });

  it("with no call (a door pitch), anyone with an unread alert for that pitch is not told again", async () => {
    state.unread = ["ceo"];
    await notifyScoreDisputed({ companyId: "c1", repId: "agent", sessionId: null, pitchId: "p1", note: "again", channel: null });
    expect(recipients()).toEqual(["mgr"]);
  });

  it("with a call, the unique index dedupes — no extra read is needed and everyone is upserted", async () => {
    state.unread = ["ceo", "mgr"]; // would filter, but must not be consulted when there is a session
    await notifyScoreDisputed({ companyId: "c1", repId: "agent", sessionId: "s1", pitchId: "p1", note: "x", channel: "video" });
    expect(recipients()).toEqual(["ceo", "mgr"]);
  });

  it("an answer reaches the rep once while their alert is unread (no-call pitch)", async () => {
    state.unread = ["agent"];
    expect(await notifyDisputeAnswered({ companyId: "c1", repId: "agent", managerId: "mgr", sessionId: null, pitchId: "p1", note: "ok" })).toBe(true);
    expect(state.upserts).toHaveLength(0);
    state.unread = [];
    await notifyDisputeAnswered({ companyId: "c1", repId: "agent", managerId: "mgr", sessionId: null, pitchId: "p1", note: "ok" });
    expect(recipients()).toEqual(["agent"]);
  });
});

