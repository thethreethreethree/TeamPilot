import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * MEDIUM error-as-no-data sweep (2026-08-10) for the C.A.R.E list/aggregate reads that destructured only `data`,
 * so a transient DB error silently became [] / null and misled: an empty event timeline ("nothing happened"),
 * an empty tag picker (agent recreates tags), a blank knowledge base (false "no institutional memory"), "nothing
 * due" on the review queue, a returning customer read as a first-timer, an agent read as offline, an empty team
 * ("no coverage"), "no recurring problems", and a false-clean coach-risk bill. Now they throw on a read error;
 * [] / null are reserved for genuine empty. Detection-true: each rejects on error (fails on the pre-fix reads).
 */

let SERVER: { data: unknown; error: { message: string } | null } = { data: null, error: null };

// Only the query-builder returned by `.from(...)` is thenable (resolves to {data,error} when awaited); the client
// itself must not be, or `await createServerClient()` would collapse to the query result.
function client(getResult: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "is", "in", "not", "gte", "lte", "order", "limit", "maybeSingle"]) {
    q[m] = () => q;
  }
  (q as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(getResult());
  return { from: () => q };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client(() => SERVER)) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => client(() => SERVER)) }));

import {
  fetchConversationEvents,
  listTags,
  listDueDurabilityChecks,
  fetchCustomerPriorConversations,
  fetchAgentPresence,
  fetchTeamPresence,
  listKnowledgeResolutions,
  detectSupportPatterns,
  detectCoachRiskPatterns,
} from "../care";

const ERR = { data: null, error: { message: "connection reset" } };

beforeEach(() => {
  SERVER = { data: null, error: null };
});

describe("C.A.R.E MEDIUM reads — classify the error (no error-as-no-data)", () => {
  it("fetchConversationEvents THROWS on error (not an empty timeline)", async () => {
    SERVER = ERR;
    await expect(fetchConversationEvents("c1")).rejects.toThrow(/Failed to load the conversation events/i);
  });
  it("fetchConversationEvents returns [] on a genuinely event-less conversation (no error)", async () => {
    SERVER = { data: [], error: null };
    expect(await fetchConversationEvents("c1")).toEqual([]);
  });
  it("listTags THROWS on error (not an empty tag picker)", async () => {
    SERVER = ERR;
    await expect(listTags()).rejects.toThrow(/Failed to load the support tags/i);
  });
  it("listDueDurabilityChecks THROWS on error (not 'nothing due')", async () => {
    SERVER = ERR;
    await expect(listDueDurabilityChecks("co1")).rejects.toThrow(/Failed to load the due durability checks/i);
  });
  it("fetchCustomerPriorConversations THROWS on error (not a false first-timer)", async () => {
    SERVER = ERR;
    await expect(
      fetchCustomerPriorConversations({ customerId: "cust1", excludeConversationId: "c1" })
    ).rejects.toThrow(/Failed to load the customer's prior conversations/i);
  });
  it("fetchAgentPresence THROWS on error (not 'offline')", async () => {
    SERVER = ERR;
    await expect(fetchAgentPresence("a1")).rejects.toThrow(/Failed to load the agent's presence/i);
  });
  it("fetchAgentPresence returns null on a genuine no-presence-row (no error)", async () => {
    SERVER = { data: null, error: null };
    expect(await fetchAgentPresence("a1")).toBeNull();
  });
  it("fetchTeamPresence THROWS on error (not an empty team / 'no coverage')", async () => {
    SERVER = ERR;
    await expect(fetchTeamPresence("co1")).rejects.toThrow(/Failed to load the team presence/i);
  });
  it("listKnowledgeResolutions THROWS on error (not a blank knowledge base)", async () => {
    SERVER = ERR;
    await expect(listKnowledgeResolutions({ companyId: "co1" })).rejects.toThrow(
      /Failed to load the knowledge resolutions/i
    );
  });
  it("detectSupportPatterns THROWS on error (not 'no recurring problems')", async () => {
    SERVER = ERR;
    await expect(detectSupportPatterns({ companyId: "co1" })).rejects.toThrow(
      /Failed to load resolutions for pattern detection/i
    );
  });
  it("detectCoachRiskPatterns THROWS on error (not a false-clean bill)", async () => {
    SERVER = ERR;
    await expect(detectCoachRiskPatterns({ companyId: "co1" })).rejects.toThrow(
      /Failed to load messages for coach-risk detection/i
    );
  });
});
