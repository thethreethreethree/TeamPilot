import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Error-as-no-data guard for the agent-view conversation reads (INV22 / §3.4). fetchAgentConversation and
 * fetchEnrichedConversation destructured only `data` (renamed) and returned null/[] on `!data`, so a transient
 * error made the agent's live conversation look deleted / its thread empty. These were MISSED by the first
 * `const { data } = await` sweep (renamed-destructure shape) and caught by the completeness check. Now they
 * throw. Detection-true: rejects on error; null/[] reserved for genuine not-found/empty.
 */

let SERVER: { data: unknown; error: { message: string } | null } = { data: null, error: null };

function client(getResult: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "order", "limit", "maybeSingle"]) q[m] = () => q;
  (q as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(getResult());
  return { from: () => q };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client(() => SERVER)) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => client(() => SERVER)) }));

import { fetchAgentConversation, fetchEnrichedConversation } from "../care";

beforeEach(() => {
  SERVER = { data: null, error: null };
});

describe("agent conversation reads — classify the error (no error-as-no-data)", () => {
  it("fetchAgentConversation THROWS on a read error (not null → 'conversation not found')", async () => {
    SERVER = { data: null, error: { message: "connection reset" } };
    await expect(fetchAgentConversation("id1")).rejects.toThrow(/Failed to load the conversation/i);
  });

  it("fetchEnrichedConversation THROWS on a read error (not null)", async () => {
    SERVER = { data: null, error: { message: "timeout" } };
    await expect(fetchEnrichedConversation("id1")).rejects.toThrow(/Failed to load the conversation/i);
  });

  it("fetchAgentConversation returns null on a genuine not-found (no error) — honest path preserved", async () => {
    SERVER = { data: null, error: null };
    expect(await fetchAgentConversation("id1")).toBeNull();
  });
});
