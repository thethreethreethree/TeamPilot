import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * notify: resolves the agent's managers (company admins OR sales_coach_role='admin', minus the agent) and upserts
 * one notification per manager with ignore-on-conflict (idempotent via the unique index). Best-effort — never throws.
 */
const state = vi.hoisted(() => ({
  profiles: [] as Array<{ id: string; role: string; sales_coach_role: string | null }>,
  upserts: [] as Array<{ rows: unknown[]; opts: unknown }>,
  upsertError: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
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
        return {
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

const { notifyStrongSession, notifyDealClosed } = await import("../notify");

beforeEach(() => {
  state.profiles = [
    { id: "ceo", role: "CEO", sales_coach_role: null },
    { id: "mgr", role: "staff", sales_coach_role: "admin" },
    { id: "peer", role: "staff", sales_coach_role: "staff" }, // not a manager
    { id: "agent", role: "admin", sales_coach_role: null }, // the agent themself — excluded even though admin
  ];
  state.upserts = [];
  state.upsertError = null;
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
