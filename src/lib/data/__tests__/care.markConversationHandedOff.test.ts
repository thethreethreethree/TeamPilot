import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * markConversationHandedOff is the THIRD member of the §3.3 ai_responding
 * take-over class (with routeNewConversation + claimConversation, both tested):
 * the AI hands off to a human and MUST flip ai_responding=false, or the next
 * customer message gets ANOTHER AI reply after the AI already said "I'm bringing in
 * a teammate" (§3.3 overtake + a broken promise). It's fire-and-forget (returns
 * void), so a failed flip must be LOGGED — never silent — so an operator sees the
 * stuck handoff. These pin both: the flip, and the log-not-throw on failure.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { markConversationHandedOff } from "../care";

type Call = [string, unknown[]];
function findUpdate(calls: Call[]): Record<string, unknown> | undefined {
  const hit = calls.find(([m]) => m === "update");
  return hit ? (hit[1][0] as Record<string, unknown>) : undefined;
}

describe("markConversationHandedOff — §3.3 hand-off flip", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("flips ai_responding=false on the target conversation", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ support_conversations: { error: null } }, calls) as never
    );

    await markConversationHandedOff("c1");

    expect(findUpdate(calls)).toEqual({ ai_responding: false });
    expect(calls.some(([m, a]) => m === "eq" && a[0] === "id" && a[1] === "c1")).toBe(true);
  });

  it("LOGS (does not throw) when the flip fails — a stuck handoff must be visible", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { support_conversations: { data: null, error: { message: "boom" } } },
        calls
      ) as never
    );

    // Fire-and-forget: a failed flip must NOT throw (both callers are post-message
    // fire-and-forget), but MUST be logged so the operator sees the stuck handoff.
    await expect(markConversationHandedOff("c1")).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("markConversationHandedOff")
    );
    errSpy.mockRestore();
  });
});
