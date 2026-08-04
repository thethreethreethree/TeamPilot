import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchWidgetLoadEvents pins the error-as-no-data boundary (section 3.4) for a security-visibility surface.
 *
 * This telemetry surfaces `origin_rejected` — a stolen/guessed embed token used off its allowed origins
 * (section 3.6 make-the-invisible-visible). It used to `catch → summarizeLoadEvents([])` on ANY error, so a
 * transient DB failure rendered as "0 events / 0 rejected origins" — a FALSE calm that could hide an
 * active off-origin token-theft signal. The fetch now stays LOUD on a genuine error (the settings page
 * checks res.ok and renders a setFailed branch) and degrades to empty ONLY for a pending migration
 * (table not yet created), same guarded-fallback contract as the coach's migrationGuard.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchWidgetLoadEvents } from "../careWidgetEvents";

describe("fetchWidgetLoadEvents — stays loud on a genuine error (sections 3.4 / 3.6)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("summarizes and tenant-scopes a normal result", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        {
          care_widget_load_events: {
            data: [
              { id: "1", origin: "https://evil.example", result: "origin_rejected", user_agent: null, created_at: "2026-08-04T00:00:00Z" },
              { id: "2", origin: "https://ok.example", result: "ok", user_agent: null, created_at: "2026-08-04T00:00:01Z" },
            ],
          },
        },
        calls
      ) as never
    );
    const s = await fetchWidgetLoadEvents("co1");
    expect(s.total).toBe(2);
    expect(s.okCount).toBe(1);
    expect(s.rejectedCount).toBe(1);
    expect(s.rejectedOrigins).toEqual(["https://evil.example"]);
    // tenant-scoped, never a client value
    expect(calls).toContainEqual(["eq", ["company_id", "co1"]]);
  });

  it("THROWS on a genuine DB error — never a false 'zero rejected origins' that hides token theft", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { care_widget_load_events: { data: null, error: { code: "42501", message: "permission denied for table care_widget_load_events" } } },
        calls
      ) as never
    );
    await expect(fetchWidgetLoadEvents("co1")).rejects.toBeTruthy();
  });

  it("degrades to an EMPTY summary ONLY when the table is not yet migrated (42P01)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        {
          care_widget_load_events: {
            data: null,
            error: { code: "42P01", message: 'relation "care_widget_load_events" does not exist' },
          },
        },
        calls
      ) as never
    );
    const s = await fetchWidgetLoadEvents("co1");
    expect(s.total).toBe(0);
    expect(s.rejectedCount).toBe(0);
    expect(s.rejectedOrigins).toEqual([]);
  });
});
