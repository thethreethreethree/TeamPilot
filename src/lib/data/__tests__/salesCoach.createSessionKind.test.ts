import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * A34 write-safety drift-guard for createSession + session_kind (migration 0237). The sales path MUST NOT write
 * `session_kind` — on a pre-0237 DB the column is absent and an insert naming it would 500, breaking SALES
 * session creation (the exact migration-coupling outage A34 exists to prevent). A meeting/huddle session DOES
 * write it (and correctly fails on a pre-0237 DB — a meeting can't exist before the migration). This asserts the
 * insert PAYLOAD directly, so a future refactor that always-writes the column is caught here, not in production.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { createSession } from "../salesCoach";

type Call = [string, unknown[]];
const insertPayload = (calls: Call[]) =>
  calls.find(([m]) => m === "insert")?.[1]?.[0] as Record<string, unknown> | undefined;

describe("createSession session_kind write-safety (A34)", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ coaching_sessions: { data: { id: "s1" }, error: null } }, calls) as never
    );
  });

  it("a SALES session (default) does NOT write session_kind — safe on a pre-0237 DB", async () => {
    await createSession({ companyId: "co1", agentId: "a1", context: "in_person", clientLabel: "Call" });
    const payload = insertPayload(calls);
    expect(payload).toBeTruthy();
    expect("session_kind" in payload!).toBe(false);
  });

  it("an explicit sessionKind:'sales' is still treated as default (no column written)", async () => {
    await createSession({ companyId: "co1", agentId: "a1", context: "video", sessionKind: "sales" });
    expect("session_kind" in insertPayload(calls)!).toBe(false);
  });

  it("a MEETING session writes session_kind='meeting'", async () => {
    await createSession({ companyId: "co1", agentId: "a1", context: "in_person", sessionKind: "meeting" });
    expect(insertPayload(calls)!.session_kind).toBe("meeting");
  });

  it("a HUDDLE session writes session_kind='huddle'", async () => {
    await createSession({ companyId: "co1", agentId: "a1", context: "video", sessionKind: "huddle" });
    expect(insertPayload(calls)!.session_kind).toBe("huddle");
  });
});
