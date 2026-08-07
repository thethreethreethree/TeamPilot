import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The shared rep-name resolver the 5 sales extension routes use for the WHO-IS-WHO anchor. Best-effort:
 * a real name is trimmed and returned; a missing/blank name OR any lookup failure degrades to the generic
 * label (never blocks the tool, never fabricates).
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { resolveRepName } from "@/lib/coach/extension/repName";
import { createAdminClient } from "@/lib/supabase/admin";

const mockProfile = (data: unknown, throws = false) =>
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (throws) throw new Error("db down");
            return { data };
          },
        }),
      }),
    }),
  } as never);

beforeEach(() => vi.clearAllMocks());

describe("resolveRepName", () => {
  it("returns the trimmed full name when present", async () => {
    mockProfile({ full_name: "  Dana Rivera  " });
    expect(await resolveRepName("u1")).toBe("Dana Rivera");
  });

  it("falls back to the generic label when the name is blank", async () => {
    mockProfile({ full_name: "   " });
    expect(await resolveRepName("u1")).toBe("the sales rep");
  });

  it("falls back when there is no profile row", async () => {
    mockProfile(null);
    expect(await resolveRepName("u1")).toBe("the sales rep");
  });

  it("falls back when full_name is not a string", async () => {
    mockProfile({ full_name: 123 });
    expect(await resolveRepName("u1")).toBe("the sales rep");
  });

  it("never throws — a lookup failure degrades to the generic label", async () => {
    mockProfile(null, true);
    expect(await resolveRepName("u1")).toBe("the sales rep");
  });
});
