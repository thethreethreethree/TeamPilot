import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * DB data-layer unit test via a mocked Supabase client (no live database).
 * Verifies listAgentSessions queries coaching_sessions, scopes by agent_id (the
 * §A18 owner-scope), honors the limit, and maps snake_case rows to the domain
 * shape. See ./_supabaseMock.ts for the reusable client stand-in.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { listAgentSessions } from "../salesCoach";

const ROW = {
  id: "s1",
  company_id: "co1",
  agent_id: "agent-42",
  context: "in_person",
  client_label: "Maple St",
  status: "ended",
  audio_asset_url: null,
  started_at: "2026-07-01T10:00:00Z",
  ended_at: "2026-07-01T10:20:00Z",
  territory: null,
  approach: null,
  offer: null,
  outcome: "sold",
};

describe("listAgentSessions (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;

  beforeEach(() => {
    calls = [];
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ coaching_sessions: { data: [ROW] } }, calls) as never
    );
  });

  it("queries coaching_sessions scoped to the agent and maps the row", async () => {
    const sessions = await listAgentSessions("agent-42", 25);

    expect(calls.some(([m, a]) => m === "from" && a[0] === "coaching_sessions")).toBe(true);
    expect(
      calls.some(([m, a]) => m === "eq" && a[0] === "agent_id" && a[1] === "agent-42")
    ).toBe(true);
    expect(calls.some(([m, a]) => m === "limit" && a[0] === 25)).toBe(true);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: "s1",
      companyId: "co1",
      agentId: "agent-42",
      clientLabel: "Maple St",
      status: "ended",
      outcome: "sold",
    });
  });

  it("returns [] when the query yields no rows", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ coaching_sessions: { data: null } }, calls) as never
    );
    expect(await listAgentSessions("agent-42")).toEqual([]);
  });
});
