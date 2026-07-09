import { describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * captureResolution inserts the support_resolutions row — which is also what TRIGGERS
 * the durability-check schedule (the §3.5 loop). Before the 2026-07-09 fix it swallowed
 * the DB error and returned null, and the route returned { resolution: null } with HTTP
 * 200 — SUCCESS on failure. That silently lost the knowledge capture AND skipped the
 * §3.5 measurement for the conversation while the agent saw "captured." This pins the
 * throw-on-error (no false-ok) + a normal success.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { captureResolution } from "../care";

const ARGS = {
  conversationId: "c1",
  companyId: "co1",
  capturedBy: "a1",
  issueSummary: "customer couldn't reset password",
  whatWorked: "walked them through the reset-link flow",
};

describe("captureResolution — §3.4 no false-ok", () => {
  it("THROWS on a DB error (was a silent null → route HTTP 200, skipping the §3.5 durability schedule)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_resolutions: { data: null, error: { message: "db down" } } },
        []
      ) as never
    );
    await expect(captureResolution(ARGS)).rejects.toThrow("captureResolution failed");
  });

  it("returns the captured resolution on success", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        {
          support_resolutions: {
            data: {
              id: "r1",
              conversation_id: "c1",
              company_id: "co1",
              captured_by: "a1",
              issue_summary: ARGS.issueSummary,
              what_worked: ARGS.whatWorked,
              category: null,
              precedent_resolution_id: null,
              created_at: "2026-07-09T00:00:00Z",
            },
            error: null,
          },
        },
        []
      ) as never
    );
    const r = await captureResolution(ARGS);
    expect(r).not.toBeNull();
    expect(r?.id).toBe("r1");
  });
});
