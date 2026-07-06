import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchSlaWithDurabilityReadout crosses the response-time SLA with durability.
 * The §3.5 honesty catch it exists for is falseSlaSuccesses: a conversation that
 * MET its first-response SLA but whose resolution later REOPENED — fast is not
 * the same as durable, so a hit-the-clock "success" that didn't hold is NOT a
 * real success. This pins that computation (and fullyHonored = met AND held).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchSlaWithDurabilityReadout } from "../care";

const MSG = "2026-07-01T10:00:00Z";
// helper: a conversation row responded `mins` after first message, SLA 60.
function conv(id: string, mins: number) {
  return {
    id,
    first_message_at: MSG,
    first_response_at: new Date(new Date(MSG).getTime() + mins * 60_000).toISOString(),
    sla_first_response_minutes: 60,
  };
}

describe("fetchSlaWithDurabilityReadout (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("counts SLA-met, held, fully-honored, and FALSE SLA successes", async () => {
    const checks = {
      data: [
        { conversation_id: "C1", outcome: "held" }, // fast + held  -> fully honored
        { conversation_id: "C2", outcome: "reopened" }, // fast + reopened -> FALSE success
        { conversation_id: "C3", outcome: "held" }, // slow + held  -> held, not met
        { conversation_id: "C4", outcome: "inconclusive" }, // fast + inconclusive
      ],
    };
    const conversations = {
      data: [conv("C1", 30), conv("C2", 30), conv("C3", 120), conv("C4", 15)],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_durability_checks: checks, support_conversations: conversations },
        calls
      ) as never
    );

    const out = (await fetchSlaWithDurabilityReadout({ companyId: "co1" })) as unknown as Record<
      string,
      number | null
    >;

    expect(out.totalConversations).toBe(4);
    expect(out.firstResponseMet).toBe(3); // C1, C2, C4 within 60m
    expect(out.durabilityHeld).toBe(2); // C1, C3
    expect(out.fullyHonored).toBe(1); // C1 (met AND held)
    expect(out.falseSlaSuccesses).toBe(1); // C2 (met but reopened) — the catch
    expect(out.falseSlaSuccessesRate).toBeCloseTo(0.25);
    expect(out.fullyHonoredRate).toBeCloseTo(0.25);
    expect(out.firstResponseMetRate).toBeCloseTo(0.75);
  });

  it("returns null rates when there are no durability checks", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_durability_checks: { data: [] } }, calls) as never
    );
    const out = (await fetchSlaWithDurabilityReadout({ companyId: "co1" })) as unknown as Record<
      string,
      number | null
    >;
    expect(out.totalConversations).toBe(0);
    expect(out.falseSlaSuccessesRate).toBeNull();
    expect(out.fullyHonoredRate).toBeNull();
  });
});
