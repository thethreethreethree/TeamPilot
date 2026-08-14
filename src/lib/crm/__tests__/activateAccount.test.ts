import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";

/**
 * activateAccountGuidance (founder 2026-08-14): setting a CRM account ACTIVE must make it TRULY active — open
 * the AI gate (companies.ai_guidance_enabled=true) so EVERY AI feature works, and advance the lifecycle stage
 * out of the §3.4 control month. Service-role (bypasses the 0111 guard). Lock both effects, and that it never
 * downgrades a further-along stage.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { activateAccountGuidance } from "../data";

const run = async (lifecycleStage: string) => {
  const calls: Array<[string, unknown[]]> = [];
  vi.mocked(createAdminClient).mockReturnValue(
    makeSupabaseClient(
      {
        crm_accounts: { data: { company_id: "co1", lifecycle_stage: lifecycleStage } },
        companies: { data: {} },
      },
      calls
    ) as never
  );
  await activateAccountGuidance("acct1");
  return calls;
};

const updatePayload = (calls: Array<[string, unknown[]]>, key: string) =>
  calls
    .filter(([m]) => m === "update")
    .map(([, a]) => a[0] as Record<string, unknown>)
    .find((p) => p && key in p);

describe("activateAccountGuidance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the AI gate on the company (ai_guidance_enabled=true)", async () => {
    const calls = await run("control_month");
    const guidance = updatePayload(calls, "ai_guidance_enabled");
    expect(guidance?.ai_guidance_enabled).toBe(true);
    expect(guidance?.ai_guidance_enabled_at).toBeTruthy();
  });

  it("advances the stage out of control_month to 'activated'", async () => {
    const calls = await run("control_month");
    const stage = updatePayload(calls, "lifecycle_stage");
    expect(stage?.lifecycle_stage).toBe("activated");
  });

  it("does NOT downgrade a further-along stage (e.g. 'paying') — still opens the gate", async () => {
    const calls = await run("paying");
    expect(updatePayload(calls, "ai_guidance_enabled")?.ai_guidance_enabled).toBe(true); // gate still opened
    expect(updatePayload(calls, "lifecycle_stage")).toBeUndefined(); // stage NOT changed
  });
});
