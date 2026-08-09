import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Error-as-no-data guard for getCareConversationByToken (INV22 / §3.4). It's the token→conversation authz
 * lookup used by 6 customer/agent conversation routes; each does `if (!conv) return 404`. Before this fix a
 * transient read error collapsed to null → a false 404 ("Conversation not found") that makes the customer's
 * live conversation look deleted. Now it throws on error (→ honest 500, fail-closed) and reserves null for a
 * genuine token-mismatch. Detection-true: rejects on error, returns null on a clean not-found.
 */

let RESULT: { data: unknown; error: { message: string } | null } = { data: null, error: null };

vi.mock("@/lib/supabase/admin", () => {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "is", "in", "order", "limit", "maybeSingle"]) b[m] = () => b;
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(RESULT);
  return { createAdminClient: () => b };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));

import { getCareConversationByToken } from "../care";

beforeEach(() => {
  RESULT = { data: null, error: null };
});

describe("getCareConversationByToken — classify the error (no false 404)", () => {
  it("THROWS on a read error (not null → false 'Conversation not found')", async () => {
    RESULT = { data: null, error: { message: "connection reset" } };
    await expect(getCareConversationByToken("tok")).rejects.toThrow(/Failed to load the conversation/i);
  });

  it("returns null on a genuine token mismatch (no error) — the honest 404 path is preserved", async () => {
    RESULT = { data: null, error: null };
    expect(await getCareConversationByToken("tok")).toBeNull();
  });

  it("returns null immediately for an empty token (no query)", async () => {
    expect(await getCareConversationByToken("")).toBeNull();
  });
});
